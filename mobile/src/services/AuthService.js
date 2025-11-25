import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import CryptoJS from 'crypto-js';
import { isMasterPasswordRequired } from '../config/EncryptionConfig';
import {
    setupMasterPassword as encryptionSetupMasterPassword,
    getMasterPassword as encryptionGetMasterPassword,
    isMasterPasswordSetup,
    initializeAppSecretMode
} from './Encryption';

/**
 * Storage Keys
 */
const PIN_HASH_KEY = 'USER_PIN_HASH';
const PIN_SALT_KEY = 'PIN_SALT';

/**
 * Generate or retrieve PIN salt
 * @returns {Promise<string>} PIN salt
 */
const getPinSalt = async () => {
    try {
        let salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
        if (!salt) {
            salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
            await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
        }
        return salt;
    } catch (error) {
        console.error('Error getting PIN salt:', error);
        throw error;
    }
};

/**
 * Hash PIN with salt
 * @param {string} pin - PIN to hash
 * @param {string} salt - Salt for hashing
 * @returns {string} Hashed PIN
 */
const hashPin = (pin, salt) => {
    return CryptoJS.SHA256(pin + salt).toString();
};

/**
 * Check if PIN is set up
 * @returns {Promise<boolean>} True if PIN exists
 */
export const isPinSetup = async () => {
    try {
        const pinHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
        return !!pinHash;
    } catch (error) {
        console.error('Error checking PIN setup:', error);
        return false;
    }
};

/**
 * Set up user PIN
 * @param {string} pin - User's PIN (should be 4 digits)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const setupPin = async (pin) => {
    try {
        if (!pin || pin.length !== 4) {
            return { success: false, error: 'PIN must be exactly 4 digits' };
        }

        const salt = await getPinSalt();
        const pinHash = hashPin(pin, salt);

        await SecureStore.setItemAsync(PIN_HASH_KEY, pinHash);

        console.log('✅ PIN setup complete');
        return { success: true };
    } catch (error) {
        console.error('Error setting up PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Verify PIN
 * @param {string} pin - PIN to verify
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const verifyPin = async (pin) => {
    try {
        const salt = await getPinSalt();
        const pinHash = hashPin(pin, salt);
        const storedPinHash = await SecureStore.getItemAsync(PIN_HASH_KEY);

        if (pinHash === storedPinHash) {
            return { success: true };
        } else {
            return { success: false, error: 'Incorrect PIN' };
        }
    } catch (error) {
        console.error('Error verifying PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Change PIN
 * @param {string} oldPin - Current PIN
 * @param {string} newPin - New PIN
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const changePin = async (oldPin, newPin) => {
    try {
        // Verify old PIN
        const verifyResult = await verifyPin(oldPin);
        if (!verifyResult.success) {
            return { success: false, error: 'Incorrect old PIN' };
        }

        // Validate new PIN
        if (!newPin || newPin.length !== 4) {
            return { success: false, error: 'New PIN must be exactly 4 digits' };
        }

        // Set new PIN
        const salt = await getPinSalt();
        const newPinHash = hashPin(newPin, salt);
        await SecureStore.setItemAsync(PIN_HASH_KEY, newPinHash);

        console.log('✅ PIN changed successfully');
        return { success: true };
    } catch (error) {
        console.error('Error changing PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reset PIN using device biometric authentication
 * Master password remains accessible after PIN reset
 * @param {string} newPin - New PIN to set
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const resetPinViaBiometric = async (newPin) => {
    try {
        // Check if biometric is available
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
            return { success: false, error: 'Biometric authentication not available on this device' };
        }

        // Authenticate with biometric
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify your identity to reset PIN',
            fallbackLabel: 'Use device password',
            disableDeviceFallback: false,
        });

        if (!result.success) {
            return { success: false, error: 'Biometric authentication failed' };
        }

        // Validate new PIN
        if (!newPin || newPin.length !== 4) {
            return { success: false, error: 'New PIN must be exactly 4 digits' };
        }

        // Set new PIN
        const salt = await getPinSalt();
        const newPinHash = hashPin(newPin, salt);
        await SecureStore.setItemAsync(PIN_HASH_KEY, newPinHash);

        console.log('✅ PIN reset via biometric successful');
        return { success: true };
    } catch (error) {
        console.error('Error resetting PIN via biometric:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Complete first-time setup
 * Sets up encryption based on current mode
 * @param {string} pin - User's PIN
 * @param {string} masterPassword - User's master password (only if MASTER_PASSWORD mode)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const completeFirstTimeSetup = async (pin, masterPassword = null) => {
    try {
        // Set up PIN
        const pinResult = await setupPin(pin);
        if (!pinResult.success) {
            return pinResult;
        }

        // Set up encryption based on mode
        if (isMasterPasswordRequired()) {
            // MASTER_PASSWORD mode - requires master password
            if (!masterPassword) {
                return { success: false, error: 'Master password required in MASTER_PASSWORD mode' };
            }

            const encryptionResult = await encryptionSetupMasterPassword(masterPassword);
            if (!encryptionResult.success) {
                return encryptionResult;
            }
        } else {
            // APP_SECRET_ONLY mode - initialize with app secret
            const encryptionResult = await initializeAppSecretMode();
            if (!encryptionResult.success) {
                return encryptionResult;
            }
        }

        console.log('✅ First-time setup complete');
        return { success: true };
    } catch (error) {
        console.error('Error completing first-time setup:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if app is fully set up (PIN + encryption)
 * @returns {Promise<boolean>} True if app is set up
 */
