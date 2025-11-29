import * as Database from './Database';
import * as FirestoreService from './FirestoreService';
import { getCurrentUser, signInAnonymouslyUser } from './FirebaseAuthService';
import * as SecureStore from 'expo-secure-store';
import { AppConfig } from '../config/AppConfig';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase.config';

// EXPLICITLY get the named database instance to ensure we aren't using default
const firestore = getFirestore(app, 'keyvault-pro-india');

/**
 * Get cloud password limit from Firestore config
 */
export const getCloudPasswordLimit = async () => {
    try {
        const configRef = doc(firestore, AppConfig.CONFIG_COLLECTION, AppConfig.CONFIG_DOC_ID);
        console.log(`🔍 Fetching limit from: ${AppConfig.CONFIG_COLLECTION}/${AppConfig.CONFIG_DOC_ID}`);

        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            console.log('✅ Cloud limit fetched successfully:', data);
            const limit = data.maxCloudPasswords || AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT;

            // Cache the limit for offline use
            await SecureStore.setItemAsync('CLOUD_PASSWORD_LIMIT', String(limit));
            return limit;
        }

        console.log('⚠️ Config document does not exist at path:', configRef.path);
    } catch (error) {
        console.log('❌ Error fetching cloud limit:', error);
        if (error.code === 'permission-denied') {
            console.log('🛑 Permission denied. Check Firestore Security Rules.');
            console.log('💡 Ensure rules allow read access to "config/limits" for request.auth != null');
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

    // Final fallback
    return AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT;
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

        // If cloud sync is enabled, check limit before saving
        const cloudEnabled = await isCloudSyncEnabled();
        let cloudUploadSkipped = false;
        let cloudSynced = 1; // Default: synced

        if (cloudEnabled) {
            const user = getCurrentUser();

            // Check limit before uploading
            const cloudLimit = await getCloudPasswordLimit();
            const cloudResult = await FirestoreService.getPasswords(user.uid);
            const currentCloudCount = cloudResult.success ? (cloudResult.passwords || []).length : 0;

            if (currentCloudCount >= cloudLimit) {
                console.log(`⚠️ Cloud limit reached (${currentCloudCount}/${cloudLimit}). Saving locally only.`);
                cloudUploadSkipped = true;
                cloudSynced = 0; // Mark as not synced
            }
        }

        // Always save to local database first (with sync status)
        const { id, lastModified } = Database.addPassword(siteName, username, encryptedPassword, comments, cloudSynced);

        // Upload to cloud if enabled and limit not reached
        if (cloudEnabled && !cloudUploadSkipped) {
            const user = getCurrentUser();
            await FirestoreService.savePassword(user.uid, {
                ...passwordData,
                lastModified, // Use the exact timestamp from local DB
                localId: id // Store local ID for reference
            });

            // Update last sync time
            await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
        }

        return {
            success: true,
            id,
            warning: cloudUploadSkipped ? 'Cloud limit reached. Password saved locally only.' : null
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

        // Always update local database
        const { lastModified } = Database.updatePassword(id, siteName, username, encryptedPassword, comments);

        // If cloud sync is enabled, also update in Firestore
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled) {
            const user = getCurrentUser();
            // Find the Firestore ID for this local ID
            const firestoreId = await getFirestoreIdForLocalId(user.uid, id);
            if (firestoreId) {
                await FirestoreService.updatePassword(user.uid, firestoreId, {
                    ...passwordData,
                    lastModified // Use the exact timestamp from local DB
                });
            }

            // Update last sync time
            await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
        }

        return { success: true };
    } catch (error) {
        console.error('Error in updatePassword:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete password from local DB and optionally from Firestore
 */
export const deletePassword = async (id) => {
    try {
        // If cloud sync is enabled, delete from Firestore first
        const cloudEnabled = await isCloudSyncEnabled();
        if (cloudEnabled) {
            const user = getCurrentUser();
            if (user) {
                const firestoreId = await getFirestoreIdForLocalId(user.uid, id);
                if (firestoreId && typeof firestoreId === 'string') {
                    const result = await FirestoreService.deletePassword(user.uid, firestoreId);
                    if (!result.success) {
                        console.warn('Failed to delete from Firestore:', result.error);
                    }
                } else {
                    console.log('No Firestore ID found for local ID:', id);
                }
            }
        }

        // Always delete from local database
        Database.deletePassword(id);

        if (cloudEnabled) {
            // Update last sync time
            await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());
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
 */
export const syncBidirectional = async () => {
    try {
        const cloudEnabled = await isCloudSyncEnabled();

        if (!cloudEnabled) {
            return { success: false, error: 'Cloud sync not enabled' };
        }

        const user = getCurrentUser();

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        console.log('🔄 Starting bidirectional sync...');

        // Step 1: Fetch both datasets
        const localPasswords = Database.getPasswords();
        const cloudResult = await FirestoreService.getPasswords(user.uid);

        if (!cloudResult.success) {
            return { success: false, error: cloudResult.error };
        }

        const cloudPasswords = cloudResult.passwords || [];

        console.log(`📊 Local: ${localPasswords.length}, Cloud: ${cloudPasswords.length}`);

        // OPTIMIZATION 1: Create hash maps for O(1) lookups instead of O(n)
        const localMap = new Map(localPasswords.map(p => [p.id, p]));
        const cloudMap = new Map(cloudPasswords.map(p => [p.localId, p]));

        // Collect operations to batch
        const toUpload = [];
        const toDownload = [];
        const toUpdateCloud = [];
        const toUpdateLocal = [];

        // Step 2: Process cloud passwords (O(n) instead of O(n²))
        for (const cloudPwd of cloudPasswords) {
            // Match by localId only
            const localPwd = localMap.get(cloudPwd.localId);

            if (!localPwd) {
                // Case B: Only in cloud → Download to local
                toDownload.push(cloudPwd);
            } else {
                // Case A: Exists in both → Compare timestamps
                // Use lastModified from cloud if available, otherwise fallback to Firestore timestamps
                const cloudTime = new Date(cloudPwd.lastModified || cloudPwd.updatedAt || cloudPwd.createdAt || 0);
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
                toUpload.push(localPwd);
            }
            // If exists in both, already handled in Step 2
        }

        console.log(`📤 To upload: ${toUpload.length}`);
        console.log(`📥 To download: ${toDownload.length}`);
        console.log(`🔄 To update local: ${toUpdateLocal.length}`);
        console.log(`🔄 To update cloud: ${toUpdateCloud.length}`);

        // Check cloud password limit before uploading
        const cloudLimit = await getCloudPasswordLimit();
        const currentCloudCount = cloudPasswords.length;
        const newCloudCount = currentCloudCount + toUpload.length;

        if (newCloudCount > cloudLimit) {
            const exceeded = newCloudCount - cloudLimit;
            return {
                success: false,
                error: 'LIMIT_REACHED',
                limitDetails: {
                    current: currentCloudCount,
                    pending: toUpload.length,
                    limit: cloudLimit,
                    exceeded: newCloudCount - cloudLimit
                }
            };
        }
        // OPTIMIZATION 2: Execute local operations synchronously (fast)
        // Download new passwords
        for (const cloudPwd of toDownload) {
            try {
                const { id } = Database.addPassword(
                    cloudPwd.siteName || 'Untitled',
                    cloudPwd.username || '',
                    cloudPwd.encryptedPassword || '',
                    cloudPwd.comments || '',
                    1 // Mark as synced
                );

                // FIX: Link the new local ID to the cloud password
                // This prevents future syncs from treating this as a new upload
                if (cloudPwd.id) {
                    await FirestoreService.linkLocalId(user.uid, cloudPwd.id, id);
                }
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
            const results = await Promise.allSettled(
                batch.map(pwd =>
                    FirestoreService.savePassword(user.uid, {
                        siteName: pwd.siteName,
                        username: pwd.username,
                        encryptedPassword: pwd.encryptedPassword,
                        comments: pwd.comments,
                        lastModified: pwd.lastModified,
                        localId: pwd.id
                    })
                )
            );

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    uploadedCount++;
                } else {
                    errorCount++;
                    console.error(`❌ Failed to upload ${batch[index].siteName}`);
                }
            });
        }

        // Update cloud passwords in batches
        for (let i = 0; i < toUpdateCloud.length; i += BATCH_SIZE) {
            const batch = toUpdateCloud.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(({ cloud, local }) =>
                    FirestoreService.updatePassword(user.uid, cloud.id, {
                        siteName: local.siteName,
                        username: local.username,
                        encryptedPassword: local.encryptedPassword,
                        comments: local.comments,
                        lastModified: local.lastModified
                    })
                )
            );

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    updatedCloudCount++;
                } else {
                    errorCount++;
                    console.error(`❌ Failed to update cloud ${batch[index].local.siteName}`);
                }
            });
        }

        // Update last sync time
        await SecureStore.setItemAsync('LAST_SYNC_TIME', new Date().toISOString());

        const totalSynced = uploadedCount + toDownload.length + toUpdateLocal.length + updatedCloudCount;

        console.log(`✅ Sync complete! Total: ${totalSynced}, Errors: ${errorCount}`);

        return {
            success: errorCount === 0,
            uploaded: uploadedCount,
            downloaded: toDownload.length,
            updatedLocal: toUpdateLocal.length,
            updatedCloud: updatedCloudCount,
            total: totalSynced,
            errors: errorCount,
            message: errorCount > 0
                ? `Synced ${totalSynced} passwords with ${errorCount} errors`
                : `Successfully synced ${totalSynced} passwords`
        };
    } catch (error) {
        console.error('❌ Error in syncBidirectional:', error);
        return { success: false, error: error.message };
    }
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
                const lastModified = cloudPassword.lastModified || cloudPassword.updatedAt || new Date().toISOString();

                const localId = cloudPassword.localId;
                if (localId) {
                    // Update existing local password
                    await Database.updatePassword(localId, siteName, username, encryptedPassword, comments);
                } else {
                    // Add new password to local DB
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

/**
 * Helper: Get Firestore ID for a local ID
 */
const getFirestoreIdForLocalId = async (userId, localId) => {
    try {
        const result = await FirestoreService.getPasswords(userId);
        if (result.success) {
            // Match by localId only
            const match = result.passwords.find(p => p.localId === localId);
            return match?.id;
        }
        return null;
    } catch (error) {
        console.error('Error getting Firestore ID:', error);
        return null;
    }
};
