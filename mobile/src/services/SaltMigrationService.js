/**
 * Salt Migration Service
 * Handles migration when switching from local-only to cloud sync
 */

import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from './FirebaseAuthService';
import { getUserSalt } from './UserSaltService';
import { reEncryptAllPasswords } from './Encryption';
import * as Database from './Database';

/**
 * Detect if user is switching from local-only to cloud sync
 * and migrate all local passwords to use cloud salt
 * @returns {Promise<{success: boolean, migrated?: boolean, reEncryptedCount?: number, error?: string}>}
 */
export const migrateLocalToCloudSalt = async () => {
    try {
        const user = getCurrentUser();
        if (!user?.uid) {
            return { success: false, error: 'User not authenticated' };
        }

        // Check if cloud sync is enabled
        const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
        if (cloudSyncEnabled !== 'true') {
            return { success: true, migrated: false }; // Not cloud sync, no migration needed
        }

        // Check if we have local-only salt (from before cloud sync was enabled)
        // This is stored when local salt is used (getUserSaltLocal stores it)
        const LOCAL_SALT_KEY = 'local_user_salt';
        const LOCAL_SALT_STORAGE_KEY = 'userSalt_local'; // The actual local salt storage
        const localSalt = await SecureStore.getItemAsync(LOCAL_SALT_KEY) || 
                         await SecureStore.getItemAsync(LOCAL_SALT_STORAGE_KEY);
        
        // Check if we have local passwords that need migration
        const localPasswords = Database.getPasswords();
        const localOnlyPasswords = localPasswords.filter(p => 
            p.cloudSynced === 0 || p.cloudSynced === null || p.cloudSynced === undefined
        );

        if (localOnlyPasswords.length === 0) {
            // No local passwords to migrate
            if (localSalt) {
                // Clean up old local salt
                await SecureStore.deleteItemAsync(LOCAL_SALT_KEY);
                await SecureStore.deleteItemAsync(LOCAL_SALT_STORAGE_KEY);
            }
            return { success: true, migrated: false };
        }

        // Get cloud salt
        const cloudSaltResult = await getUserSalt(false);
        if (!cloudSaltResult.success || !cloudSaltResult.salt) {
            return { 
                success: false, 
                error: 'Failed to get cloud salt. Please ensure you are online and try again.' 
            };
        }

        const cloudSalt = cloudSaltResult.salt;

        // If we have local salt, check if it's different from cloud salt
        if (localSalt && localSalt === cloudSalt) {
            // Same salt, no migration needed
            await SecureStore.deleteItemAsync(LOCAL_SALT_KEY);
            await SecureStore.deleteItemAsync(LOCAL_SALT_STORAGE_KEY);
            return { success: true, migrated: false };
        }

        // We have local passwords and need to migrate to cloud salt
        console.log('🔄 Detected local-to-cloud salt migration needed');
        console.log(`📊 Found ${localOnlyPasswords.length} local passwords to migrate`);

        // Store migration info for reEncryptAllPasswords
        if (localSalt) {
            // We have old local salt - use it for migration
            await SecureStore.setItemAsync(`old_salt_${user.uid}`, localSalt);
            await SecureStore.setItemAsync(`new_salt_${user.uid}`, cloudSalt);
            await SecureStore.setItemAsync('SALT_MIGRATION_REQUIRED', 'true');
            
            // Clean up local salt storage
            await SecureStore.deleteItemAsync(LOCAL_SALT_KEY);
            await SecureStore.deleteItemAsync(LOCAL_SALT_STORAGE_KEY);
        } else {
            // No local salt stored, but we have local passwords
            // This means they were encrypted with a different salt
            // We need to try to decrypt with legacy global salt and re-encrypt with cloud salt
            const { ENCRYPTION_CONFIG } = await import('../config/EncryptionConfig');
            await SecureStore.setItemAsync(`old_salt_${user.uid}`, ENCRYPTION_CONFIG.PBKDF2_SALT);
            await SecureStore.setItemAsync(`new_salt_${user.uid}`, cloudSalt);
            await SecureStore.setItemAsync('SALT_MIGRATION_REQUIRED', 'true');
        }

        // Perform re-encryption
        const reEncryptResult = await reEncryptAllPasswords(user.uid);
        
        if (reEncryptResult.success) {
            console.log(`✅ Migrated ${reEncryptResult.reEncryptedCount} passwords to cloud salt`);
            return { 
                success: true, 
                migrated: true, 
                reEncryptedCount: reEncryptResult.reEncryptedCount 
            };
        } else {
            return { 
                success: false, 
                error: reEncryptResult.error || 'Failed to migrate passwords' 
            };
        }
    } catch (error) {
        console.error('Error in local-to-cloud salt migration:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to migrate passwords' 
        };
    }
};

/**
 * Check if local salt exists (from before cloud sync was enabled)
 * @returns {Promise<boolean>}
 */
export const hasLocalSalt = async () => {
    try {
        const localSalt = await SecureStore.getItemAsync('local_user_salt');
        return !!localSalt;
    } catch (error) {
        return false;
    }
};