export const isAppSetup = async () => {
    try {
        const pinSetup = await isPinSetup();

        if (isMasterPasswordRequired()) {
            const masterPasswordSetup = await isMasterPasswordSetup();
            return pinSetup && masterPasswordSetup;
        } else {
            // In APP_SECRET_ONLY mode, just need PIN
            return pinSetup;
        }
    } catch (error) {
        console.error('Error checking app setup:', error);
        return false;
    }
};

/**
 * View master password (requires PIN verification)
 * Only works in MASTER_PASSWORD mode
 * @param {string} pin - User's PIN for verification
 * @returns {Promise<{success: boolean, masterPassword?: string, error?: string}>}
 */
export const viewMasterPassword = async (pin) => {
    try {
        if (!isMasterPasswordRequired()) {
            return { success: false, error: 'Master password not available in APP_SECRET_ONLY mode' };
        }

        // Verify PIN
        const verifyResult = await verifyPin(pin);
        if (!verifyResult.success) {
            return { success: false, error: 'Incorrect PIN' };
        }

        // Get master password
        const result = await encryptionGetMasterPassword();
        return result;
    } catch (error) {
        console.error('Error viewing master password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Validate master password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, strength: string, message: string}}
 */
export const validateMasterPasswordStrength = (password) => {
    if (!password) {
        return { valid: false, strength: 'none', message: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, strength: 'weak', message: 'Password must be at least 8 characters' };
    }

    let strength = 'weak';
    let score = 0;

    // Length
    if (password.length >= 12) score += 2;
    else if (password.length >= 10) score += 1;

    // Contains uppercase
    if (/[A-Z]/.test(password)) score += 1;

    // Contains lowercase
    if (/[a-z]/.test(password)) score += 1;

    // Contains numbers
    if (/[0-9]/.test(password)) score += 1;

    // Contains special characters
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score >= 5) strength = 'strong';
    else if (score >= 3) strength = 'medium';

    const messages = {
        weak: 'Consider adding uppercase, numbers, and special characters',
        medium: 'Good password! Consider making it longer for extra security',
        strong: 'Excellent! This is a strong password'
    };

    return {
        valid: true,
        strength,
        message: messages[strength]
    };
};
