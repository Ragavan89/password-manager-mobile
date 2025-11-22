import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { addToSheet, updateInSheet, deleteFromSheet, fetchFromSheet } from './SheetsApi';
import { getPasswords, upsertPassword, deletePassword, clearAllPasswords } from './Database';

const SYNC_QUEUE_KEY = 'SYNC_QUEUE';
const LAST_SYNC_KEY = 'LAST_SYNC_TIME';

let syncInProgress = false;
let networkListenerUnsubscribe = null;

// Queue structure: { type: 'add'|'edit'|'delete', data: {...}, timestamp: number }

export const initSyncService = () => {
    // Listen for network changes
    networkListenerUnsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
            console.log('Network connected, triggering sync...');
            syncWithCloud();
        }
    });

    // Initial sync on app start
    syncWithCloud();
};

export const stopSyncService = () => {
    if (networkListenerUnsubscribe) {
        networkListenerUnsubscribe();
    }
};

export const queueOperation = async (type, data) => {
    try {
        const queue = await getQueue();
        const operation = {
            type,
            data,
            timestamp: Date.now(),
            id: `${type}_${Date.now()}_${Math.random()}`
        };
        queue.push(operation);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

        // Try to sync immediately if online
        const netState = await NetInfo.fetch();
        if (netState.isConnected && netState.isInternetReachable) {
            syncWithCloud();
        }
    } catch (error) {
        console.error('Error queuing operation:', error);
    }
};

export const getQueue = async () => {
    try {
        const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
        console.error('Error getting queue:', error);
        return [];
    }
};

export const clearQueue = async () => {
    try {
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
    } catch (error) {
        console.error('Error clearing queue:', error);
    }
};

export const getSyncStatus = async () => {
    const queue = await getQueue();
    const netState = await NetInfo.fetch();
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

    return {
        isOnline: netState.isConnected && netState.isInternetReachable,
        pendingOperations: queue.length,
        lastSyncTime: lastSync ? parseInt(lastSync) : null,
        isSyncing: syncInProgress
    };
};

export const syncWithCloud = async () => {
    if (syncInProgress) {
        console.log('Sync already in progress, skipping...');
        return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
        console.log('No internet connection, skipping sync');
        return;
    }

    syncInProgress = true;
    console.log('🔄 Sync started - syncInProgress set to TRUE');

    // Safety timeout: force reset syncInProgress after 30 seconds
    const timeoutId = setTimeout(() => {
        if (syncInProgress) {
            console.warn('⏰ Sync timeout - forcing reset of syncInProgress flag');
            syncInProgress = false;
        }
    }, 30000); // 30 seconds

    try {
        // Step 1: Process the sync queue (push local changes to cloud)
        await processQueue();
        console.log('✅ Queue processed');

        // Step 2: Pull latest data from cloud and merge with local
        await pullFromCloud();
        console.log('✅ Cloud data pulled');

        // Update last sync time
        await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        console.log('✅ Sync completed successfully');
    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        clearTimeout(timeoutId); // Clear the timeout
        syncInProgress = false;
        console.log('🏁 Sync finished - syncInProgress set to FALSE');
    }
};

const processQueue = async () => {
    const queue = await getQueue();
    if (queue.length === 0) {
        console.log('No pending operations to sync');
        return;
    }

    console.log(`Processing ${queue.length} queued operations...`);
    const failedOperations = [];

    for (const operation of queue) {
        try {
            switch (operation.type) {
                case 'add':
                    await addToSheet(
                        operation.data.siteName,
                        operation.data.username,
                        operation.data.encryptedPassword,
                        operation.data.comments
                    );
                    break;
                case 'edit':
                    await updateInSheet(
                        operation.data.id,
                        operation.data.siteName,
                        operation.data.username,
                        operation.data.encryptedPassword,
                        operation.data.comments
                    );
                    break;
                case 'delete':
                    await deleteFromSheet(operation.data.id);
                    break;
            }
            console.log(`Synced ${operation.type} operation for ${operation.data.siteName || operation.data.id}`);
        } catch (error) {
            console.error(`Failed to sync ${operation.type} operation:`, error);
            failedOperations.push(operation);
        }
    }

    // Update queue with only failed operations
    if (failedOperations.length > 0) {
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(failedOperations));
        console.log(`${failedOperations.length} operations failed, will retry later`);
    } else {
        await clearQueue();
        console.log('All operations synced successfully');
    }
};

const pullFromCloud = async () => {
    try {
        console.log('Pulling latest data from cloud...');
        const cloudData = await fetchFromSheet();

        if (!cloudData || cloudData.length === 0) {
            console.log('No data in cloud');
            return;
        }

        // Get local data
        const localData = getPasswords();

        // Create a map of cloud IDs for quick lookup
        const cloudIds = new Set(cloudData.map(item => item.id));
        const localIds = new Set(localData.map(item => item.id));

        // Upsert all cloud data to local
        for (const cloudItem of cloudData) {
            upsertPassword(
                cloudItem.id,
                cloudItem.siteName,
                cloudItem.username,
                cloudItem.encryptedPassword,
                cloudItem.lastModified,
                cloudItem.comments
            );
        }

        // Delete local items that don't exist in cloud
        for (const localItem of localData) {
            if (!cloudIds.has(localItem.id)) {
                deletePassword(localItem.id);
            }
        }

        console.log(`Synced ${cloudData.length} passwords from cloud`);
    } catch (error) {
        console.error('Error pulling from cloud:', error);
    }
};

// Helper function to add password locally and queue for sync
export const addPasswordOffline = async (siteName, username, encryptedPassword, comments = '') => {
    const id = Date.now();

    // Add to local database first
    const { addPassword } = require('./Database');
    const localId = addPassword(siteName, username, encryptedPassword, comments);

    // Queue for sync
    await queueOperation('add', {
        siteName,
        username,
        encryptedPassword,
        comments
    });

    return localId;
};

// Helper function to update password locally and queue for sync
export const updatePasswordOffline = async (id, siteName, username, encryptedPassword, comments = '') => {
    const { updatePassword } = require('./Database');

    // Update local database first
    updatePassword(id, siteName, username, encryptedPassword, comments);

    // Queue for sync
    await queueOperation('edit', {
        id,
        siteName,
        username,
        encryptedPassword,
        comments
    });
};

// Helper function to delete password locally and queue for sync
export const deletePasswordOffline = async (id) => {
    // Delete from local database first
    deletePassword(id);

    // Queue for sync
    await queueOperation('delete', { id });
};
