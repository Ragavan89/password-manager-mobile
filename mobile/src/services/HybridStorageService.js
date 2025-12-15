/**
 * HybridStorageService.js
 * 
 * Hybrid storage service that manages both local and cloud storage.
 * This is the main data access layer - screens should use this service
 * instead of directly accessing Database.js or FirestoreService.js.
 * 
 * Key features:
 * - Automatic local-first storage with cloud sync
 * - Bidirectional sync with Last-Write-Wins conflict resolution
 * - Cloud storage limits and subscription tier support
 * - Offline support with automatic sync when online
 * - Tombstone-based deletion for proper sync
 * 
 * Flow: Screen → HybridStorageService → Database.js (local) + FirestoreService.js (cloud)
 */

import * as Database from './Database';
import * as FirestoreService from './FirestoreService';
import { getCurrentUser, signInAnonymouslyUser } from './FirebaseAuthService';
import * as SecureStore from 'expo-secure-store';
import { AppConfig } from '../config/AppConfig';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase.config';
import NetInfo from '@react-native-community/netinfo';

// Sync timeout configuration - adjust these for different network conditions
const QUICK_SYNC_TIMEOUT = 1500; // Try quick sync for 1.5 seconds before going to background
const BACKGROUND_SYNC_TIMEOUT = 10000; // Max 10 seconds for background sync

import {
    getUserSalt,
    syncTemporarySalt,
    verifySaltIntegrity,
    isSaltMigrationRequired,
    getMigrationSalts,
    clearSaltMigrationFlags,
    resetSaltVerification
} from './UserSaltService';
import { reEncryptAllPasswords } from './Encryption';

// EXPLICITLY get the named database instance to ensure we aren't using default
const firestore = getFirestore(app, 'keyvault-pro-india');

// Sync lock to prevent concurrent syncs (which could cause UI freeze)
let isSyncing = false;
let syncPromise = null;

// Sync Status Constants
export const SyncStatus = {
    LOCAL_ONLY: 0,
    SYNCED: 1,
    MODIFIED: 2
};

/**
 * Get cloud password limit from Firestore config
 * Supports subscription tier-based limits when feature flag is enabled
 */
export const getCloudPasswordLimit = async () => {
    try {
        const configRef = doc(firestore, AppConfig.CONFIG_COLLECTION, AppConfig.CONFIG_DOC_ID);
        console.log(`🔍 Fetching limit from: ${AppConfig.CONFIG_COLLECTION}/${AppConfig.CONFIG_DOC_ID}`);

        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            console.log('✅ Cloud limit config fetched successfully:', data);

            // Check if subscription tiers feature is enabled
            const subscriptionTiersEnabled = data.subscriptionTiersEnabled === true;

            // Always prefer subscriptionTiers if available (regardless of feature flag)
            // Feature flag only controls whether different users get different limits
            if (data.subscriptionTiers) {
                const tiers = data.subscriptionTiers || {};
                const freeLimit = tiers.free || 25;
                const tier1Limit = tiers.tier1 || 75;
                const tier2Limit = tiers.tier2 || 150;

                if (subscriptionTiersEnabled) {
                    // Subscription tier-based limits - different users get different limits
                    const user = getCurrentUser();
                    if (user) {
                        try {
                            const tierResult = await FirestoreService.getUserSubscriptionTier(user.uid);
                            const userTier = tierResult.success ? (tierResult.tier || 'free') : 'free';

                            let limit;
                            switch (userTier) {
                                case 'tier2':
                                    limit = tier2Limit;
                                    break;
                                case 'tier1':
                                    limit = tier1Limit;
                                    break;
                                case 'free':
                                default:
                                    limit = freeLimit;
                                    break;
                            }

                            console.log(`✅ Using subscription tier limit: ${userTier} = ${limit}`);

                            // Cache the limit and tier for offline use
                            await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(limit));
                            await SecureStore.setItemAsync('USER_SUBSCRIPTION_TIER', userTier);

                            return limit;
                        } catch (tierError) {
                            console.log('⚠️ Error fetching user tier, using free tier:', tierError);
                            // Fall through to use free tier
                        }
                    }
                } else {
                    // Feature flag disabled - use free tier limit for everyone (global limit)
                    console.log(`✅ Using free tier limit for all users (subscription tiers disabled): ${freeLimit}`);
                    await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(freeLimit));
                    await SecureStore.setItemAsync('USER_SUBSCRIPTION_TIER', 'free');
                    return freeLimit;
                }

                // No user or error fetching tier, use free tier
                console.log('📱 Using free tier limit (default)');
                const freeLimitValue = tiers.free || 25;
                await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(freeLimitValue));
                await SecureStore.setItemAsync('USER_SUBSCRIPTION_TIER', 'free');
                return freeLimitValue;
            } else {
                // No subscriptionTiers defined - use legacy maxCloudPasswords as fallback
                const limit = data.maxCloudPasswords || AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT;
                console.log(`⚠️ No subscriptionTiers found, using maxCloudPasswords (legacy): ${limit}`);

                // Cache the limit for offline use
                await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(limit));
                return limit;
            }
        }

        // Config document doesn't exist - warn user to create it
        console.log('⚠️ Config document does not exist');
        console.log('💡 Please run setup script: node scripts/setup-subscription-tiers.js');
        console.log('💡 Or create config/limits document manually in Firestore');

        // Use default subscription tier values (don't auto-create)
        const defaultFreeLimit = 25;
        console.log(`📱 Using default free tier limit: ${defaultFreeLimit}`);
        await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(defaultFreeLimit));
        await SecureStore.setItemAsync('USER_SUBSCRIPTION_TIER', 'free');
        return defaultFreeLimit;
    } catch (error) {
        console.log('❌ Error fetching cloud limit:', error);
        if (error.code === 'permission-denied') {
            console.log('🛑 Permission denied. Check Firestore Security Rules.');
            console.log('💡 Ensure rules allow read/write access to "config/limits" for request.auth != null');
        }
        console.log('❌ Error details:', error.code, error.message);
    }

    // Fallback to cached value if available
    try {
        const cachedLimit = await SecureStore.getItemAsync('CLOUD_PASSWORD_LIMIT');
        if (cachedLimit) {
            console.log('📱 Using cached cloud limit:', cachedLimit);
            return parseInt(cachedLimit, 10);
        }
    } catch (cacheError) {
        console.error('Error reading cached limit:', cacheError);
    }

    // No cache available - this should only happen if Firestore is unavailable
    // and user has never fetched config before. In this case, the savePassword
    // function will treat it as offline and save locally.
    throw new Error('Cannot fetch limit: Firestore unavailable and no cache');
};

