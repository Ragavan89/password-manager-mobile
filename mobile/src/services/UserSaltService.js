/**
 * UserSaltService.js
 * 
 * Per-user cryptographic salt management service.
 * Ensures each user has a unique salt for PBKDF2 key derivation.
 * 
 * Key features:
 * - Unique salt per user (prevents cross-user key collision)
 * - Offline support with temporary salt generation
 * - Cloud-local salt synchronization
 * - Split-brain protection (cloud is authority)
 * - Salt migration for cross-device sync
 * 
 * Flow: Encryption.js → UserSaltService.js → Firestore (cloud) / SecureStore (local)
 */

import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from './FirebaseAuthService';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase.config';
import NetInfo from '@react-native-community/netinfo';
import CryptoJS from 'crypto-js';
import { ENCRYPTION_CONFIG } from '../config/EncryptionConfig';
import { clearEncryptionKeyCache } from './Encryption';

// EXPLICITLY get the named database instance
const firestore = getFirestore(app, 'keyvault-pro-india');

// Session-level cache for last verification time
let lastSaltVerificationTime = 0;

// Storage keys
const TEMP_SALT_KEY = 'temp_user_salt';
const TEMP_SALT_FLAG = 'has_temp_salt';

/**
 * Generate a random salt (256-bit)
 * @returns {string} Random salt string
 */
const generateRandomSalt = () => {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
};

/**
 * Check if device is online
 * @returns {Promise<boolean>} True if online
 */
const isOnline = async () => {
    try {
        const netState = await NetInfo.fetch();
        return netState.isConnected && netState.isInternetReachable;
    } catch (error) {
        console.error('Error checking network status:', error);
        return false;
    }
};

/**
 * Get user salt with offline handling
 * 
 * Flow:
 * 1. Check local cache (works offline)
 * 2. If cloud sync enabled: Fetch from Firestore (requires online)
 * 3. If offline and no cache: Use temporary salt (will sync later)
 * 4. If local-only user: Generate and store locally
 * 
 * @param {boolean} requireOnline - If true, will fail if offline and no cache
 * @returns {Promise<{success: boolean, salt?: string, isTemporary?: boolean, error?: string}>}
 */
export const getUserSalt = async (requireOnline = false) => {
    try {
        // Check if cloud sync is enabled
        const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
        const user = getCurrentUser();
        const userId = user?.uid;

        const hasCloudSync = cloudSyncEnabled === 'true' && userId;

        if (hasCloudSync) {
            // CLOUD SYNC USER: Use userId-based salt
            return await getUserSaltFromCloud(userId, requireOnline);
        } else {
            // LOCAL-ONLY USER: Use device-specific salt
            return await getUserSaltLocal();
        }
    } catch (error) {
        console.error('Error getting user salt:', error);
        return {
            success: false,
            error: error.message || 'Failed to get user salt'
        };
    }
};

/**
 * Get salt for cloud sync users
 * @param {string} userId - Firebase user ID
 * @param {boolean} requireOnline - If true, fail when offline and no cache
 * @returns {Promise<{success: boolean, salt?: string, isTemporary?: boolean, error?: string}>}
 */
