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

    // Subscription tier constants (values come from Firestore, these are just for reference)
    SUBSCRIPTION_TIERS: {
        FREE: 'free',
        TIER1: 'tier1',
        TIER2: 'tier2'
    },
    
    // Default subscription tier for new users
    DEFAULT_SUBSCRIPTION_TIER: 'free',
};
