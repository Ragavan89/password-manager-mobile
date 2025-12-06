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
const MASTER_PASSWORD_KEY = 'keyvault_master_password_hash';
const MASTER_PASSWORD_ENCRYPTED_KEY = 'keyvault_master_password_encrypted'; // For retrieval
const ENCRYPTION_KEY_KEY = 'keyvault_encryption_key';
const PIN_KEY = 'keyvault_user_pin_hash';

// Fallback key for APP_SECRET_ONLY mode or legacy data
const FALLBACK_SECRET = ENCRYPTION_CONFIG.APP_SECRET;

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

        // 4. Encrypt the master password with APP_SECRET so it can be retrieved
        const encryptedPassword = CryptoJS.AES.encrypt(password, FALLBACK_SECRET).toString();

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

        // Decrypt the master password using APP_SECRET
        const bytes = CryptoJS.AES.decrypt(encryptedPassword, FALLBACK_SECRET);
        const masterPassword = bytes.toString(CryptoJS.enc.Utf8);

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
        // If in APP_SECRET_ONLY mode, use the fallback
        if (ENCRYPTION_CONFIG.MODE === ENCRYPTION_MODES.APP_SECRET_ONLY) {
            return FALLBACK_SECRET;
        }

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

        // Fallback to legacy global salt for backward compatibility
        // This handles existing users who haven't migrated yet
        if (masterPasswordResult.success && masterPasswordResult.masterPassword) {
            const legacyKey = CryptoJS.PBKDF2(
                masterPasswordResult.masterPassword,
                ENCRYPTION_CONFIG.PBKDF2_SALT,
                {
                    keySize: 256 / 32,
                    iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
                }
            ).toString();
            return legacyKey;
        }

        // Final fallback
        return FALLBACK_SECRET;
    } catch (error) {
        console.error('Error getting encryption key:', error);
        return FALLBACK_SECRET;
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
 * @param {string} encryptedPassword - Encrypted password string
 * @returns {Promise<string>} Decrypted plain text password
 */
export const decryptPassword = async (encryptedPassword) => {
    if (!encryptedPassword) return '';
    try {
        const key = await getEncryptionKey();
        const bytes = CryptoJS.AES.decrypt(encryptedPassword, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);

        // If decryption results in empty string (but input wasn't), it might be plain text or wrong key
        if (!originalText && encryptedPassword.length > 0) {
            return encryptedPassword; // Fallback to showing original text (legacy support)
        }
        return originalText;
    } catch (error) {
        // Fallback for plain text passwords (legacy support)
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

        // Get all local passwords
        const localPasswords = Database.getPasswords();
        let reEncryptedCount = 0;
        let failedCount = 0;

        // Re-encrypt each password
        for (const passwordEntry of localPasswords) {
            try {
                // Skip if already synced to cloud (cloud entries use cloud salt)
                // Only re-encrypt local-only entries (not synced yet)
                // cloudSynced can be 1 (synced), 0 (not synced), or undefined/null (legacy)

                // CRITICAL FIX: Even synced passwords might be encrypted with the WRONG local salt
                // if we are in a Split-Brain scenario. We must try to decrypt everything with
                // the old salt and migrate it if successful.

                /* 
                if (passwordEntry.cloudSynced === 1) {
                    continue;
                }
                */

                // Decrypt with old salt
                const decryptedPassword = decryptWithSalt(
                    passwordEntry.encryptedPassword,
                    masterPassword,
                    oldSalt
                );

                // If decryption failed, try with new salt (might already be encrypted with new salt)
                if (decryptedPassword === passwordEntry.encryptedPassword) {
                    // Try with new salt
                    const testDecrypt = decryptWithSalt(
                        passwordEntry.encryptedPassword,
                        masterPassword,
                        newSalt
                    );

                    if (testDecrypt !== passwordEntry.encryptedPassword) {
                        // Already encrypted with new salt, skip
                        continue;
                    }

                    // Can't decrypt with either salt - might be legacy or corrupted
                    console.warn(`⚠️ Could not decrypt password ${passwordEntry.id}, skipping`);
                    failedCount++;
                    continue;
                }

                // Encrypt with new salt
                const reEncryptedPassword = encryptWithSalt(
                    decryptedPassword,
                    masterPassword,
                    newSalt
                );

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

        // Update cached encryption key with new salt
        const newDerivedKey = CryptoJS.PBKDF2(masterPassword, newSalt, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();
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