const getUserSaltFromCloud = async (userId, requireOnline = false) => {
    const SALT_KEY = `userSalt_${userId}`;

    // 1. Check local cache first (works offline)
    try {
        const cachedSalt = await SecureStore.getItemAsync(SALT_KEY);
        if (cachedSalt) {
            console.log('✅ Using cached user salt');
            return { success: true, salt: cachedSalt, isTemporary: false };
        }
    } catch (error) {
        console.error('Error reading cached salt:', error);
    }

    // 2. Check if we're online
    const online = await isOnline();

    if (!online) {
        // OFFLINE: Check if we have a temporary salt
        const tempSalt = await SecureStore.getItemAsync(TEMP_SALT_KEY);
        const hasTempSalt = await SecureStore.getItemAsync(TEMP_SALT_FLAG);

        if (tempSalt && hasTempSalt === 'true') {
            console.log('⚠️ Using temporary salt (offline mode)');
            return {
                success: true,
                salt: tempSalt,
                isTemporary: true
            };
        }

        // No salt available and offline
        if (requireOnline) {
            return {
                success: false,
                error: 'Internet connection required for first-time setup. Please connect to the internet and try again.'
            };
        }

        // Generate temporary salt (will sync when online)
        console.log('⚠️ Generating temporary salt (offline, will sync later)');
        const tempSaltValue = generateRandomSalt();
        await SecureStore.setItemAsync(TEMP_SALT_KEY, tempSaltValue);
        await SecureStore.setItemAsync(TEMP_SALT_FLAG, 'true');

        return {
            success: true,
            salt: tempSaltValue,
            isTemporary: true
        };
    }

    // 3. ONLINE: Fetch from Firestore
    try {
        console.log(`🔍 Checking Firestore for salt: users/${userId}`);
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('📄 User document exists in Firestore');
            console.log('📋 Document fields:', Object.keys(userData));

            if (userData.userSalt) {
                // Salt exists in Firestore
                const salt = userData.userSalt;
                console.log('✅ Salt found in Firestore (length:', salt.length, ')');

                // Cache locally for offline use
                await SecureStore.setItemAsync(SALT_KEY, salt);

                // Clear temporary salt if it exists
                await SecureStore.deleteItemAsync(TEMP_SALT_KEY);
                await SecureStore.deleteItemAsync(TEMP_SALT_FLAG);

                console.log('✅ Fetched user salt from Firestore and cached locally');
                return { success: true, salt, isTemporary: false };
            } else {
                console.log('⚠️ User document exists but userSalt field is missing');
                console.log('🔄 Will generate new salt and add to existing document');
            }
        } else {
            console.log('📝 User document does not exist in Firestore');
            console.log('🔄 Will create new document with salt');
        }
    } catch (error) {
        console.error('❌ Error fetching salt from Firestore:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // If requireOnline is true, fail immediately
        if (requireOnline) {
            return {
                success: false,
                error: 'Failed to fetch salt from cloud. Please check your internet connection and try again.'
            };
        }

        // Otherwise, use temporary salt
        console.log('⚠️ Firestore fetch failed, using temporary salt');
        const tempSalt = await SecureStore.getItemAsync(TEMP_SALT_KEY);
        if (tempSalt) {
            return {
                success: true,
                salt: tempSalt,
                isTemporary: true
            };
        }
    }

    // 4. NEW USER or MISSING SALT: Generate salt and save to Firestore
    console.log('🆕 Generating new salt for user:', userId);
    const newSalt = generateRandomSalt();
    console.log('🔑 Generated salt (length:', newSalt.length, ')');

    try {
        // Save to Firestore (merge: true ensures we don't overwrite existing data)
        const userRef = doc(firestore, 'users', userId);
        const saltData = {
            userSalt: newSalt,
            lastUpdated: new Date().toISOString()
        };

        // Only add createdAt if document doesn't exist
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            saltData.createdAt = new Date().toISOString();
            saltData.subscriptionTier = 'free'; // Add subscriptionTier for new users
        } else {
            // Ensure existing users have subscriptionTier field
            const userData = userDoc.data();
            if (!userData.subscriptionTier) {
                saltData.subscriptionTier = 'free';
            }
        }

        console.log('💾 Saving salt to Firestore:', {
            path: `users/${userId}`,
            database: 'keyvault-pro-india',
            fields: Object.keys(saltData)
        });

        await setDoc(userRef, saltData, { merge: true });

        // Verify it was saved
        const verifyDoc = await getDoc(userRef);
        if (verifyDoc.exists() && verifyDoc.data().userSalt) {
            console.log('✅ Salt successfully saved to Firestore and verified');
        } else {
            console.error('❌ Salt save verification failed - salt not found after save!');
        }

        // Cache locally
        await SecureStore.setItemAsync(SALT_KEY, newSalt);
        console.log('✅ Salt cached locally');

        console.log('✅ Generated and saved new user salt');
        return { success: true, salt: newSalt, isTemporary: false };
    } catch (error) {
        console.error('❌ Error saving salt to Firestore:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // Save temporarily and sync later
        await SecureStore.setItemAsync(TEMP_SALT_KEY, newSalt);
        await SecureStore.setItemAsync(TEMP_SALT_FLAG, 'true');
        console.log('⚠️ Salt saved temporarily, will sync later');

        return {
            success: true,
            salt: newSalt,
            isTemporary: true
        };
    }
};

