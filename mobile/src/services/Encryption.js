import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { ENCRYPTION_CONFIG, ENCRYPTION_MODES } from '../config/EncryptionConfig';

// Keys for SecureStore
const MASTER_PASSWORD_KEY = 'keyvault_master_password_hash';
const ENCRYPTION_KEY_KEY = 'keyvault_encryption_key';

// Fallback key for APP_SECRET_ONLY mode or legacy data
const FALLBACK_SECRET = ENCRYPTION_CONFIG.APP_SECRET;

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
 * @returns {Promise<{success: boolean, error?: string}>} Result
 */
export const setupMasterPassword = async (password) => {
    try {
        if (!password || password.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters' };
        }

        // 1. Hash the password for verification (using SHA256)
        const hash = CryptoJS.SHA256(password).toString();

        // 2. Derive the actual encryption key (using PBKDF2)
        // We use the configured salt and iterations
        const derivedKey = CryptoJS.PBKDF2(password, ENCRYPTION_CONFIG.PBKDF2_SALT, {
            keySize: 256 / 32,
            iterations: ENCRYPTION_CONFIG.KEY_DERIVATION_ITERATIONS
        }).toString();

        // 3. Store the hash and derived key securely
        await SecureStore.setItemAsync(MASTER_PASSWORD_KEY, hash);
        await SecureStore.setItemAsync(ENCRYPTION_KEY_KEY, derivedKey);

        return { success: true };
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
 * Gets the current encryption key
 * @returns {Promise<string>} The encryption key
 */
const getEncryptionKey = async () => {
    try {
        // If in APP_SECRET_ONLY mode, use the fallback
        if (ENCRYPTION_CONFIG.MODE === ENCRYPTION_MODES.APP_SECRET_ONLY) {
            return FALLBACK_SECRET;
        }

        // Try to get the user's derived key
        const userKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_KEY);

        // If no user key found (not set up yet), use fallback
        // This ensures backward compatibility for existing data
        return userKey || FALLBACK_SECRET;
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
