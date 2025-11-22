/**
 * Application Constants
 * Centralized configuration values for the password manager app
 */

// Authentication
export const DEFAULT_PIN = '1234';

// Sync Configuration
export const SYNC_TIMEOUT_MS = 30000; // 30 seconds
export const SYNC_STATUS_CHECK_INTERVAL_MS = 500; // 0.5 seconds
export const MAX_SYNC_STATUS_CHECKS = 70; // 70 * 500ms = 35 seconds

// API Configuration
export const API_TIMEOUT_MS = 10000; // 10 seconds

// Storage Keys
export const STORAGE_KEYS = {
    API_URL: '@api_url',
    SYNC_QUEUE: '@sync_queue',
    LAST_SYNC: '@last_sync_time',
};

// Date Format
export const DATE_FORMAT = {
    DISPLAY: 'dd-MMM-yyyy HH:mm:ss', // e.g., "22-Jan-2025 10:30:45"
    MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// UI Messages
export const MESSAGES = {
    OFFLINE: '📡 Offline Mode',
    SYNCING: 'Syncing...',
    SYNC_SUCCESS: 'Sync completed successfully',
    SYNC_ERROR: 'Error during sync',
    COPY_SUCCESS: 'copied to clipboard!',
    PASSWORD_SAVED: 'Password saved and queued for sync',
    PASSWORD_UPDATED: 'Password updated and queued for sync',
    NO_PASSWORDS: 'No passwords found.',
    ADD_PASSWORD_HINT: 'Tap "Add New" in the header to add one.',
};

// Network Status
export const NETWORK_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
};