/**
 * Get salt for local-only users
 * @returns {Promise<{success: boolean, salt?: string, error?: string}>}
 */
const getUserSaltLocal = async () => {
    const SALT_KEY = 'userSalt_local';
    const LOCAL_SALT_KEY = 'local_user_salt'; // Store for migration

    try {
        // Check if salt exists locally
        let salt = await SecureStore.getItemAsync(SALT_KEY);

        if (salt) {
            // Also store in migration key for later use
            await SecureStore.setItemAsync(LOCAL_SALT_KEY, salt);
            return { success: true, salt, isTemporary: false };
        }

        // Generate new salt (first-time setup)
        salt = generateRandomSalt();
        await SecureStore.setItemAsync(SALT_KEY, salt);
        await SecureStore.setItemAsync(LOCAL_SALT_KEY, salt); // Store for migration

        console.log('✅ Generated local-only salt');
        return { success: true, salt, isTemporary: false };
    } catch (error) {
        console.error('Error managing local salt:', error);
        return {
            success: false,
            error: error.message || 'Failed to get local salt'
        };
    }
};

/**
 * Sync temporary salt to Firestore (when device comes online)
 * This should be called after network reconnection
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const syncTemporarySalt = async (userId) => {
    try {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }

        const hasTempSalt = await SecureStore.getItemAsync(TEMP_SALT_FLAG);
        if (hasTempSalt !== 'true') {
            // No temporary salt to sync
            return { success: true, requiresReEncryption: false };
        }

        const tempSalt = await SecureStore.getItemAsync(TEMP_SALT_KEY);
        if (!tempSalt) {
            return {
                success: false,
                error: 'Temporary salt not found',
                requiresReEncryption: false
            };
        }

        // Check if salt already exists in Firestore
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().userSalt) {
            // Salt already exists in Firestore - this means another device created it first
            const existingSalt = userDoc.data().userSalt;
            const localSalt = tempSalt;

            // Check if salts are different (salt conflict detected)
            if (existingSalt !== localSalt) {
                console.log('⚠️ Salt conflict detected: Cloud salt differs from local temporary salt');
                console.log('🔄 Will re-encrypt local entries with cloud salt');

                // Store both salts temporarily for re-encryption
                await SecureStore.setItemAsync(`old_salt_${userId}`, localSalt);
                await SecureStore.setItemAsync(`new_salt_${userId}`, existingSalt);
                await SecureStore.setItemAsync('SALT_MIGRATION_REQUIRED', 'true');
            }

            // Use the cloud salt (authoritative)
            await SecureStore.setItemAsync(`userSalt_${userId}`, existingSalt);
            await SecureStore.deleteItemAsync(TEMP_SALT_KEY);
            await SecureStore.deleteItemAsync(TEMP_SALT_FLAG);

            // CRITICAL: If salts differ, clear cached encryption key to force re-derivation
            if (existingSalt !== localSalt) {
                await clearEncryptionKeyCache();
            }

            console.log('✅ Using existing salt from Firestore, cleared temporary salt');
            return {
                success: true,
                requiresReEncryption: existingSalt !== localSalt,
                oldSalt: existingSalt !== localSalt ? localSalt : null,
                newSalt: existingSalt
            };
        }

        // Save temporary salt to Firestore
        // userDoc already fetched above, reuse it
        const saltData = {
            userSalt: tempSalt,
            lastUpdated: new Date().toISOString()
        };

        if (!userDoc.exists()) {
            saltData.createdAt = new Date().toISOString();
            saltData.subscriptionTier = 'free'; // Add subscriptionTier for new users
        } else {
            // Ensure existing users have subscriptionTier field
            const userData = userDoc.data();
            if (!userData.subscriptionTier) {
                saltData.subscriptionTier = 'free';
            }
        }

        await setDoc(userRef, saltData, { merge: true });

        // Move from temporary to permanent storage
        await SecureStore.setItemAsync(`userSalt_${userId}`, tempSalt);
        await SecureStore.deleteItemAsync(TEMP_SALT_KEY);
        await SecureStore.deleteItemAsync(TEMP_SALT_FLAG);

        console.log('✅ Synced temporary salt to Firestore');
        return {
            success: true,
            requiresReEncryption: false
        };
    } catch (error) {
        console.error('Error syncing temporary salt:', error);
        return {
            success: false,
            error: error.message || 'Failed to sync temporary salt'
        };
    }
};

/**
 * Check if salt migration (re-encryption) is required
 * @param {string} userId - Firebase user ID
 * @returns {Promise<boolean>} True if migration is required
 */
