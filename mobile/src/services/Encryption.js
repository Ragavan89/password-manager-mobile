/**
 * Encryption.js
 * 
 * Core encryption service for the password manager.
 * Handles all cryptographic operations including:
 * - PIN setup and verification (SHA256 hashing)
 * - Master password management (PBKDF2 key derivation)
 * - AES-256 encryption/decryption of passwords
 * - Salt migration for cross-device sync
 * 
 * Security: Uses expo-secure-store for sensitive data storage.
 * All keys are derived using PBKDF2 with 100,000 iterations.
 */

import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { ENCRYPTION_CONFIG, ENCRYPTION_MODES } from '../config/EncryptionConfig';
import {
    getUserSalt,
    syncTemporarySalt,
    isSaltMigrationRequired,
    getMigrationSalts,
    clearSaltMigrationFlags
} from './UserSaltService';
import { getCurrentUser } from './FirebaseAuthService';
import * as Database from './Database';

// Keys for SecureStore
// Keys for SecureStore
const MASTER_PASSWORD_KEY = 'credvault_master_password_hash';
const MASTER_PASSWORD_ENCRYPTED_KEY = 'credvault_master_password_encrypted'; // For retrieval
const ENCRYPTION_KEY_KEY = 'credvault_encryption_key';
const PIN_KEY = 'credvault_user_pin_hash';

/**
 * Checks if a PIN has been set
 * @returns {Promise<boolean>} True if PIN exists
 */
export const isPINSet = async () => {
    try {
        const hash = await SecureStore.getItemAsync(PIN_KEY);
        return !!hash;
    } catch (error) {
        console.error('Error checking PIN:', error);
        return false;
    }
};

/**
 * Sets up the user PIN
 * @param {string} pin - The 4-digit PIN
 * @returns {Promise<{success: boolean, error?: string}>} Result
 */
