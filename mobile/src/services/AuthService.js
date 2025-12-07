/**
 * AuthService.js
 * 
 * High-level authentication orchestration service.
 * Coordinates between Encryption.js and screen components for:
 * - First-time app setup (PIN + Master Password)
 * - App setup status checks
 * - Master password viewing (with PIN verification)
 * - Password strength validation
 * 
 * Note: This is a facade over Encryption.js functions.
 * Used by: Setup screens, Settings screen
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import CryptoJS from 'crypto-js';
import { isMasterPasswordRequired } from '../config/EncryptionConfig';
import {
    setupMasterPassword as encryptionSetupMasterPassword,
    getMasterPassword as encryptionGetMasterPassword,
    isMasterPasswordSetup,
    initializeAppSecretMode,
    isPINSet as isEncryptionPinSet,
    setupPIN as encryptionSetupPin,
    verifyPIN as encryptionVerifyPIN
} from './Encryption';

/**
 * Storage Keys
 */


/**
 * Check if PIN is set up
 * @returns {Promise<boolean>} True if PIN exists
 */


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
        const pinResult = await encryptionSetupPin(pin);
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
        const pinSetup = await isEncryptionPinSet();

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
        const verifyResult = await encryptionVerifyPIN(pin);
        if (!verifyResult) {
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