export const isSaltMigrationRequired = async (userId) => {
    try {
        const flag = await SecureStore.getItemAsync('SALT_MIGRATION_REQUIRED');
        return flag === 'true';
    } catch (error) {
        return false;
    }
};

/**
 * Get old and new salts for migration
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{oldSalt?: string, newSalt?: string}>}
 */
export const getMigrationSalts = async (userId) => {
    try {
        const oldSalt = await SecureStore.getItemAsync(`old_salt_${userId}`);
        const newSalt = await SecureStore.getItemAsync(`new_salt_${userId}`);
        return { oldSalt, newSalt };
    } catch (error) {
        return {};
    }
};

/**
 * Clear migration flags after successful re-encryption
 * @param {string} userId - Firebase user ID
 */
export const clearSaltMigrationFlags = async (userId) => {
    try {
        await SecureStore.deleteItemAsync('SALT_MIGRATION_REQUIRED');
        await SecureStore.deleteItemAsync(`old_salt_${userId}`);
        await SecureStore.deleteItemAsync(`new_salt_${userId}`);
    } catch (error) {
        console.error('Error clearing migration flags:', error);
    }
};

/**
 * Check if user has a temporary salt that needs syncing
 * @returns {Promise<boolean>} True if temporary salt exists
 */
export const hasTemporarySalt = async () => {
    try {
        const hasTemp = await SecureStore.getItemAsync(TEMP_SALT_FLAG);
        return hasTemp === 'true';
    } catch (error) {
        return false;
    }
};

/**
 * Force fetch salt from Firestore (for retry scenarios)
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{success: boolean, salt?: string, error?: string}>}
 */
