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
        // Extract fields for Database.addPassword
        const siteName = passwordData.siteName || 'Untitled';
        const username = passwordData.username || '';
        const encryptedPassword = passwordData.encryptedPassword || '';
        const comments = passwordData.comments || '';

        // Check network status first
        const netState = await NetInfo.fetch();
        const isOffline = !netState.isConnected;

        // If cloud sync is enabled, check limit before saving
        const cloudEnabled = await isCloudSyncEnabled();
        let cloudUploadSkipped = false;
        let cloudSynced = 0; // Default: NOT synced (Yellow) - Safer default
        let isOfflineMode = false;

        if (cloudEnabled && !isOffline) {
            const user = getCurrentUser();

            try {
                // Check limit before uploading
                const cloudLimit = await getCloudPasswordLimit();
                const cloudResult = await FirestoreService.getPasswords(user.uid);
                const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                if (currentCloudCount >= cloudLimit) {
                    console.log(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Saving locally only.`);
                    cloudUploadSkipped = true;
                    // cloudSynced is already 0
                }
            } catch (error) {
                // If network error occurs while checking, treat as offline
                if (error.code === 'unavailable' ||
                    error.message?.includes('network') ||
                    error.message?.includes('timeout') ||
                    error.message?.includes('Cannot fetch limit')) {
                    console.log('⚠️ Network error while checking cloud limit, treating as offline');
                    isOfflineMode = true;
                } else {
                    throw error;
                }
            }
        } else if (cloudEnabled && isOffline) {
            isOfflineMode = true;
            console.log('📱 Device is offline, saving locally only');
        }

        // Always save to local database first (with sync status)
        const { id, lastModified } = Database.addPassword(siteName, username, encryptedPassword, comments, cloudSynced);

        let uploadedToCloud = false;

        // Upload to cloud if enabled, limit not reached, and online
        if (cloudEnabled && !cloudUploadSkipped && !isOffline && !isOfflineMode) {
            try {
                const user = getCurrentUser();
                const saveResult = await FirestoreService.savePassword(user.uid, {
                    ...passwordData,
                    lastModified, // Use the exact timestamp from local DB
                    id: id // Use UUID
                });

                if (saveResult.success) {
                    // Mark as synced in local DB
                    Database.updateCloudSyncStatus(id, 1);

                    // Update last sync time
                    await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
                    uploadedToCloud = true;
                }
            } catch (error) {
                // If network error occurs during upload, treat as offline
                if (error.code === 'unavailable' || error.message?.includes('network') || error.message?.includes('timeout')) {
                    console.log('⚠️ Network error during upload, password saved locally');
                    isOfflineMode = true;
                } else {
                    throw error;
                }
            }
        }

        return {
            success: true,
            id,
            warning: cloudUploadSkipped ? 'Cloud limit reached. Password saved locally only.' : null,
            synced: uploadedToCloud,
            isOffline: isOfflineMode || isOffline
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

        // Check network status first
        const netState = await NetInfo.fetch();
        const isOffline = !netState.isConnected;

        // Always update local database first (fast operation)
        const { lastModified } = Database.updatePassword(id, siteName, username, encryptedPassword, comments);

        let uploadedToCloud = false;
        let limitReached = false;
        let isOfflineMode = false;

        // If cloud sync is enabled, also update in Firestore
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled && !isOffline) {
            try {
                const user = getCurrentUser();

                // Try to update, but if document doesn't exist, create it (upsert behavior)
                const updateResult = await FirestoreService.updatePassword(user.uid, id, {
                    ...passwordData,
                    lastModified // Use the exact timestamp from local DB
                });

                // EDGE CASE: If update failed because document doesn't exist in cloud,
                // this means it's a local-only password that was never synced.
                // We must check limit before creating it as a new document.
                if (!updateResult.success && updateResult.error?.includes('No document to update')) {
                    try {
                        // CRITICAL: Check cloud limit before creating new document
                        // This prevents creating new passwords when limit is reached
                        const cloudLimit = await getCloudPasswordLimit();
                        const cloudResult = await FirestoreService.getPasswords(user.uid);
                        const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

                        if (currentCloudCount >= cloudLimit) {
                            console.log(`⚠️ Cannot create document - limit reached (${currentCloudCount}/${cloudLimit})`);
                            console.log(`ℹ️ Password updated locally only. It will remain unsynced until limit is freed.`);
                            // Don't upload, keep as unsynced
                            uploadedToCloud = false;
                            limitReached = true;
                        } else {
                            console.log(`⚠️ Document doesn't exist in cloud, creating it (${currentCloudCount + 1}/${cloudLimit})`);
                            const saveResult = await FirestoreService.savePassword(user.uid, {
                                id: id,
                                ...passwordData,
                                lastModified
                            });
                            if (saveResult.success) {
                                uploadedToCloud = true;
                            }
                        }
                    } catch (error) {
                        // If network error occurs while checking, treat as offline
                        if (error.code === 'unavailable' ||
                            error.message?.includes('network') ||
                            error.message?.includes('timeout') ||
                            error.message?.includes('Cannot fetch limit')) {
                            console.log('⚠️ Network error while checking cloud limit, treating as offline');
                            isOfflineMode = true;
                        } else {
                            throw error;
                        }
                    }
                } else if (updateResult.success) {
                    uploadedToCloud = true;
                }
            } catch (error) {
                // If network error occurs during update, treat as offline
                if (error.code === 'unavailable' || error.message?.includes('network') || error.message?.includes('timeout')) {
                    console.log('⚠️ Network error during update, password updated locally');
                    isOfflineMode = true;
                } else {
                    throw error;
                }
            }

            if (uploadedToCloud) {
                // Ensure it's marked as synced
                Database.updateCloudSyncStatus(id, 1);

                // Update last sync time
                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
            }
        } else if (cloudEnabled && isOffline) {
            isOfflineMode = true;
            console.log('📱 Device is offline, updating locally only');
        }

        if (!uploadedToCloud) {
            // Mark as unsynced (Yellow) because we changed it locally but not in cloud
            Database.updateCloudSyncStatus(id, 0);
        }

        return { success: true, synced: uploadedToCloud, limitReached, isOffline: isOfflineMode || isOffline };
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
    const SYNC_OVERALL_TIMEOUT = 30000; // 30 seconds total

    const syncOperation = Promise.race([
        (async () => {
            try {
                const cloudEnabled = await isCloudSyncEnabled();

                if (!cloudEnabled) {
                    return { success: false, error: 'Cloud sync not enabled' };
                }

                const user = getCurrentUser();

                if (!user) {
                    return { success: false, error: 'User not authenticated' };
                }

                // Check network status before attempting sync (with timeout to prevent hanging)
                let netState;
                try {
                    netState = await Promise.race([
                        NetInfo.fetch(),
                        new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Network check timeout')), 5000); // 5 second timeout
                        })
                    ]);
                } catch (netError) {
                    console.warn('⚠️ Network check failed or timed out:', netError.message);
                    return { success: false, error: 'Network check failed. Please try again.' };
                }

                if (!netState.isConnected || !netState.isInternetReachable) {
                    return { success: false, error: 'No internet connection. Please check your network and try again.' };
                }

                console.log('🔄 Starting bidirectional sync...');

                // Step 0: Verify Salt Integrity (Cloud Authority)
                // This replaces syncTemporarySalt and handles Split-Brain scenarios
                try {
                    // Check logic handles frequency (once per session) internally
                    const saltIntegrityResult = await verifySaltIntegrity(user.uid);

                    // If salt conflict detected, re-encrypt local entries
                    if (saltIntegrityResult && saltIntegrityResult.requiresReEncryption) {
                        console.log('🔄 Salt conflict detected, re-encrypting local entries...');
                        const reEncryptResult = await reEncryptAllPasswords(user.uid);

                        if (reEncryptResult.success) {
                            // console.log(`✅ Re-encrypted ${reEncryptResult.reEncryptedCount} local passwords with cloud salt`);
                            if (reEncryptResult.failedCount > 0) {
                                console.warn(`⚠️ ${reEncryptResult.failedCount} passwords could not be re-encrypted`);
                            }
                        } else {
                            console.error('❌ Failed to re-encrypt passwords:', reEncryptResult.error);
                            // Continue with sync - some entries might still work
                        }
                    }

                    /* LEGACY MIGRATION REMOVED (Handled by verifySaltIntegrity now)
                    // Check for local-to-cloud salt migration (when user enables cloud sync after creating local entries)
                    const { migrateLocalToCloudSalt } = await import('./SaltMigrationService');
                    const migrationResult = await migrateLocalToCloudSalt();
                    if (migrationResult.migrated) {
                        console.log(`✅ Migrated ${migrationResult.reEncryptedCount || 0} local passwords to cloud salt`);
                    }
                    */

                    // Ensure salt exists in Firestore (auto-create if missing)
                    try {
                        const saltCheck = await getUserSalt(false);
                        if (!saltCheck.success) {
                            console.log('⚠️ Salt check failed, will retry...');
                        }
                    } catch (saltCheckError) {
                        console.warn('⚠️ Salt check error (non-critical):', saltCheckError);
                    }

                } catch (saltError) {
                    console.warn('⚠️ Failed to ensure salt integrity (non-critical):', saltError);
                    // Don't fail the entire sync if salt check fails
                }

                // Step 1: Fetch both datasets
                const localPasswords = Database.getPasswords();
                const tombstones = Database.getDeletedPasswords(); // Get deleted passwords (tombstones)

                // DEBUG: Log local passwords with their IDs
                console.log('🔍 DEBUG: Local passwords fetched:', localPasswords.length);
                console.log('🔍 DEBUG: Tombstones found:', tombstones.length);
                const localIdCounts = {};
                localPasswords.forEach(pwd => {
                    localIdCounts[pwd.id] = (localIdCounts[pwd.id] || 0) + 1;
                });
                const duplicateLocalIds = Object.entries(localIdCounts).filter(([id, count]) => count > 1);
                if (duplicateLocalIds.length > 0) {
                    console.error('🚨 DUPLICATE LOCAL IDs DETECTED:', duplicateLocalIds);
                }

                const cloudResult = await FirestoreService.getPasswords(user.uid);

                if (!cloudResult.success) {
                    return { success: false, error: cloudResult.error };
                }

                const cloudPasswords = cloudResult.passwords || [];

                console.log(`📊 Local: ${localPasswords.length}, Cloud: ${cloudPasswords.length}, Tombstones: ${tombstones.length}`);

                // OPTIMIZATION 1: Create hash maps for O(1) lookups instead of O(n)
                const localMap = new Map(localPasswords.map(p => [p.id, p]));
                const cloudMap = new Map(cloudPasswords.map(p => [p.id, p]));
                const tombstoneMap = new Map(tombstones.map(t => [t.id, t])); // Map of deleted passwords

                // Collect operations to batch
                let toUpload = [];
                const toDownload = [];
                const toUpdateCloud = [];
                const toUpdateLocal = [];

                // CRITICAL FIX: Track which IDs we're uploading to prevent duplicates
                const uploadingIds = new Set();

                // Step 2: Process cloud passwords (O(n) instead of O(n²))
                for (const cloudPwd of cloudPasswords) {
                    // Match by ID (UUID)
                    const localPwd = localMap.get(cloudPwd.id);
                    const tombstone = tombstoneMap.get(cloudPwd.id);

                    if (tombstone) {
                        // Case E: Exists in cloud but deleted locally (tombstone) → Delete from cloud
                        // This will be handled in Step 4 (tombstone processing)
                        // Skip here to avoid downloading
                        console.log(`🗑️ Skipping ${cloudPwd.siteName} - marked as deleted locally (tombstone)`);
                        continue;
                    }

                    if (!localPwd) {
                        // Case B: Only in cloud → Download to local
                        toDownload.push(cloudPwd);
                    } else {
                        // Case A: Exists in both → Compare timestamps
                        // Use lastModified from cloud if available, otherwise fallback to Firestore timestamps
                        const cloudTime = new Date(cloudPwd.lastModified || cloudPwd.lastUpdated || cloudPwd.updatedAt || cloudPwd.createdAt || 0);
                        const localTime = new Date(localPwd.lastModified || 0);

                        if (cloudTime > localTime) {
                            // Cloud is newer → Update local
                            toUpdateLocal.push({ cloud: cloudPwd, local: localPwd });
                        } else if (localTime > cloudTime) {
                            // Local is newer → Update cloud
                            if (cloudPwd.id) {
                                toUpdateCloud.push({ cloud: cloudPwd, local: localPwd });
                            } else {
                                console.warn(`⚠️ Skipping cloud update for ${cloudPwd.siteName}: Missing cloud ID`);
                            }
                        }
                        // If timestamps are equal, no action needed
                    }
                }

                // Step 3: Process local passwords (find local-only items) - O(n)
                for (const localPwd of localPasswords) {
                    if (!cloudMap.has(localPwd.id)) {
                        // Case D: Only in local → Upload to cloud
                        // CRITICAL FIX: Check if we're already uploading this ID
                        if (!uploadingIds.has(localPwd.id)) {
                            toUpload.push(localPwd);
                            uploadingIds.add(localPwd.id);
                        } else {
                            console.warn(`⚠️ Duplicate upload prevented for ${localPwd.siteName} (ID: ${localPwd.id})`);
                        }
                    }
                    // If exists in both, already handled in Step 2
                }

                console.log(`📤 To upload: ${toUpload.length}`);
                console.log(`📥 To download: ${toDownload.length}`);
                console.log(`🔄 To update local: ${toUpdateLocal.length}`);
                console.log(`🔄 To update cloud: ${toUpdateCloud.length}`);

                // DEBUG: Log toUpload array contents
                if (toUpload.length > 0) {
                    console.log('🔍 DEBUG: Passwords to upload:');
                    toUpload.forEach((pwd, index) => {
                        console.log(`  [${index}] localId: ${pwd.id}, siteName: ${pwd.siteName}, cloudSynced: ${pwd.cloudSynced}`);
                    });

                    // Check for duplicates in toUpload array
                    const uploadLocalIds = toUpload.map(p => p.id);
                    const uploadDuplicates = uploadLocalIds.filter((id, index) => uploadLocalIds.indexOf(id) !== index);
                    if (uploadDuplicates.length > 0) {
                        console.error('🚨 DUPLICATES IN UPLOAD QUEUE:', uploadDuplicates);
                    }
                }

                // CRITICAL: Check cloud password limit BEFORE uploading NEW local-only passwords
                // NOTE: Updates to existing cloud passwords (toUpdateCloud) are NOT blocked by limit
                // because updates don't create new documents - they modify existing ones
                let cloudLimit;
                try {
                    cloudLimit = await getCloudPasswordLimit();
                } catch (limitError) {
                    // If limit fetch fails, try cached value
                    const cachedLimit = await SecureStore.getItemAsync('CLOUD_PASSWORD_LIMIT');
                    if (cachedLimit) {
                        cloudLimit = parseInt(cachedLimit, 10);
                        console.log('📱 Using cached limit for sync:', cloudLimit);
                    } else {
                        // No limit available - skip uploads but allow updates
                        console.warn('⚠️ Cannot fetch limit, skipping new uploads but allowing updates');
                        cloudLimit = 0; // Prevent new uploads
                    }
                }
                const currentCloudCount = cloudPasswords.length;
                const availableSpace = cloudLimit - currentCloudCount;
                let uploadSkipped = false;
                let skippedCount = 0;

                // Sort toUpload by lastModified (oldest first) to prioritize earlier entries
                toUpload.sort((a, b) => {
                    const timeA = new Date(a.lastModified || 0).getTime();
                    const timeB = new Date(b.lastModified || 0).getTime();
                    return timeA - timeB;
                });

                // If we have more entries than available space, only upload what fits
                if (toUpload.length > availableSpace) {
                    skippedCount = toUpload.length - availableSpace;
                    console.warn(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Uploading ${availableSpace} of ${toUpload.length} NEW entries. ${skippedCount} will remain unsynced.`);
                    console.warn(`ℹ️ Updates to existing cloud passwords will still proceed (they don't count against limit)`);
                    toUpload = toUpload.slice(0, availableSpace);
                    uploadSkipped = skippedCount > 0;
                } else if (availableSpace <= 0) {
                    // No space available at all - block ALL new uploads
                    skippedCount = toUpload.length;
                    console.warn(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Skipping all ${toUpload.length} NEW uploads.`);
                    console.warn(`ℹ️ Updates to existing cloud passwords will still proceed (they don't count against limit)`);
                    toUpload = [];
                    uploadSkipped = true;
                }
                // OPTIMIZATION 2: Execute local operations synchronously (fast)
                // Download new passwords
                for (const cloudPwd of toDownload) {
                    try {
                        // Use the UUID from cloud
                        const { id } = Database.addPassword(
                            cloudPwd.siteName || 'Untitled',
                            cloudPwd.username || '',
                            cloudPwd.encryptedPassword || '',
                            cloudPwd.comments || '',
                            1, // Mark as synced
                            cloudPwd.id // Pass the UUID
                        );
                    } catch (err) {
                        console.error(`❌ Error downloading ${cloudPwd.siteName}:`, err);
                    }
                }

                // Update local passwords
                for (const { cloud, local } of toUpdateLocal) {
                    try {
                        Database.updatePassword(
                            local.id,
                            cloud.siteName || 'Untitled',
                            cloud.username || '',
                            cloud.encryptedPassword || '',
                            cloud.comments || ''
                        );
                    } catch (err) {
                        console.error(`❌ Error updating local ${cloud.siteName}:`, err);
                    }
                }

                // OPTIMIZATION 3: Execute cloud operations in parallel batches
                const BATCH_SIZE = 50; // Process 50 at a time
                let uploadedCount = 0;
                let updatedCloudCount = 0;
                let errorCount = 0;

                // Upload new passwords in batches
                for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
                    const batch = toUpload.slice(i, i + BATCH_SIZE);

                    // DEBUG: Log batch upload details
                    console.log(`🔍 DEBUG: Uploading batch ${Math.floor(i / BATCH_SIZE) + 1}, size: ${batch.length}`);
                    batch.forEach((pwd, idx) => {
                        console.log(`  Batch[${idx}] localId: ${pwd.id}, siteName: ${pwd.siteName}`);
                    });

                    const results = await Promise.allSettled(
                        batch.map((pwd, batchIndex) => {
                            console.log(`📤 Uploading: ${pwd.siteName} (localId: ${pwd.id})`);
                            return FirestoreService.savePassword(user.uid, {
                                siteName: pwd.siteName,
                                username: pwd.username,
                                encryptedPassword: pwd.encryptedPassword,
                                comments: pwd.comments,
                                lastModified: pwd.lastModified,
                                id: pwd.id // Use UUID
                            });
                        })
                    );

                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled' && result.value.success) {
                            uploadedCount++;
                            console.log(`✅ Uploaded: ${batch[index].siteName} (localId: ${batch[index].id}) → Firestore ID: ${result.value.id}`);

                            // CRITICAL FIX: Update local sync status so yellow highlight disappears
                            Database.updateCloudSyncStatus(batch[index].id, 1);
                        } else {
                            errorCount++;
                            const errorMsg = result.status === 'rejected' ? result.reason : result.value.error;
                            console.error(`❌ Failed to upload ${batch[index].siteName} (localId: ${batch[index].id}):`, errorMsg);
                        }
                    });
                }

                // Update cloud passwords in batches
                // CRITICAL: These are updates to EXISTING cloud passwords (matched by ID in cloudMap)
                // Updates do NOT create new documents, so they are NOT blocked by cloud limit
                // This ensures already-synced passwords can still be updated even when limit is reached
                for (let i = 0; i < toUpdateCloud.length; i += BATCH_SIZE) {
                    const batch = toUpdateCloud.slice(i, i + BATCH_SIZE);
                    const results = await Promise.allSettled(
                        batch.map(({ cloud, local }) => {
                            // Verify document exists in cloud before updating
                            if (!cloudMap.has(local.id)) {
                                console.warn(`⚠️ Password ${local.siteName} (${local.id}) not found in cloud map, skipping update`);
                                return Promise.resolve({ success: false, error: 'Not in cloud map' });
                            }
                            return FirestoreService.updatePassword(user.uid, cloud.id, {
                                siteName: local.siteName,
                                username: local.username,
                                encryptedPassword: local.encryptedPassword,
                                comments: local.comments,
                                lastModified: local.lastModified
                            });
                        })
                    );

                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled' && result.value.success) {
                            updatedCloudCount++;
                            console.log(`✅ Updated cloud: ${batch[index].local.siteName} (ID: ${batch[index].cloud.id})`);
                        } else {
                            errorCount++;
                            const errorMsg = result.status === 'rejected' ? result.reason : result.value.error;
                            console.error(`❌ Failed to update cloud ${batch[index].local.siteName}:`, errorMsg);
                            // Note: If update fails because document doesn't exist, it won't be created
                            // This is correct - we only update existing documents in sync
                        }
                    });
                }

                // Step 4: Process tombstones (deleted passwords) - delete from cloud
                // Note: tombstones were already fetched in Step 1
                // OPTIMIZATION: Skip tombstone processing if none exist (no network calls)
                let deletedFromCloudCount = 0;
                const toPermanentlyDelete = [];

                if (tombstones.length > 0) {
                    console.log(`🗑️ Processing ${tombstones.length} tombstones (deleted passwords) to sync`);
                    // CRITICAL: Tombstones (deletions) are processed regardless of cloud limit
                    // Deletions don't create new documents, they remove existing ones
                    // This is correct behavior - we should always sync deletions

                    // Delete tombstones from cloud in batches
                    for (let i = 0; i < tombstones.length; i += BATCH_SIZE) {
                        const batch = tombstones.slice(i, i + BATCH_SIZE);
                        const deleteResults = await Promise.allSettled(
                            batch.map((tombstone) => {
                                console.log(`🗑️ Deleting from cloud: ${tombstone.siteName} (ID: ${tombstone.id})`);
                                return FirestoreService.deletePassword(user.uid, tombstone.id);
                            })
                        );

                        deleteResults.forEach((result, index) => {
                            const tombstone = batch[index];
                            if (result.status === 'fulfilled' && result.value.success) {
                                deletedFromCloudCount++;
                                // Mark tombstone for permanent deletion
                                toPermanentlyDelete.push(tombstone.id);
                                console.log(`✅ Deleted from cloud: ${tombstone.siteName} (ID: ${tombstone.id})`);
                            } else {
                                errorCount++;
                                const errorMsg = result.status === 'rejected' ? result.reason : result.value.error;
                                console.error(`❌ Failed to delete tombstone ${tombstone.siteName} from cloud:`, errorMsg);
                                // Keep tombstone for next sync attempt
                            }
                        });
                    }

                    // Permanently remove tombstones that were successfully deleted from cloud
                    for (const id of toPermanentlyDelete) {
                        try {
                            Database.permanentlyDelete(id);
                            console.log(`🧹 Permanently removed tombstone: ${id}`);
                        } catch (err) {
                            console.error(`❌ Error permanently deleting tombstone ${id}:`, err);
                        }
                    }
                } else {
                    console.log('📭 No tombstones to process');
                }

                // Update last sync time
                await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());

                const totalSynced = uploadedCount + toDownload.length + toUpdateLocal.length + updatedCloudCount + deletedFromCloudCount;

                console.log(`✅ Sync complete! Total: ${totalSynced}, Errors: ${errorCount}`);
                console.log(`   - Uploaded: ${uploadedCount}`);
                console.log(`   - Downloaded: ${toDownload.length}`);
                console.log(`   - Updated local: ${toUpdateLocal.length}`);
                console.log(`   - Updated cloud: ${updatedCloudCount}`);
                console.log(`   - Deleted from cloud: ${deletedFromCloudCount}`);

                return {
                    success: errorCount === 0,
                    uploaded: uploadedCount,
                    downloaded: toDownload.length,
                    updatedLocal: toUpdateLocal.length,
                    updatedCloud: updatedCloudCount,
                    deletedFromCloud: deletedFromCloudCount,
                    total: totalSynced,
                    errors: errorCount,
                    limitReached: uploadSkipped,
                    skippedCount: skippedCount || 0,
                    message: uploadSkipped
                        ? (skippedCount > 0
                            ? `Synced ${totalSynced} passwords (${skippedCount} skipped due to limit: ${currentCloudCount + uploadedCount}/${cloudLimit})`
                            : `Synced ${totalSynced} passwords (Uploads skipped: Limit reached)`)
                        : (errorCount > 0
                            ? `Synced ${totalSynced} passwords with ${errorCount} errors`
                            : `Successfully synced ${totalSynced} passwords`)
                };
            } catch (error) {
                console.error('❌ Error in syncBidirectional:', error);

                // Handle timeout specifically
                if (error.message?.includes('timed out')) {
                    console.warn('⏰ Sync operation timed out - likely network issue after idle');
                    return { success: false, error: 'Sync timed out. Please check your network connection.' };
                }

                return { success: false, error: error.message };
            }
        })(),
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Sync operation timed out after ${SYNC_OVERALL_TIMEOUT}ms`));
            }, SYNC_OVERALL_TIMEOUT);
        })
    ]).finally(() => {
        // Always clear sync lock when done (success, error, or timeout)
        isSyncing = false;
        syncPromise = null;
    });

    // Store the promise so concurrent calls can return it
    syncPromise = syncOperation;
    return syncOperation;
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