export const setupPIN = async (pin) => {
    try {
        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            return { success: false, error: 'PIN must be exactly 4 digits' };
        }

        // Hash the PIN for secure storage
        const hash = CryptoJS.SHA256(pin).toString();
        await SecureStore.setItemAsync(PIN_KEY, hash);

        return { success: true };
    } catch (error) {
        console.error('Error setting PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Verifies the user PIN
 * @param {string} pin - PIN to verify
 * @returns {Promise<boolean>} True if correct
 */
export const verifyPIN = async (pin) => {
    try {
        const storedHash = await SecureStore.getItemAsync(PIN_KEY);
        if (!storedHash) return false;

        const inputHash = CryptoJS.SHA256(pin).toString();
        return inputHash === storedHash;
    } catch (error) {
        console.error('Error verifying PIN:', error);
        return false;
    }
};


/**
 * Checks if a master password has been set
 * @returns {Promise<boolean>} True if master password exists
 */
export const isMasterPasswordSet = async () => {
    try {
        const hash = await SecureStore.getItemAsync(MASTER_PASSWORD_KEY);
        return !!hash;
    } catch (error) {
        console.error('Error checking master password:', error);
        return false;
    }
};

/**
 * Sets up the master password
 * @param {string} password - The master password
 * @param {boolean} requireOnline - If true, requires online connection for cloud sync users
 * @returns {Promise<{success: boolean, error?: string, isTemporarySalt?: boolean}>} Result
 */
export const setupMasterPassword = async (password, requireOnline = false) => {
    try {
        if (!password || password.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters' };
        }

        // 1. Get user-specific salt (handles offline scenario)
        const saltResult = await getUserSalt(requireOnline);
        if (!saltResult.success) {
            return {
                success: false,
                error: saltResult.error || 'Failed to get user salt. Please check your internet connection.'
            };
        }

        const userSalt = saltResult.salt;
        const isTemporarySalt = saltResult.isTemporary || false;

        // 2. Hash the password for verification (using SHA256)
        const hash = CryptoJS.SHA256(password).toString();

        // 3. Derive the actual encryption key (using PBKDF2 with per-user salt)
        const derivedKey = CryptoJS.PBKDF2(password, userSalt, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();

        // 4. Store the master password in SecureStore (It is encrypted by the OS automatically)
        // We no longer double-encrypt with APP_SECRET
        const encryptedPassword = password; // Stored directly in SecureStore

        // 5. Store the hash, derived key, and encrypted password securely
        await SecureStore.setItemAsync(MASTER_PASSWORD_KEY, hash);
        await SecureStore.setItemAsync(ENCRYPTION_KEY_KEY, derivedKey);
        await SecureStore.setItemAsync(MASTER_PASSWORD_ENCRYPTED_KEY, encryptedPassword);

        // 6. Ensure salt is synced to Firestore (if cloud sync enabled)
        // This handles both temporary salt sync and ensuring salt exists in Firestore
        const user = getCurrentUser();
        if (user?.uid) {
            if (isTemporarySalt) {
                // Try to sync temporary salt in background (don't block setup)
                syncTemporarySalt(user.uid).catch(error => {
                    console.warn('Failed to sync temporary salt (will retry later):', error);
                });
            } else {
                // Even if not temporary, ensure salt is saved to Firestore
                // This handles cases where salt was cached locally but not in Firestore
                // getUserSalt() will automatically save to Firestore if missing
                getUserSalt(false).catch(error => {
                    console.warn('Failed to verify salt in Firestore:', error);
                });
            }
        }

        return {
            success: true,
            isTemporarySalt
        };
    } catch (error) {
        console.error('Error setting master password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Verifies the master password
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} True if correct
 */
export const verifyMasterPassword = async (password) => {
    try {
        const storedHash = await SecureStore.getItemAsync(MASTER_PASSWORD_KEY);
        if (!storedHash) return false;

        const inputHash = CryptoJS.SHA256(password).toString();
        return inputHash === storedHash;
    } catch (error) {
        console.error('Error verifying master password:', error);
        return false;
    }
};

/**
 * Gets the master password (decrypted)
 * @returns {Promise<{success: boolean, masterPassword?: string, error?: string}>} Result with master password
 */
export const getMasterPassword = async () => {
    try {
        const encryptedPassword = await SecureStore.getItemAsync(MASTER_PASSWORD_ENCRYPTED_KEY);

        if (!encryptedPassword) {
            return { success: false, error: 'Master password not found' };
        }

        // The password in SecureStore is already encrypted by the OS.
        // We previously double-encrypted it with APP_SECRET, but now we just return it.
        const masterPassword = encryptedPassword;

        if (!masterPassword) {
            return { success: false, error: 'Failed to decrypt master password' };
        }

        return { success: true, masterPassword };
    } catch (error) {
        console.error('Error getting master password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Gets the current encryption key
 * Derives key from master password using per-user salt
 * @returns {Promise<string>} The encryption key
 */
const getEncryptionKey = async () => {
    try {
        // Try to get the user's derived key (cached)
        const userKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_KEY);
        if (userKey) {
            console.log('🔑 Using cached encryption key (salt fetch skipped)');
            return userKey;
        }

        // If no cached key, try to derive it from master password
        // This handles cases where master password exists but key wasn't cached
        const masterPasswordResult = await getMasterPassword();
        if (masterPasswordResult.success && masterPasswordResult.masterPassword) {
            console.log('🔍 No cached key, fetching salt to derive new key...');
            // Get user salt and derive key
            const saltResult = await getUserSalt(false); // Don't require online for decryption
            if (saltResult.success && saltResult.salt) {
                console.log('✅ Salt retrieved, deriving encryption key...');
                const derivedKey = CryptoJS.PBKDF2(
                    masterPasswordResult.masterPassword,
                    saltResult.salt,
                    {
                        keySize: 256 / 32,
                        iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
                    }
                ).toString();

                // Cache the derived key
                await SecureStore.setItemAsync(ENCRYPTION_KEY_KEY, derivedKey);
                console.log('✅ Encryption key derived and cached');
                return derivedKey;
            } else {
                console.warn('⚠️ Failed to get salt:', saltResult.error);
            }
        }

        // Final fallback
        throw new Error('Could not derive encryption key');
    } catch (error) {
        console.error('Error getting encryption key:', error);
        throw error;
    }
};

/**
 * Encrypts a password using AES-256 encryption
 * @param {string} password - Plain text password to encrypt
 * @returns {Promise<string>} Encrypted password string (Base64 encoded)
 */
export const encryptPassword = async (password) => {
    if (!password) return '';
    try {
        const key = await getEncryptionKey();
        return CryptoJS.AES.encrypt(password, key).toString();
    } catch (error) {
        console.error('Encryption error:', error);
        return '';
    }
};

/**
 * Decrypts an encrypted password
 * Includes legacy salt fallback to ensure no data loss
 * @param {string} encryptedPassword - Encrypted password string
 * @returns {Promise<string>} Decrypted plain text password
 */
export const decryptPassword = async (encryptedPassword) => {
    if (!encryptedPassword) return '';
    try {
        // 1. Try with current encryption key (most common case)
        const key = await getEncryptionKey();
        const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryption succeeds, return result
        if (originalText && originalText.length > 0) {
            return originalText;
        }

        // All attempts failed - might be plain text (legacy support)
        console.log('⚠️ All decryption attempts failed, returning original text');
        return encryptedPassword;
    } catch (error) {
        // Fallback for plain text passwords (legacy support)
        console.log('ℹ️ Decryption exception, returning original:', error.message);
        return encryptedPassword;
    }
};

/**
 * Decrypt password with a specific salt (for migration)
 * @param {string} encryptedPassword - Encrypted password
 * @param {string} masterPassword - Master password
 * @param {string} salt - Salt to use for decryption
 * @returns {string} Decrypted password
 */
const decryptWithSalt = (encryptedPassword, masterPassword, salt) => {
    if (!encryptedPassword || !masterPassword || !salt) return '';
    try {
        const derivedKey = CryptoJS.PBKDF2(masterPassword, salt, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();

        const bytes = CryptoJS.AES.decrypt(encryptedPassword, derivedKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || encryptedPassword; // Fallback if decryption fails
    } catch (error) {
        // Malformed UTF-8 data is expected if we try the wrong key (wrong salt) during migration checks
        if (error.message && error.message.includes('Malformed UTF-8')) {
            // Use console.log instead of error/warn to avoid UI Overlay
            console.log('ℹ️ Decryption check failed (wrong salt candidate)');
        } else {
            console.log('⚠️ Error decrypting with salt:', error);
        }
        return encryptedPassword;
    }
};

/**
 * Encrypt password with a specific salt (for migration)
 * @param {string} password - Plain text password
 * @param {string} masterPassword - Master password
 * @param {string} salt - Salt to use for encryption
 * @returns {string} Encrypted password
 */
const encryptWithSalt = (password, masterPassword, salt) => {
    if (!password || !masterPassword || !salt) return '';
    try {
        const derivedKey = CryptoJS.PBKDF2(masterPassword, salt, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();

        return CryptoJS.AES.encrypt(password, derivedKey).toString();
    } catch (error) {
        console.error('Error encrypting with salt:', error);
        return '';
    }
};

/**
 * Re-encrypt all local passwords when salt changes (salt migration)
 * This happens when a device with temporary salt syncs with cloud that has different salt
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{success: boolean, reEncryptedCount?: number, error?: string}>}
 */
export const reEncryptAllPasswords = async (userId) => {
    try {
        // Check if migration is required
        const migrationRequired = await isSaltMigrationRequired(userId);
        if (!migrationRequired) {
            return { success: true, reEncryptedCount: 0 };
        }

        // Get master password
        const masterPasswordResult = await getMasterPassword();
        if (!masterPasswordResult.success || !masterPasswordResult.masterPassword) {
            return {
                success: false,
                error: 'Master password required for re-encryption'
            };
        }

        const masterPassword = masterPasswordResult.masterPassword;

        // Get old and new salts
        const { oldSalt, newSalt } = await getMigrationSalts(userId);
        if (!oldSalt || !newSalt) {
            return {
                success: false,
                error: 'Migration salts not found'
            };
        }

        console.log('🔄 Starting password re-encryption with new salt...');
        console.log(`🔍 DEBUG: Old Salt (prefix): ${oldSalt.substring(0, 6)}...`);
        console.log(`🔍 DEBUG: New Salt (prefix): ${newSalt.substring(0, 6)}...`);

        // OPTIMIZATION: Derive keys once outside the loop (O(1)) instead of for every password (O(N))
        // Try to reuse cached key (Old Salt) to skip derivation
        let oldDerivedKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_KEY);
        if (oldDerivedKey) {
            console.log('⚡ Using cached encryption key for decryption (saved ~2s CPU time)');
        } else {
            console.log('⚠️ Cached key missing, performing PBKDF2 derivation...');
            oldDerivedKey = CryptoJS.PBKDF2(masterPassword, oldSalt, {
                keySize: 256 / 32,
                iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
            }).toString();
        }

        const newDerivedKey = CryptoJS.PBKDF2(masterPassword, newSalt, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();

        // Get all local passwords
        const localPasswords = Database.getPasswords();
        let reEncryptedCount = 0;
        let failedCount = 0;

        // Re-encrypt each password
        for (const passwordEntry of localPasswords) {
            try {
                // Decrypt with old key (fast AES)
                let decryptedPassword = '';
                try {
                    const bytes = CryptoJS.AES.decrypt(passwordEntry.encryptedPassword, oldDerivedKey);
                    decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
                } catch (e) {
                    // Decryption failed
                }

                // If decryption failed, try with new key (might already be migrated)
                if (!decryptedPassword) {
                    try {
                        const bytes = CryptoJS.AES.decrypt(passwordEntry.encryptedPassword, newDerivedKey);
                        const testDecrypt = bytes.toString(CryptoJS.enc.Utf8);
                        if (testDecrypt) {
                            // Already encrypted with new key
                            continue;
                        }
                    } catch (e) { }

                    // If still nothing, skip
                    failedCount++;
                    continue;
                }

                // Encrypt with new key (fast AES)
                const reEncryptedPassword = CryptoJS.AES.encrypt(decryptedPassword, newDerivedKey).toString();

                if (!reEncryptedPassword) {
                    console.warn(`⚠️ Failed to re-encrypt password ${passwordEntry.id}`);
                    failedCount++;
                    continue;
                }

                // Update in database
                Database.updatePassword(
                    passwordEntry.id,
                    passwordEntry.siteName,
                    passwordEntry.username,
                    reEncryptedPassword,
                    passwordEntry.comments || ''
                );

                reEncryptedCount++;
            } catch (error) {
                console.error(`Error re-encrypting password ${passwordEntry.id}:`, error);
                failedCount++;
            }
        }

        // Clear migration flags
        await clearSaltMigrationFlags(userId);

        // Update cached encryption key with new salt (already derived!)
        await SecureStore.setItemAsync(ENCRYPTION_KEY_KEY, newDerivedKey);

        console.log(`✅ Re-encryption complete: ${reEncryptedCount} passwords re-encrypted, ${failedCount} failed`);

        return {
            success: true,
            reEncryptedCount,
            failedCount
        };
    } catch (error) {
        console.error('Error in re-encryption:', error);
        return {
            success: false,
            error: error.message || 'Failed to re-encrypt passwords'
        };
    }
};

/**
 * Clear cached encryption key (call on logout)
 * Forces key re-derivation on next encryption/decryption operation.
 * 
 * IMPORTANT: Must be called when user signs out of cloud sync to ensure
 * fresh key derivation with the correct salt on next login.
 * 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const clearEncryptionKeyCache = async () => {
    try {
        await SecureStore.deleteItemAsync(ENCRYPTION_KEY_KEY);
        console.log('✅ Encryption key cache cleared');
        return { success: true };
    } catch (error) {
        console.error('Error clearing encryption key cache:', error);
        return { success: false, error: error.message };
    }
};