export const forceFetchSaltFromCloud = async (userId) => {
    try {
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().userSalt) {
            const salt = userDoc.data().userSalt;
            await SecureStore.setItemAsync(`userSalt_${userId}`, salt);

            // Clear temporary salt
            await SecureStore.deleteItemAsync(TEMP_SALT_KEY);
            await SecureStore.deleteItemAsync(TEMP_SALT_FLAG);

            return { success: true, salt };
        }

        return { success: false, error: 'Salt not found in Firestore' };
    } catch (error) {
        console.error('Error force fetching salt:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Verify that local salt matches cloud salt (Split-Brain Protection)
 * Enforces "Cloud is Authority" rule.
 * 
 * Frequency:
 * - Runs fully only once per app session (performance optimization)
 * - Or if forceCheck is true (triggered by decryption failure)
 * 
 * @param {string} userId - Firebase User ID
 * @param {boolean} forceCheck - Force remote verification (e.g. after decryption error)
 * @returns {Promise<{success: boolean, requiresReEncryption?: boolean, targetSalt?: string, error?: string}>}
 */
export const verifySaltIntegrity = async (userId, forceCheck = false) => {
    try {
        if (!userId) return { success: false, error: 'User ID required' };

        // PERF: Skip if verified recently (in this session) and not forced
        const now = Date.now();
        if (!forceCheck && lastSaltVerificationTime > 0) {
            console.log('⚡ Salt integrity already verified this session, skipping remote check');
            return { success: true, requiresReEncryption: false };
        }

        console.log('🛡️ Verifying Salt Integrity (Cloud Authority Check)...');

        // 1. Get Local Salt
        const localSaltArg = await getUserSaltLocal();
        const localSalt = localSaltArg.salt;

        if (!localSalt) {
            // Should not happen if app is initialized, but if so, just return
            return { success: true };
        }

        // 2. Get Cloud Salt (Live Fetch)
        const online = await isOnline();
        if (!online) {
            console.log('⚠️ Offline: Skipping salt integrity check');
            return { success: true }; // Can't verify if offline
        }

        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const cloudSalt = userData.userSalt;

            if (cloudSalt) {
                // 3. Compare
                if (cloudSalt !== localSalt) {
                    console.log('🚨 SALT MISMATCH DETECTED!');
                    console.log('🔴 Local:', localSalt);
                    console.log('🟢 Cloud:', cloudSalt);
                    console.log('🔧 Enforcing Cloud Authority...');

                    // Prepare for re-encryption flags
                    await SecureStore.setItemAsync(`old_salt_${userId}`, localSalt);
                    await SecureStore.setItemAsync(`new_salt_${userId}`, cloudSalt);
                    await SecureStore.setItemAsync('SALT_MIGRATION_REQUIRED', 'true');

                    // Update authoritative salt immediately (Cloud wins for future ops)
                    await SecureStore.setItemAsync(`userSalt_${userId}`, cloudSalt);
                    // Also update legacy local salt key to match so future checks pass
                    await SecureStore.setItemAsync('userSalt_local', cloudSalt);

                    // CRITICAL: Clear cached encryption key to force re-derivation with new salt
                    // This prevents the key/salt mismatch that causes decryption failures
                    await clearEncryptionKeyCache();

                    // Stop verification loop for this session
                    lastSaltVerificationTime = Date.now();

                    // 4. Return instructions to re-encrypt
                    // The actual re-encryption happens in HybridStorageService
                    return {
                        success: true,
                        requiresReEncryption: true,
                        targetSalt: cloudSalt
                    };
                } else {
                    console.log('✅ Salt Integrity Verified: Match');
                }
            } else {
                // Cloud user exists but has no salt? This is weird.
                // We should upload our local salt to fix this.
                console.warn('⚠️ Cloud user missing salt. Uploading local salt...');
                await setDoc(userRef, { userSalt: localSalt }, { merge: true });
                console.log('✅ Local salt uploaded to cloud');
            }
        } else {
            // Cloud user doesn't exist? (First sync ever?)
            // We should upload our local salt.
            console.warn('⚠️ User doc missing in cloud. Uploading local salt...');
            await setDoc(userRef, {
                userSalt: localSalt,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                subscriptionTier: 'free'
            }, { merge: true });
            console.log('✅ Local salt uploaded to new cloud doc');
        }

        // Update verification timestamp
        lastSaltVerificationTime = now;
        return { success: true, requiresReEncryption: false };

    } catch (error) {
        console.error('❌ Error verifying salt integrity:', error);
        // Don't block sync on error, just warn
        return { success: false, error: error.message };
    }
};

/**
 * Clear salt cache for a specific user (call on logout)
 * This ensures fresh salt fetch from Firestore on next login.
 * 
 * IMPORTANT: Must be called when user signs out to prevent stale salt
 * from being used when logging back in (especially after offline operations).
 * 
 * @param {string} userId - Firebase user ID to clear cache for
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const clearUserSaltCache = async (userId) => {
    try {
        // Clear user-specific salt
        if (userId) {
            await SecureStore.deleteItemAsync(`userSalt_${userId}`);
            await SecureStore.deleteItemAsync(`old_salt_${userId}`);
            await SecureStore.deleteItemAsync(`new_salt_${userId}`);
        }

        // Clear temporary salt flags
        await SecureStore.deleteItemAsync(TEMP_SALT_KEY);
        await SecureStore.deleteItemAsync(TEMP_SALT_FLAG);
        await SecureStore.deleteItemAsync('SALT_MIGRATION_REQUIRED');

        // Reset session-level verification cache to force re-verification on login
        lastSaltVerificationTime = 0;

        console.log('✅ User salt cache cleared for user:', userId || 'local');
        return { success: true };
    } catch (error) {
        console.error('Error clearing salt cache:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reset salt verification flag (forces re-verification on next sync)
 * Call this when transitioning from offline to online to ensure salt integrity.
 */
export const resetSaltVerification = () => {
    lastSaltVerificationTime = 0;
    console.log('🔄 Salt verification reset - will re-verify on next sync');
};
