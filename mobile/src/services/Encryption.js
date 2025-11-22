import CryptoJS from 'crypto-js';

/**
 * Encryption secret key for AES-256 encryption.
 * ⚠️ IMPORTANT: Change this key in production!
 * For better security, consider:
 * - Deriving from user's master password
 * - Storing in device keychain/keystore
 * - Using environment variables
 */
const SECRET_KEY = 'my-secret-password-manager-key-change-this-if-you-want';

/**
 * Encrypts a password using AES-256 encryption
 * @param {string} password - Plain text password to encrypt
 * @returns {string} Encrypted password string (Base64 encoded)
 * @example
 * const encrypted = encryptPassword('myPassword123');
 * // Returns: "U2FsdGVkX1+..."
 */
export const encryptPassword = (password) => {
    if (!password) return '';
    return CryptoJS.AES.encrypt(password, SECRET_KEY).toString();
};

/**
 * Decrypts an encrypted password
 * @param {string} encryptedPassword - Encrypted password string
 * @returns {string} Decrypted plain text password
 * @description
 * Includes fallback for legacy plain-text passwords.
 * If decryption fails, returns the original text (for backward compatibility).
 * @example
 * const decrypted = decryptPassword('U2FsdGVkX1+...');
 * // Returns: "myPassword123"
 */
export const decryptPassword = (encryptedPassword) => {
    if (!encryptedPassword) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY);
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
