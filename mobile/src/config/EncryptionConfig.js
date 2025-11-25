/**
 * Encryption Configuration
 * 
 * This file controls the encryption mode for the entire application.
 * Change the MODE constant to switch between encryption strategies.
 */

/**
 * Encryption Modes
 * 
 * MASTER_PASSWORD: 
 *   - User creates a unique master password during setup
 *   - Master password is encrypted with app secret and stored
 *   - Credentials are encrypted with a key derived from master password
 *   - User can view their master password in Settings
 *   - More secure (per-user encryption)
 * 
 * APP_SECRET_ONLY:
 *   - No master password required
 *   - Credentials are encrypted directly with the app secret
 *   - Simpler setup, but same encryption key for all users
 *   - Less secure but easier to use
 */
export const ENCRYPTION_MODES = {
    MASTER_PASSWORD: 'MASTER_PASSWORD',
    APP_SECRET_ONLY: 'APP_SECRET_ONLY',
};

/**
 * Encryption Configuration
 * 
 * To switch modes:
 * 1. Change MODE to desired encryption mode
 * 2. Existing users will be prompted to migrate their data
 * 3. New users will follow the flow for the selected mode
 */
export const ENCRYPTION_CONFIG = {
    /**
     * Current encryption mode
     * Set to ENCRYPTION_MODES.MASTER_PASSWORD or ENCRYPTION_MODES.APP_SECRET_ONLY
     */
    MODE: ENCRYPTION_MODES.MASTER_PASSWORD,

    /**
     * Application secret used for encryption
     * - In MASTER_PASSWORD mode: Used to encrypt the user's master password
     * - In APP_SECRET_ONLY mode: Used directly to encrypt credentials
     * 
     * ⚠️ IMPORTANT: This is hardcoded in the app and can be extracted from the APK.
     * For a local-first password manager, this is acceptable, but be aware of the limitation.
     */
    APP_SECRET: 'keyvault-pro-encryption-secret-2025-v1',

    /**
     * PBKDF2 iterations for key derivation
     * Higher = more secure but slower
     * 10000 is a good balance for mobile devices
     */
    KEY_DERIVATION_ITERATIONS: 1000,

    /**
     * Salt for PBKDF2 key derivation
     * This is used when deriving encryption keys from master password
     */
    PBKDF2_SALT: 'keyvault-pro-salt-2025',
};

/**
 * Helper function to check if master password is required
 * @returns {boolean} True if current mode requires master password
 */
export const isMasterPasswordRequired = () => {
    return ENCRYPTION_CONFIG.MODE === ENCRYPTION_MODES.MASTER_PASSWORD;
};

/**
 * Helper function to get current encryption mode
 * @returns {string} Current encryption mode
 */
export const getEncryptionMode = () => {
    return ENCRYPTION_CONFIG.MODE;
};