/**
 * Get subscription tier limits from Firestore config
 * Auto-creates config document if it doesn't exist
 * @returns {Promise<{success: boolean, tiers?: {free: number, tier1: number, tier2: number}, enabled?: boolean, error?: string}>}
 */
export const getSubscriptionTierLimits = async () => {
    try {
        const configRef = doc(firestore, AppConfig.CONFIG_COLLECTION, AppConfig.CONFIG_DOC_ID);
        let configSnap = await getDoc(configRef);

        // If config doesn't exist, return defaults (don't auto-create)
        if (!configSnap.exists()) {
            console.log('⚠️ Config document does not exist');
            console.log('💡 Please run setup script: node scripts/setup-subscription-tiers.js');
            // Return default values for UI display
            return {
                success: true,
                enabled: false,
                tiers: {
                    free: 25,
                    tier1: 75,
                    tier2: 150
                }
            };
        }

        if (configSnap.exists()) {
            const data = configSnap.data();
            const subscriptionTiersEnabled = data.subscriptionTiersEnabled === true;

            // Always use subscriptionTiers if available (regardless of feature flag)
            // Feature flag only controls whether tier-based limits are enforced
            if (data.subscriptionTiers) {
                const tiers = data.subscriptionTiers;
                console.log('📋 Using subscriptionTiers from config:', tiers);
                return {
                    success: true,
                    enabled: subscriptionTiersEnabled,
                    tiers: {
                        free: tiers.free || 25,
                        tier1: tiers.tier1 || 75,
                        tier2: tiers.tier2 || 150
                    }
                };
            }

            // No subscriptionTiers defined, use maxCloudPasswords for all
            const defaultLimit = data.maxCloudPasswords || AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT;
            console.log('⚠️ No subscriptionTiers found, using maxCloudPasswords for all:', defaultLimit);
            return {
                success: true,
                enabled: false,
                tiers: {
                    free: defaultLimit,
                    tier1: defaultLimit,
                    tier2: defaultLimit
                }
            };
        }

        return { success: false, error: 'Config document does not exist' };
    } catch (error) {
        console.error('Error fetching subscription tier limits:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if cloud sync is enabled
 */
const isCloudSyncEnabled = async () => {
    try {
        const enabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
        const user = getCurrentUser();
        return enabled === 'true' && user !== null;
    } catch (error) {
        return false;
    }
};

/**
 * Save password to local DB and optionally to Firestore
 */
export const savePassword = async (passwordData) => {
    try {
        const siteName = passwordData.siteName || 'Untitled';
        const username = passwordData.username || '';
        const encryptedPassword = passwordData.encryptedPassword || '';
        const comments = passwordData.comments || '';
        const type = passwordData.type || 'password';
        const meta = passwordData.meta || '';

        // Always save to local database FIRST (instant, non-blocking)
        let cloudSynced = SyncStatus.LOCAL_ONLY; // Mark as unsynced initially
        const { id, lastModified } = Database.addPassword(siteName, username, encryptedPassword, comments, cloudSynced, passwordData.id || null, type, meta);

        console.log(`✅ Password saved locally: ${siteName} (ID: ${id})`);

        // Smart cloud sync: Try quick upload first, fallback to background
        const cloudEnabled = await isCloudSyncEnabled();
        let limitReached = false;

        if (cloudEnabled) {
            const user = getCurrentUser();
            if (user) {
                // Attempt quick upload (1.5s timeout) - for fast/medium networks
                try {
                    // Check limit before uploading
                    const cloudLimit = await Promise.race([
                        getCloudPasswordLimit(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Limit check timeout')), 1000))
                    ]);

                    const cloudResult = await Promise.race([
                        FirestoreService.getPasswords(user.uid),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Password fetch timeout')), 1000))
                    ]);

                    const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                    if (currentCloudCount >= cloudLimit) {
                        console.log(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Password saved locally only.`);
                        limitReached = true;
                    } else {
                        // Under limit - attempt quick upload
                        const quickUploadPromise = FirestoreService.savePassword(user.uid, {
                            ...passwordData,
                            lastModified,
                            id: id
                        });

                        const saveResult = await Promise.race([
                            quickUploadPromise,
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Quick upload timeout')), QUICK_SYNC_TIMEOUT)
                            )
                        ]);

                        if (saveResult.success) {
                            // Quick upload succeeded!
                            Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                            await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                            console.log(`✅ Password uploaded to cloud (quick): ${siteName}`);
                            cloudSynced = SyncStatus.SYNCED;
                        }
                    }
                } catch (error) {
                    // Quick upload failed/timed out - continue with background sync
                    console.log(`⚠️ Quick upload failed, continuing in background: ${error.message}`);

                    // Start long-running background upload with limit check
                    (async () => {
                        try {
                            // Re-check limit in background (might have changed)
                            const cloudLimit = await getCloudPasswordLimit();
                            const cloudResult = await FirestoreService.getPasswords(user.uid);
                            const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                            if (currentCloudCount >= cloudLimit) {
                                console.log(`⚠️ Cloud limit reached in background (${currentCloudCount}/${cloudLimit}). Staying yellow.`);
                                return; // Don't upload, entry stays yellow
                            }

                            const uploadPromise = FirestoreService.savePassword(user.uid, {
                                ...passwordData,
                                lastModified,
                                id: id
                            });

                            const saveResult = await Promise.race([
                                uploadPromise,
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Upload timeout')), BACKGROUND_SYNC_TIMEOUT)
                                )
                            ]);

                            if (saveResult.success) {
                                Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                                console.log(`✅ Password uploaded to cloud (background): ${siteName}`);
                            }
                        } catch (bgError) {
                            console.log(`⚠️ Background upload failed (will retry on next sync): ${bgError.message}`);
                        }
                    })();
                }
            }
        }

        // Return immediately
        return {
            success: true,
            id,
            synced: cloudSynced === SyncStatus.SYNCED,
            limitReached: limitReached,
            isOffline: false
        };
    } catch (error) {
        console.error('Error in savePassword:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all passwords from local DB
 * Optionally sync from Firestore in background
 */
export const getPasswords = async () => {
    try {
        // Always get from local database
        const localPasswords = Database.getPasswords();

        // If cloud sync is enabled, sync in background (don't wait)
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled) {
            syncBidirectional().catch(err => console.error('Background sync failed:', err));
        }

        return localPasswords;
    } catch (error) {
        console.error('Error in getPasswords:', error);
        return [];
    }
};

/**
 * Update password in local DB and optionally in Firestore
 */
export const updatePassword = async (id, passwordData) => {
    try {
        // Extract fields for Database.updatePassword
        const siteName = passwordData.siteName || 'Untitled';
        const username = passwordData.username || '';
        const encryptedPassword = passwordData.encryptedPassword || '';
        const comments = passwordData.comments || '';
        const type = passwordData.type || 'password';
        const meta = passwordData.meta || '';

        // Always update local database FIRST (instant, non-blocking)
        const { lastModified } = Database.updatePassword(id, siteName, username, encryptedPassword, comments, type, meta);

        // SYNC STATUS LOGIC:
        // 0 = Not in Cloud (New) -> Keep 0
        // 1 = In Cloud (Synced) -> Set 2 (Modified)
        // 2 = In Cloud (Modified) -> Keep 2
        let currentStatus = SyncStatus.LOCAL_ONLY;
        try {
            const currentItem = Database.getPassword(id);
            // Default to LOCAL_ONLY if not found, though update would have failed
            currentStatus = currentItem ? (currentItem.cloudSynced !== undefined ? currentItem.cloudSynced : SyncStatus.SYNCED) : SyncStatus.LOCAL_ONLY;
        } catch (e) {
            console.warn('Error fetching current status, defaulting to unsynced:', e);
        }

        // Determine new status
        let newStatus = SyncStatus.LOCAL_ONLY;
        if (currentStatus === SyncStatus.SYNCED) newStatus = SyncStatus.MODIFIED; // Was synced, now modified
        else if (currentStatus === SyncStatus.MODIFIED) newStatus = SyncStatus.MODIFIED; // Was modified, stay modified

        let cloudSynced = newStatus;
        let limitReached = false;
        Database.updateCloudSyncStatus(id, newStatus);

        console.log(`✅ Password updated locally: ${siteName} (ID: ${id}). Status: ${currentStatus} -> ${newStatus}`);

        // Smart cloud sync: Try quick upload first, fallback to background
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled) {
            const user = getCurrentUser();
            if (user) {
                // Attempt quick update (1.5s timeout) - for fast/medium networks

                try {
                    const quickUpdatePromise = FirestoreService.updatePassword(user.uid, id, {
                        ...passwordData,
                        lastModified
                    });

                    const updateResult = await Promise.race([
                        quickUpdatePromise,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Quick update timeout')), QUICK_SYNC_TIMEOUT)
                        )
                    ]);

                    if (updateResult.success) {
                        Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                        await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                        console.log(`✅ Password updated in cloud (quick): ${siteName}`);
                        cloudSynced = SyncStatus.SYNCED;
                    } else if (updateResult.error?.includes('No document')) {
                        // Document doesn't exist in cloud (Local Only). Treat as NEW upload.
                        console.log(`⚠️ Document missing in cloud. Checking limit before creation...`);

                        // Check limit quickly
                        const cloudLimit = await getCloudPasswordLimit();
                        const cloudResult = await FirestoreService.getPasswords(user.uid);
                        const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                        if (currentCloudCount >= cloudLimit) {
                            console.log(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Cannot create cloud doc.`);
                            limitReached = true;
                        } else {
                            // Limit OK - Create document
                            const saveResult = await FirestoreService.savePassword(user.uid, {
                                ...passwordData,
                                lastModified,
                                id: id
                            });

                            if (saveResult.success) {
                                Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                                console.log(`✅ Password created in cloud (quick): ${siteName}`);
                                cloudSynced = SyncStatus.SYNCED;
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Quick update failed, continuing in background: ${error.message}`);

                    // Background update
                    (async () => {
                        try {
                            const updatePromise = FirestoreService.updatePassword(user.uid, id, {
                                ...passwordData,
                                lastModified
                            });

                            const updateResult = await Promise.race([
                                updatePromise,
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Update timeout')), BACKGROUND_SYNC_TIMEOUT)
                                )
                            ]);

                            if (updateResult.success) {
                                Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                                console.log(`✅ Password updated in cloud (background): ${siteName}`);
                            } else if (updateResult.error?.includes('No document')) {
                                // Background creation attempt
                                const cloudLimit = await getCloudPasswordLimit();
                                const cloudResult = await FirestoreService.getPasswords(user.uid);
                                const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                                if (currentCloudCount < cloudLimit) {
                                    const saveResult = await FirestoreService.savePassword(user.uid, {
                                        ...passwordData,
                                        lastModified,
                                        id: id
                                    });
                                    if (saveResult.success) {
                                        Database.updateCloudSyncStatus(id, SyncStatus.SYNCED);
                                        console.log(`✅ Password created in cloud (background)`);
                                    }
                                } else {
                                    console.log(`⚠️ Limit reached in background logic`);
                                }
                            }
                        } catch (bgError) {
                            console.log(`⚠️ Background update failed (will retry on next sync): ${bgError.message}`);
                        }
                    })();
                }
            }
        }

        // Return immediately
        return {
            success: true,
            synced: cloudSynced === SyncStatus.SYNCED,
            limitReached: limitReached,
            isOffline: false
        };
    } catch (error) {
        console.error('Error in updatePassword:', error);
        return { success: false, error: error.message };
    }
};


/**
 * Delete password from local DB and optionally from Firestore
 * Uses tombstone (soft delete) approach for proper offline sync
 */
export const deletePassword = async (id) => {
    try {
        // Check network status first
        const netState = await NetInfo.fetch();
        const isOffline = !netState.isConnected;

        // Always mark as deleted (tombstone) in local database first (fast operation)
        // This allows sync to detect and delete from cloud later
        Database.markAsDeleted(id);

        // If cloud sync is enabled and online, try to delete from Firestore immediately
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled && !isOffline) {
            try {
                const user = getCurrentUser();
                if (user) {
                    // Use ID directly (UUID)
                    const result = await FirestoreService.deletePassword(user.uid, id);
                    if (result.success) {
                        // Successfully deleted from cloud, permanently remove tombstone
                        Database.permanentlyDelete(id);
                        // Update last sync time
                        await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                        console.log('✅ Password deleted from cloud and tombstone removed');
                    } else {
                        console.warn('⚠️ Failed to delete from Firestore, tombstone kept for sync:', result.error);
                        // Tombstone remains, will be processed during next sync
                    }
                }
            } catch (error) {
                // If network error occurs during delete, tombstone is kept for later sync
                if (error.code === 'unavailable' || error.message?.includes('network') || error.message?.includes('timeout')) {
                    console.log('⚠️ Network error during cloud delete, tombstone kept for sync');
                } else {
                    console.error('Error deleting from Firestore:', error);
                    // Keep tombstone for sync attempt later
                }
            }
        } else if (cloudEnabled && isOffline) {
            console.log('📱 Device is offline, password marked as deleted (tombstone). Will sync deletion when online.');
        }

        return { success: true };
    } catch (error) {
        console.error('Error in deletePassword:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Bidirectional sync with Last-Write-Wins strategy (OPTIMIZED)
 * Uses hash maps for O(1) lookups and parallel batch processing
 * Handles 1000+ passwords efficiently
 * 
 * SYNC SCENARIOS COVERED:
 * 1. Uploads NEW local-only entries (subject to cloud limit check)
 * 2. Updates EXISTING cloud passwords (not blocked by limit)
 * 3. Downloads new passwords from cloud
 * 4. Updates local passwords from cloud (if cloud is newer)
 * 5. Processes tombstones (deletions) - always allowed, not blocked by limit
 * 
 * LIMIT ENFORCEMENT:
 * - New uploads are blocked when limit is reached
 * - Updates to existing passwords always proceed (don't count against limit)
 * - Deletions always proceed (free up space)
 */
export const syncBidirectional = async () => {
    // Prevent concurrent syncs - if one is already running, return the existing promise
    if (isSyncing && syncPromise) {
        console.log('⏸️ Sync already in progress, returning existing promise');
        return syncPromise;
    }

    // Mark as syncing and create the sync promise
    isSyncing = true;
    const SYNC_OVERALL_TIMEOUT = 60000; // 60 seconds total

    const syncOperation = Promise.race([
        (async () => {
            try {
                // --- 1. PRELIMINARY CHECKS ---
                const cloudEnabled = await isCloudSyncEnabled();
                if (!cloudEnabled) return { success: false, error: 'Cloud sync not enabled' };

                const user = getCurrentUser();
                if (!user) return { success: false, error: 'User not authenticated' };

                const netState = await NetInfo.fetch();
                if (!netState.isConnected || !netState.isInternetReachable) {
                    return { success: false, error: 'No internet connection.' };
                }

                console.log('🔄 Starting bidirectional sync...');

                // --- 2. SALT INTEGRITY ---
                await ensureSaltIntegrity(user.uid);


                // --- 3. DATA FETCHING ---
                const localPasswords = Database.getPasswords();
                const tombstones = Database.getDeletedPasswords();

                // Get Cloud Data
                const cloudResult = await FirestoreService.getPasswords(user.uid);
                if (!cloudResult.success) return { success: false, error: cloudResult.error };
                const cloudPasswords = cloudResult.passwords || [];

                console.log(`📊 Local: ${localPasswords.length}, Cloud: ${cloudPasswords.length}, Tombstones: ${tombstones.length}`);


                // --- 4. RECONCILIATION (DECIDE WHAT GOES WHERE) ---
                const {
                    toUpload,
                    toDownload,
                    toUpdateCloud,
                    toUpdateLocal,
                    toDeleteLocally,
                    skippedCount,
                    limitReached,
                    errors: reconciliationErrors
                } = await reconcilePasswords(localPasswords, cloudPasswords, tombstones);


                // --- 5. EXECUTE OPERATIONS ---
                let totalErrors = reconciliationErrors;

                // A. Local Deletions (Zombie Fix)
                if (toDeleteLocally.length > 0) {
                    console.log(`🧹 Cleaning up ${toDeleteLocally.length} locally resurrected items...`);
                    toDeleteLocally.forEach(id => {
                        try { Database.permanentlyDelete(id); }
                        catch (e) { console.error(`Failed to delete local zombie ${id}`, e); }
                    });
                }

                // B. Downloads (Batch)
                if (toDownload.length > 0) {
                    await processBatchDownloads(toDownload);
                }

                // C. Local Updates
                if (toUpdateLocal.length > 0) {
                    console.log(`🔄 Updating ${toUpdateLocal.length} local passwords...`);
                    toUpdateLocal.forEach(({ cloud }) => {
                        Database.upsertPassword(
                            cloud.id, cloud.siteName, cloud.username, cloud.encryptedPassword,
                            cloud.lastModified || cloud.lastUpdated || new Date().toISOString(),
                            cloud.comments, cloud.type, cloud.meta
                        );
                        Database.updateCloudSyncStatus(cloud.id, SyncStatus.SYNCED);
                    });
                }

                // D. Cloud Uploads (Batch)
                const uploadResults = await processBatchUploads(user.uid, toUpload);
                totalErrors += uploadResults.errors;

                // E. Cloud Updates (Batch)
                const updateResults = await processBatchCloudUpdates(user.uid, toUpdateCloud);
                totalErrors += updateResults.errors;

                // F. Tombstones (Cloud Deletion)
                const deleteResults = await processBatchCloudDeletions(user.uid, tombstones);
                totalErrors += deleteResults.errors;


                // --- 6. SAFETY NET: Fix any remaining Status 2 items ---
                // After sync completes, explicitly check for any Status 2 items that exist in cloud
                // and force their status to 1. This catches any edge cases where status wasn't updated.
                try {
                    const finalLocalPasswords = Database.getPasswords();
                    const cloudPasswordIds = new Set(cloudPasswords.map(p => p.id));
                    let fixedCount = 0;

                    for (const localPwd of finalLocalPasswords) {
                        // If local item is Status 2 (Modified) AND it exists in cloud, force status to 1
                        if (localPwd.cloudSynced === SyncStatus.MODIFIED && cloudPasswordIds.has(localPwd.id)) {
                            const changes = Database.updateCloudSyncStatus(localPwd.id, SyncStatus.SYNCED);
                            if (changes > 0) {
                                fixedCount++;
                                console.log(`🔧 [Safety Net] Fixed Status 2 -> 1 for: ${localPwd.siteName}`);
                            }
                        }
                    }

                    if (fixedCount > 0) {
                        console.log(`🔧 [Safety Net] Fixed ${fixedCount} lingering Status 2 items`);
                    }
                } catch (safetyError) {
                    console.warn('⚠️ Safety net check failed:', safetyError.message);
                }


                // --- 7. FINALIZE ---
                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());

                const totalSynced = uploadResults.count + toDownload.length + toUpdateLocal.length + updateResults.count + deleteResults.count;

                console.log(`✅ Sync complete! TotalOps: ${totalSynced}, Errors: ${totalErrors}`);

                return {
                    success: totalErrors === 0,
                    uploaded: uploadResults.count,
                    downloaded: toDownload.length,
                    updatedLocal: toUpdateLocal.length,
                    updatedCloud: updateResults.count,
                    deletedFromCloud: deleteResults.count,
                    total: totalSynced,
                    errors: totalErrors,
                    limitReached: limitReached,
                    skippedCount: skippedCount,
                    message: limitReached
                        ? `Synced ${totalSynced} items (${skippedCount} skipped due to limit)`
                        : (totalErrors > 0 ? `Synced with ${totalErrors} errors` : `Successfully synced`)
                };

            } catch (error) {
                console.error('❌ Error in syncBidirectional:', error);
                return { success: false, error: error.message };
            }
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), SYNC_OVERALL_TIMEOUT))
    ]).finally(() => {
        isSyncing = false;
        syncPromise = null;
    });

    syncPromise = syncOperation;
    return syncOperation;
};

// --- HELPER FUNCTIONS ---

/**
 * Compare lists and decide actions (The "Brain" of the sync)
 */
const reconcilePasswords = async (localPasswords, cloudPasswords, tombstones) => {
    const localMap = new Map(localPasswords.map(p => [p.id, p]));
    const cloudMap = new Map(cloudPasswords.map(p => [p.id, p]));
    const tombstoneMap = new Map(tombstones.map(t => [t.id, t]));

    const toDownload = [];
    const toUpdateLocal = [];
    const toUpdateCloud = [];
    let toUpload = [];
    const toDeleteLocally = [];
    const uploadingIds = new Set();

    // 1. Process Cloud Passwords
    for (const cloudPwd of cloudPasswords) {
        const localPwd = localMap.get(cloudPwd.id);
        const tombstone = tombstoneMap.get(cloudPwd.id);

        if (tombstone) continue; // Will be deleted in tombstone step

        if (!localPwd) {
            toDownload.push(cloudPwd); // Only in Cloud
        } else {
            // In Both - Compare Timestamps
            const cloudTime = new Date(cloudPwd.lastModified || cloudPwd.lastUpdated || 0);
            const localTime = new Date(localPwd.lastModified || 0);

            if (cloudTime > localTime) {
                toUpdateLocal.push({ cloud: cloudPwd, local: localPwd });
            } else if (localTime > cloudTime) {
                // Local is newer - push to cloud
                if (cloudPwd.id) toUpdateCloud.push({ cloud: cloudPwd, local: localPwd });
            } else {
                // Timestamps equal - but check if local is marked as "Modified" (Status 2)
                // This handles the edge case where data was synced but local status wasn't updated
                if (localPwd.cloudSynced === SyncStatus.MODIFIED && cloudPwd.id) {
                    console.log(`🔄 [Sync] Status 2 item with equal timestamps detected: ${localPwd.siteName}. Re-syncing to fix status.`);
                    toUpdateCloud.push({ cloud: cloudPwd, local: localPwd });
                }
            }
        }
    }

    // 2. Process Local Passwords
    for (const localPwd of localPasswords) {
        if (!cloudMap.has(localPwd.id)) {
            // CRITICAL: Zombie Resurrection Fix
            // If it thinks it's synced (1) or Modified (2) but NOT in cloudMap => It was deleted on another device
            if (localPwd.cloudSynced === SyncStatus.SYNCED || localPwd.cloudSynced === SyncStatus.MODIFIED) {
                toDeleteLocally.push(localPwd.id);
            } else {
                // cloudSynced == LOCAL_ONLY (New/Local Only)
                if (!uploadingIds.has(localPwd.id)) {
                    toUpload.push(localPwd);
                    uploadingIds.add(localPwd.id);
                }
            }
        }
    }

    // 3. Limit Check
    let cloudLimit = 0;
    try { cloudLimit = await getCloudPasswordLimit(); } catch (e) { cloudLimit = 0; }

    const currentCloudCount = cloudPasswords.length;
    const availableSpace = cloudLimit - currentCloudCount;
    let skippedCount = 0;
    let limitReached = false;

    // Prioritize oldest uploads first
    toUpload.sort((a, b) => new Date(a.lastModified || 0) - new Date(b.lastModified || 0));

    if (toUpload.length > availableSpace) {
        if (availableSpace <= 0) {
            skippedCount = toUpload.length;
            toUpload = [];
        } else {
            skippedCount = toUpload.length - availableSpace;
            toUpload = toUpload.slice(0, availableSpace);
        }
        limitReached = true;
        console.warn(`⚠️ Limit reached. Skipped ${skippedCount} uploads.`);
    }

    return { toUpload, toDownload, toUpdateCloud, toUpdateLocal, toDeleteLocally, skippedCount, limitReached, errors: 0 };
};


/**
 * Helpers for Batch Operations
 */
const ensureSaltIntegrity = async (uid) => {
    try {
        const integrity = await verifySaltIntegrity(uid);
        if (integrity?.requiresReEncryption) {
            console.log('🔄 Re-encrypting for salt integrity...');
            await reEncryptAllPasswords(uid);
        }
    } catch (e) {
        console.warn('⚠️ Salt integrity check failed (non-critical):', e);
    }
};

const processBatchDownloads = async (items) => {
    try {
        console.log(`📥 Downloading ${items.length} items...`);
        const newEntries = items.map(p => ({
            id: p.id,
            siteName: p.siteName || 'Untitled',
            username: p.username || '',
            encryptedPassword: p.encryptedPassword || '',
            lastModified: p.lastModified || p.lastUpdated || new Date().toISOString(),
            comments: p.comments || '',
            cloudSynced: SyncStatus.SYNCED,
            type: p.type || 'password',
            meta: p.meta || ''
        }));
        Database.addPasswordsBatch(newEntries);
    } catch (err) {
        console.error('❌ Batch download failed:', err);
    }
};

const processBatchUploads = async (userId, items) => {
    const BATCH_SIZE = 50;
    let count = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(pwd =>
            FirestoreService.savePassword(userId, {
                ...pwd, id: pwd.id, lastModified: pwd.lastModified
            })
        ));

        for (let j = 0; j < results.length; j++) {
            const res = results[j];
            const pwd = batch[j];

            if (res.status === 'fulfilled' && res.value.success) {
                count++;
                // Explicitly mark as synced in local DB
                const changes = Database.updateCloudSyncStatus(pwd.id, SyncStatus.SYNCED);
                if (changes > 0) {
                    console.log(`✅ [Sync] Uploaded & marked synced: ${pwd.siteName}`);
                } else {
                    console.warn(`⚠️ [Sync] Uploaded but LOCAL sync status failed for: ${pwd.siteName} (ID: ${pwd.id})`);
                }
            } else {
                errors++;
                console.error(`❌ Upload failed: ${pwd.siteName}`, res.value?.error || res.reason);
            }
        }
    }
    return { count, errors };
};

const processBatchCloudUpdates = async (userId, items) => {
    const BATCH_SIZE = 50;
    let count = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(({ cloud, local }) =>
            FirestoreService.updatePassword(userId, cloud.id, {
                ...local, lastModified: local.lastModified
            })
        ));

        for (let j = 0; j < results.length; j++) {
            const res = results[j];
            const item = batch[j];

            if (res.status === 'fulfilled' && res.value.success) {
                count++;
                // Explicitly mark as synced in local DB
                const changes = Database.updateCloudSyncStatus(item.local.id, SyncStatus.SYNCED);
                if (changes > 0) {
                    console.log(`✅ [Sync] Updated cloud & marked local synced: ${item.local.siteName}`);
                } else {
                    console.warn(`⚠️ [Sync] Cloud updated but LOCAL sync status failed for: ${item.local.siteName} (ID: ${item.local.id})`);
                }
            } else {
                errors++;
                console.error(`❌ Cloud update failed: ${item.local.siteName}`, res.value?.error || res.reason);
            }
        }
    }
    return { count, errors };
};

const processBatchCloudDeletions = async (userId, tombstones) => {
    if (tombstones.length === 0) return { count: 0, errors: 0 };

    const BATCH_SIZE = 50;
    let count = 0;
    let errors = 0;

    for (let i = 0; i < tombstones.length; i += BATCH_SIZE) {
        const batch = tombstones.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(t =>
            FirestoreService.deletePassword(userId, t.id)
        ));

        results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value.success) {
                count++;
                Database.permanentlyDelete(batch[idx].id);
            } else {
                errors++;
            }
        });
    }
    return { count, errors };
};

/**
 * Legacy function - now calls syncBidirectional
 * Kept for backward compatibility
 */
export const syncToCloud = async () => {
    return await syncBidirectional();
};

/**
 * Sync passwords from cloud to local DB
 */
export const syncFromCloud = async () => {
    try {
        const cloudEnabled = await isCloudSyncEnabled();
        if (!cloudEnabled) {
            return { success: false, error: 'Cloud sync not enabled' };
        }

        const user = getCurrentUser();
        const result = await FirestoreService.getPasswords(user.uid);

        if (!result.success) {
            return result;
        }

        // Merge cloud passwords with local
        // This is a simple implementation - could be improved with conflict resolution
        for (const cloudPassword of result.passwords) {
            try {
                // Ensure all required fields have values
                const siteName = cloudPassword.siteName || 'Untitled';
                const username = cloudPassword.username || '';
                const encryptedPassword = cloudPassword.encryptedPassword || '';
                const comments = cloudPassword.comments || '';
                const lastModified = cloudPassword.lastModified || cloudPassword.lastUpdated || cloudPassword.updatedAt || new Date().toISOString();

                const localId = cloudPassword.id; // Use UUID
                if (localId) {
                    // Check if it exists locally (using upsert logic)
                    // Since we use UUIDs, we can just try to add it with the ID
                    // But Database.addPassword might fail if ID exists, so we should check or use upsert
                    // For now, let's assume we use addPassword with ID, and if it fails, we update
                    // Actually, Database.addPassword with ID uses INSERT, so it will fail if exists.
                    // Let's use upsertPassword from Database if available, or check existence.
                    // Given the context, let's use upsertPassword which handles both.

                    Database.upsertPassword(
                        localId,
                        siteName,
                        username,
                        encryptedPassword,
                        lastModified,
                        comments
                    );
                } else {
                    // Should not happen with UUIDs, but fallback
                    await Database.addPassword(siteName, username, encryptedPassword, comments);
                }
            } catch (err) {
                console.error('Error syncing individual password:', err);
                // Continue with other passwords even if one fails
            }
        }

        // Update last sync time
        await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());

        return { success: true, count: result.passwords.length };
    } catch (error) {
        console.error('Error in syncFromCloud:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get last sync time
 */
export const getLastSyncTime = async () => {
    try {
        const time = await SecureStore.getItemAsync('LAST_SYNC_TIME');
        return time;
    } catch (error) {
        return null;
    }
};


