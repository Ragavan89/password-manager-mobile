/**
 * Application Configuration
 * Centralized place for app-wide constants
 */

export const AppConfig = {
    // Default values - actual limits are fetched from Firestore
    DEFAULT_CLOUD_PASSWORD_LIMIT: 50,

    // Firestore config collection path
    CONFIG_COLLECTION: 'config',
    CONFIG_DOC_ID: 'limits',
};
