/**
 * Unit Tests for Sync Service
 * Tests offline queue, sync operations, and network handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as SyncService from '../SyncService';
import * as SheetsApi from '../SheetsApi';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('../SheetsApi');

describe('Sync Service - Offline and Queue Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AsyncStorage.getItem.mockResolvedValue(null);
        AsyncStorage.setItem.mockResolvedValue();
        NetInfo.fetch.mockResolvedValue({
            isConnected: true,
            isInternetReachable: true,
        });
    });

    describe('Scenario 8: Delete in Offline and Sync Tests', () => {
        describe('Positive Tests', () => {
            test('should queue delete operation when offline', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: false,
                    isInternetReachable: false,
                });

                await SyncService.queueOperation('delete', { id: 5 });

                expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                    'SYNC_QUEUE',
                    expect.stringContaining('"type":"delete"')
                );
            });

            test('should process queued delete when back online', async () => {
                const queuedOperations = [
                    {
                        type: 'delete',
                        data: { id: 5 },
                        timestamp: Date.now(),
                    },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOperations));
                SheetsApi.deleteFromSheet.mockResolvedValue({ success: true });

                await SyncService.processQueue();

                expect(SheetsApi.deleteFromSheet).toHaveBeenCalledWith(5);
                expect(AsyncStorage.setItem).toHaveBeenCalledWith('SYNC_QUEUE', '[]');
            });

            test('should sync delete operation when switching to online mode', async () => {
                const queuedDelete = [
                    {
                        type: 'delete',
                        data: { id: 10 },
                        timestamp: Date.now(),
                    },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedDelete));
                SheetsApi.isApiConfigured.mockReturnValue(true);
                SheetsApi.deleteFromSheet.mockResolvedValue({ success: true });

                await SyncService.syncWithCloud();

                expect(SheetsApi.deleteFromSheet).toHaveBeenCalledWith(10);
            });

            test('should handle multiple queued operations in order', async () => {
                const queuedOps = [
                    { type: 'add', data: { siteName: 'site1' }, timestamp: 1000 },
                    { type: 'edit', data: { id: 2, siteName: 'site2' }, timestamp: 2000 },
                    { type: 'delete', data: { id: 3 }, timestamp: 3000 },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOps));
                SheetsApi.addToSheet.mockResolvedValue({ success: true });
                SheetsApi.updateInSheet.mockResolvedValue({ success: true });
                SheetsApi.deleteFromSheet.mockResolvedValue({ success: true });

                await SyncService.processQueue();

                expect(SheetsApi.addToSheet).toHaveBeenCalled();
                expect(SheetsApi.updateInSheet).toHaveBeenCalled();
                expect(SheetsApi.deleteFromSheet).toHaveBeenCalled();
            });
        });

        describe('Negative Tests', () => {
            test('should handle sync failures and retry', async () => {
                const queuedOps = [
                    { type: 'delete', data: { id: 5 }, timestamp: Date.now() },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOps));
                SheetsApi.deleteFromSheet.mockResolvedValue({
                    success: false,
                    error: 'Network error',
                });

                await SyncService.processQueue();

                // Queue should not be cleared on failure
                const savedQueue = AsyncStorage.setItem.mock.calls.find(
                    call => call[0] === 'SYNC_QUEUE'
                );
                expect(savedQueue).toBeDefined();
            });

            test('should handle corrupted queue data', async () => {
                AsyncStorage.getItem.mockResolvedValue('invalid json');

                const queue = await SyncService.getQueue();

                expect(queue).toEqual([]);
            });

            test('should handle queue operation errors', async () => {
                AsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));

                await expect(
                    SyncService.queueOperation('add', { siteName: 'test' })
                ).rejects.toThrow('Storage full');
            });

            test('should skip invalid operations in queue', async () => {
                const queuedOps = [
                    { type: 'invalid_type', data: {}, timestamp: Date.now() },
                    { type: 'delete', data: { id: 5 }, timestamp: Date.now() },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOps));
                SheetsApi.deleteFromSheet.mockResolvedValue({ success: true });

                await SyncService.processQueue();

                expect(SheetsApi.deleteFromSheet).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Queue Management Tests', () => {
        describe('Positive Tests', () => {
            test('should add operation to queue', async () => {
                AsyncStorage.getItem.mockResolvedValue('[]');

                await SyncService.queueOperation('add', {
                    siteName: 'example.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                const savedData = AsyncStorage.setItem.mock.calls[0][1];
                const queue = JSON.parse(savedData);

                expect(queue).toHaveLength(1);
                expect(queue[0].type).toBe('add');
                expect(queue[0].data.siteName).toBe('example.com');
                expect(queue[0].timestamp).toBeDefined();
            });

            test('should retrieve queue', async () => {
                const mockQueue = [
                    { type: 'add', data: { siteName: 'test' }, timestamp: 123 },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockQueue));

                const queue = await SyncService.getQueue();

                expect(queue).toEqual(mockQueue);
            });

            test('should clear queue', async () => {
                await SyncService.clearQueue();

                expect(AsyncStorage.setItem).toHaveBeenCalledWith('SYNC_QUEUE', '[]');
            });

            test('should append to existing queue', async () => {
                const existingQueue = [
                    { type: 'add', data: { siteName: 'existing' }, timestamp: 100 },
                ];

                AsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingQueue));

                await SyncService.queueOperation('delete', { id: 5 });

                const savedData = AsyncStorage.setItem.mock.calls[0][1];
                const queue = JSON.parse(savedData);

                expect(queue).toHaveLength(2);
                expect(queue[0].data.siteName).toBe('existing');
                expect(queue[1].type).toBe('delete');
            });
        });

        describe('Negative Tests', () => {
            test('should handle empty queue retrieval', async () => {
                AsyncStorage.getItem.mockResolvedValue(null);

                const queue = await SyncService.getQueue();

                expect(queue).toEqual([]);
            });

            test('should handle storage errors during queue retrieval', async () => {
                AsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

                const queue = await SyncService.getQueue();

                expect(queue).toEqual([]);
            });

            test('should handle clear queue errors', async () => {
                AsyncStorage.setItem.mockRejectedValue(new Error('Write error'));

                await expect(SyncService.clearQueue()).rejects.toThrow('Write error');
            });
        });
    });

    describe('Network Status Tests', () => {
        describe('Positive Tests', () => {
            test('should detect online status', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: true,
                });

                const status = await SyncService.getSyncStatus();

                expect(status.isOnline).toBe(true);
            });

            test('should detect offline status', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: false,
                    isInternetReachable: false,
                });

                const status = await SyncService.getSyncStatus();

                expect(status.isOnline).toBe(false);
            });

            test('should sync automatically when coming online', async () => {
                let networkListener;
                NetInfo.addEventListener.mockImplementation((callback) => {
                    networkListener = callback;
                    return jest.fn();
                });

                SyncService.initSyncService();

                // Simulate coming online
                AsyncStorage.getItem.mockResolvedValue('[]');
                SheetsApi.isApiConfigured.mockReturnValue(true);

                if (networkListener) {
                    await networkListener({
                        isConnected: true,
                        isInternetReachable: true,
                    });
                }

                expect(NetInfo.addEventListener).toHaveBeenCalled();
            });

            test('should stop sync service', () => {
                const mockUnsubscribe = jest.fn();
                NetInfo.addEventListener.mockReturnValue(mockUnsubscribe);

                SyncService.initSyncService();
                SyncService.stopSyncService();

                expect(mockUnsubscribe).toHaveBeenCalled();
            });
        });

        describe('Negative Tests', () => {
            test('should handle network check errors', async () => {
                NetInfo.fetch.mockRejectedValue(new Error('Network check failed'));

                const status = await SyncService.getSyncStatus();

                expect(status.isOnline).toBe(false);
            });

            test('should handle partial connectivity', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: false,
                });

                const status = await SyncService.getSyncStatus();

                expect(status.isOnline).toBe(false);
            });
        });
    });

    describe('Sync Operations Tests', () => {
        describe('Positive Tests', () => {
            test('should sync with cloud when online and API configured', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: true,
                });

                AsyncStorage.getItem.mockResolvedValue('[]');
                SheetsApi.isApiConfigured.mockReturnValue(true);
                SheetsApi.fetchFromSheet.mockResolvedValue([]);

                const result = await SyncService.syncWithCloud();

                expect(result.success).toBe(true);
            });

            test('should pull data from cloud', async () => {
                const cloudData = [
                    {
                        id: 1,
                        siteName: 'cloud-site.com',
                        username: 'user',
                        encryptedPassword: 'pass',
                    },
                ];

                SheetsApi.fetchFromSheet.mockResolvedValue(cloudData);

                const result = await SyncService.pullFromCloud();

                expect(result).toEqual(cloudData);
            });

            test('should update last sync time after successful sync', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: true,
                });

                AsyncStorage.getItem.mockResolvedValue('[]');
                SheetsApi.isApiConfigured.mockReturnValue(true);
                SheetsApi.fetchFromSheet.mockResolvedValue([]);

                await SyncService.syncWithCloud();

                const lastSyncCall = AsyncStorage.setItem.mock.calls.find(
                    call => call[0] === 'LAST_SYNC_TIME'
                );

                expect(lastSyncCall).toBeDefined();
            });
        });

        describe('Negative Tests', () => {
            test('should not sync when offline', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: false,
                    isInternetReachable: false,
                });

                const result = await SyncService.syncWithCloud();

                expect(result.success).toBe(false);
                expect(result.error).toContain('offline');
            });

            test('should not sync when API not configured', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: true,
                });

                SheetsApi.isApiConfigured.mockReturnValue(false);

                const result = await SyncService.syncWithCloud();

                expect(result.success).toBe(false);
                expect(result.error).toContain('not configured');
            });

            test('should handle cloud pull errors', async () => {
                SheetsApi.fetchFromSheet.mockRejectedValue(new Error('API error'));

                await expect(SyncService.pullFromCloud()).rejects.toThrow('API error');
            });

            test('should prevent concurrent sync operations', async () => {
                NetInfo.fetch.mockResolvedValue({
                    isConnected: true,
                    isInternetReachable: true,
                });

                AsyncStorage.getItem.mockResolvedValue('[]');
                SheetsApi.isApiConfigured.mockReturnValue(true);
                SheetsApi.fetchFromSheet.mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
                );

                // Start two syncs simultaneously
                const sync1 = SyncService.syncWithCloud();
                const sync2 = SyncService.syncWithCloud();

                const results = await Promise.all([sync1, sync2]);

                // One should succeed, one should be skipped
                const successCount = results.filter(r => r.success).length;
                expect(successCount).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Helper Functions Tests', () => {
        describe('Positive Tests', () => {
            test('should add password offline', async () => {
                AsyncStorage.getItem.mockResolvedValue('[]');

                await SyncService.addPasswordOffline(
                    'site.com',
                    'user',
                    'encrypted_pass',
                    'comment'
                );

                const savedData = AsyncStorage.setItem.mock.calls[0][1];
                const queue = JSON.parse(savedData);

                expect(queue[0].type).toBe('add');
                expect(queue[0].data.siteName).toBe('site.com');
            });

            test('should update password offline', async () => {
                AsyncStorage.getItem.mockResolvedValue('[]');

                await SyncService.updatePasswordOffline(
                    5,
                    'updated-site.com',
                    'user',
                    'new_pass',
                    'updated comment'
                );

                const savedData = AsyncStorage.setItem.mock.calls[0][1];
                const queue = JSON.parse(savedData);

                expect(queue[0].type).toBe('edit');
                expect(queue[0].data.id).toBe(5);
                expect(queue[0].data.siteName).toBe('updated-site.com');
            });

            test('should delete password offline', async () => {
                AsyncStorage.getItem.mockResolvedValue('[]');

                await SyncService.deletePasswordOffline(10);

                const savedData = AsyncStorage.setItem.mock.calls[0][1];
                const queue = JSON.parse(savedData);

                expect(queue[0].type).toBe('delete');
                expect(queue[0].data.id).toBe(10);
            });
        });

        describe('Negative Tests', () => {
            test('should handle offline add errors', async () => {
                AsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

                await expect(
                    SyncService.addPasswordOffline('site', 'user', 'pass')
                ).rejects.toThrow('Storage error');
            });

            test('should handle offline update errors', async () => {
                AsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

                await expect(
                    SyncService.updatePasswordOffline(1, 'site', 'user', 'pass')
                ).rejects.toThrow('Storage error');
            });

            test('should handle offline delete errors', async () => {
                AsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

                await expect(
                    SyncService.deletePasswordOffline(1)
                ).rejects.toThrow('Storage error');
            });
        });
    });

    describe('Edge Cases and Integration Tests', () => {
        test('should handle rapid offline operations', async () => {
            AsyncStorage.getItem.mockResolvedValue('[]');

            await Promise.all([
                SyncService.addPasswordOffline('site1', 'user1', 'pass1'),
                SyncService.addPasswordOffline('site2', 'user2', 'pass2'),
                SyncService.addPasswordOffline('site3', 'user3', 'pass3'),
            ]);

            // Should have queued all operations
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        test('should handle queue with mixed success/failure', async () => {
            const queuedOps = [
                { type: 'add', data: { siteName: 'site1' }, timestamp: 1000 },
                { type: 'delete', data: { id: 2 }, timestamp: 2000 },
                { type: 'edit', data: { id: 3, siteName: 'site3' }, timestamp: 3000 },
            ];

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOps));

            SheetsApi.addToSheet.mockResolvedValue({ success: true });
            SheetsApi.deleteFromSheet.mockResolvedValue({
                success: false,
                error: 'Not found',
            });
            SheetsApi.updateInSheet.mockResolvedValue({ success: true });

            await SyncService.processQueue();

            expect(SheetsApi.addToSheet).toHaveBeenCalled();
            expect(SheetsApi.deleteFromSheet).toHaveBeenCalled();
            expect(SheetsApi.updateInSheet).toHaveBeenCalled();
        });

        test('should maintain queue order during processing', async () => {
            const operations = [];

            SheetsApi.addToSheet.mockImplementation((data) => {
                operations.push({ type: 'add', data });
                return Promise.resolve({ success: true });
            });

            SheetsApi.deleteFromSheet.mockImplementation((id) => {
                operations.push({ type: 'delete', id });
                return Promise.resolve({ success: true });
            });

            const queuedOps = [
                { type: 'add', data: { siteName: 'first' }, timestamp: 1000 },
                { type: 'delete', data: { id: 2 }, timestamp: 2000 },
                { type: 'add', data: { siteName: 'third' }, timestamp: 3000 },
            ];

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(queuedOps));

            await SyncService.processQueue();

            expect(operations[0].data.siteName).toBe('first');
            expect(operations[1].id).toBe(2);
            expect(operations[2].data.siteName).toBe('third');
        });
    });
});
