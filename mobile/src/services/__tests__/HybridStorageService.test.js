/**
 * Unit Tests for Hybrid Storage Service
 * Tests bidirectional sync, limit checks, device switching, and offline scenarios
 */

import * as HybridStorageService from '../HybridStorageService';
import * as Database from '../Database';
import * as FirestoreService from '../FirestoreService';
import * as SecureStore from 'expo-secure-store';
import { doc, getDoc } from 'firebase/firestore';

jest.mock('../Database');
jest.mock('../FirestoreService');
jest.mock('expo-secure-store');
jest.mock('firebase/firestore');
jest.mock('../../firebase.config', () => ({ app: {} }));
jest.mock('../FirebaseAuthService', () => ({
    getCurrentUser: jest.fn(() => ({ uid: 'test_user_123' })),
    signInAnonymouslyUser: jest.fn(),
}));

describe('Hybrid Storage Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SecureStore.getItemAsync.mockResolvedValue('https://sheets.api.url');
    });

    describe('Scenario 5: Limit Check Tests', () => {
        describe('Positive Tests', () => {
            test('should fetch cloud password limit from Firestore', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 100 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                const limit = await HybridStorageService.getCloudPasswordLimit();

                expect(limit).toBe(100);
                expect(getDoc).toHaveBeenCalled();
            });

            test('should allow save within limit', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 10 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue(
                    Array(5).fill({ id: 1, siteName: 'test' })
                );

                FirestoreService.savePassword.mockResolvedValue({
                    success: true,
                    id: 'cloud_id',
                });

                Database.addPassword.mockReturnValue({
                    id: 1,
                    lastModified: new Date().toISOString(),
                });

                const passwordData = {
                    siteName: 'example.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                };

                const result = await HybridStorageService.savePassword(passwordData);

                expect(result.success).toBe(true);
                expect(Database.addPassword).toHaveBeenCalled();
            });

            test('should use default limit when Firestore config not available', async () => {
                const mockDoc = {
                    exists: () => false,
                };
                getDoc.mockResolvedValue(mockDoc);

                const limit = await HybridStorageService.getCloudPasswordLimit();

                expect(limit).toBe(50); // Default limit
            });
        });

        describe('Negative Tests', () => {
            test('should reject save when limit exceeded', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 5 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue(
                    Array(5).fill({ id: 1, siteName: 'test' })
                );

                const passwordData = {
                    siteName: 'example.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                };

                const result = await HybridStorageService.savePassword(passwordData);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Storage limit reached');
                expect(Database.addPassword).not.toHaveBeenCalled();
            });

            test('should handle Firestore limit fetch errors', async () => {
                getDoc.mockRejectedValue(new Error('Network error'));

                const limit = await HybridStorageService.getCloudPasswordLimit();

                expect(limit).toBe(50); // Should return default on error
            });

            test('should reject when exactly at limit', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 3 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue([
                    { id: 1 },
                    { id: 2 },
                    { id: 3 },
                ]);

                const result = await HybridStorageService.savePassword({
                    siteName: 'test',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('limit');
            });
        });
    });

    describe('Scenario 1 & 2: New Entry and Edit Tests', () => {
        describe('Positive Tests', () => {
            test('should save new password to both local and cloud', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 100 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue([]);
                Database.addPassword.mockReturnValue({
                    id: 1,
                    lastModified: '2024-01-01T00:00:00.000Z',
                });

                FirestoreService.savePassword.mockResolvedValue({
                    success: true,
                    id: 'cloud_id_123',
                });

                const passwordData = {
                    siteName: 'example.com',
                    username: 'user@example.com',
                    encryptedPassword: 'encrypted_pass',
                    comments: 'Test comment',
                };

                const result = await HybridStorageService.savePassword(passwordData);

                expect(result.success).toBe(true);
                expect(result.localId).toBe(1);
                expect(Database.addPassword).toHaveBeenCalledWith(
                    'example.com',
                    'user@example.com',
                    'encrypted_pass',
                    'Test comment',
                    1
                );
                expect(FirestoreService.savePassword).toHaveBeenCalled();
            });

            test('should update password in both local and cloud', async () => {
                Database.updatePassword.mockReturnValue({
                    lastModified: '2024-01-01T00:00:00.000Z',
                });

                FirestoreService.updatePassword.mockResolvedValue({ success: true });

                const passwordData = {
                    siteName: 'updated-site.com',
                    username: 'updated@user.com',
                    encryptedPassword: 'new_pass',
                    comments: 'Updated',
                };

                const result = await HybridStorageService.updatePassword(1, passwordData);

                expect(result.success).toBe(true);
                expect(Database.updatePassword).toHaveBeenCalledWith(
                    1,
                    'updated-site.com',
                    'updated@user.com',
                    'new_pass',
                    'Updated'
                );
            });

            test('should save locally when cloud sync disabled', async () => {
                SecureStore.getItemAsync.mockResolvedValue(null); // No API URL

                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 100 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue([]);
                Database.addPassword.mockReturnValue({
                    id: 1,
                    lastModified: '2024-01-01T00:00:00.000Z',
                });

                const result = await HybridStorageService.savePassword({
                    siteName: 'test.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                expect(result.success).toBe(true);
                expect(Database.addPassword).toHaveBeenCalled();
                expect(FirestoreService.savePassword).not.toHaveBeenCalled();
            });
        });

        describe('Negative Tests', () => {
            test('should handle local save errors', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 100 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue([]);
                Database.addPassword.mockImplementation(() => {
                    throw new Error('Database error');
                });

                const result = await HybridStorageService.savePassword({
                    siteName: 'test',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Database error');
            });

            test('should succeed locally even if cloud save fails', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ maxPasswords: 100 }),
                };
                getDoc.mockResolvedValue(mockDoc);

                Database.getPasswords.mockReturnValue([]);
                Database.addPassword.mockReturnValue({
                    id: 1,
                    lastModified: '2024-01-01T00:00:00.000Z',
                });

                FirestoreService.savePassword.mockResolvedValue({
                    success: false,
                    error: 'Network error',
                });

                const result = await HybridStorageService.savePassword({
                    siteName: 'test',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                expect(result.success).toBe(true);
                expect(Database.addPassword).toHaveBeenCalled();
            });

            test('should handle update errors', async () => {
                Database.updatePassword.mockImplementation(() => {
                    throw new Error('Update failed');
                });

                const result = await HybridStorageService.updatePassword(1, {
                    siteName: 'test',
                    username: 'user',
                    encryptedPassword: 'pass',
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Update failed');
            });
        });
    });

    describe('Scenario 6 & 7: Sync After New Login and Device Switch', () => {
        describe('Positive Tests', () => {
            test('should download passwords on new device (empty local DB)', async () => {
                Database.getPasswords.mockReturnValue([]);

                const cloudPasswords = [
                    {
                        id: 'cloud1',
                        siteName: 'site1.com',
                        username: 'user1',
                        encryptedPassword: 'pass1',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        comments: 'Comment 1',
                    },
                    {
                        id: 'cloud2',
                        siteName: 'site2.com',
                        username: 'user2',
                        encryptedPassword: 'pass2',
                        lastModified: '2024-01-02T00:00:00.000Z',
                        comments: 'Comment 2',
                    },
                ];

                FirestoreService.getPasswords.mockResolvedValue({
                    success: true,
                    passwords: cloudPasswords,
                });

                Database.upsertPassword.mockImplementation(() => { });

                const result = await HybridStorageService.syncFromCloud();

                expect(result.success).toBe(true);
                expect(Database.upsertPassword).toHaveBeenCalledTimes(2);
                expect(Database.upsertPassword).toHaveBeenCalledWith(
                    'cloud1',
                    'site1.com',
                    'user1',
                    'pass1',
                    '2024-01-01T00:00:00.000Z',
                    'Comment 1'
                );
            });

            test('should merge local and cloud data on first sync', async () => {
                const localPasswords = [
                    {
                        id: 1,
                        siteName: 'local-site.com',
                        username: 'local-user',
                        encryptedPassword: 'local-pass',
                        lastModified: '2024-01-01T00:00:00.000Z',
                    },
                ];

                const cloudPasswords = [
                    {
                        id: 'cloud1',
                        siteName: 'cloud-site.com',
                        username: 'cloud-user',
                        encryptedPassword: 'cloud-pass',
                        lastModified: '2024-01-02T00:00:00.000Z',
                    },
                ];

                Database.getPasswords.mockReturnValue(localPasswords);
                FirestoreService.getPasswords.mockResolvedValue({
                    success: true,
                    passwords: cloudPasswords,
                });

                FirestoreService.savePassword.mockResolvedValue({
                    success: true,
                    id: 'new_cloud_id',
                });

                Database.upsertPassword.mockImplementation(() => { });

                const result = await HybridStorageService.syncBidirectional();

                expect(result.success).toBe(true);
                expect(Database.upsertPassword).toHaveBeenCalled();
                expect(FirestoreService.savePassword).toHaveBeenCalled();
            });

            test('should handle Last-Write-Wins conflict resolution', async () => {
                const olderDate = '2024-01-01T00:00:00.000Z';
                const newerDate = '2024-01-02T00:00:00.000Z';

                const localPasswords = [
                    {
                        id: 'same_id',
                        siteName: 'local-version',
                        username: 'user',
                        encryptedPassword: 'local-pass',
                        lastModified: olderDate,
                    },
                ];

                const cloudPasswords = [
                    {
                        id: 'same_id',
                        siteName: 'cloud-version',
                        username: 'user',
                        encryptedPassword: 'cloud-pass',
                        lastModified: newerDate,
                    },
                ];

                Database.getPasswords.mockReturnValue(localPasswords);
                FirestoreService.getPasswords.mockResolvedValue({
                    success: true,
                    passwords: cloudPasswords,
                });

                Database.upsertPassword.mockImplementation(() => { });

                const result = await HybridStorageService.syncBidirectional();

                expect(result.success).toBe(true);
                // Should update local with newer cloud version
                expect(Database.upsertPassword).toHaveBeenCalledWith(
                    'same_id',
                    'cloud-version',
                    'user',
                    'cloud-pass',
                    newerDate,
                    undefined
                );
            });

            test('should maintain data consistency across devices', async () => {
                const sharedPassword = {
                    id: 'shared_id',
                    siteName: 'shared-site.com',
                    username: 'shared-user',
                    encryptedPassword: 'shared-pass',
                    lastModified: '2024-01-01T00:00:00.000Z',
                };

                Database.getPasswords.mockReturnValue([sharedPassword]);
                FirestoreService.getPasswords.mockResolvedValue({
                    success: true,
                    passwords: [sharedPassword],
                });

                const result = await HybridStorageService.syncBidirectional();

                expect(result.success).toBe(true);
                // No changes needed when data is identical
            });
        });

        describe('Negative Tests', () => {
            test('should handle cloud fetch errors during sync', async () => {
                FirestoreService.getPasswords.mockResolvedValue({
                    success: false,
                    error: 'Network error',
                    passwords: [],
                });

                const result = await HybridStorageService.syncFromCloud();

                expect(result.success).toBe(false);
                expect(result.error).toContain('Network error');
            });

            test('should handle sync conflicts gracefully', async () => {
                Database.getPasswords.mockImplementation(() => {
                    throw new Error('Database locked');
                });

                const result = await HybridStorageService.syncBidirectional();

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should handle missing cloud data', async () => {
                FirestoreService.getPasswords.mockResolvedValue({
                    success: true,
                    passwords: [],
                });

                Database.getPasswords.mockReturnValue([]);

                const result = await HybridStorageService.syncFromCloud();

                expect(result.success).toBe(true);
                expect(Database.upsertPassword).not.toHaveBeenCalled();
            });
        });
    });

    describe('Scenario 8: Delete in Offline and Sync', () => {
        describe('Positive Tests', () => {
            test('should delete locally and sync to cloud when online', async () => {
                Database.deletePassword.mockImplementation(() => { });
                FirestoreService.deletePassword.mockResolvedValue({ success: true });

                const result = await HybridStorageService.deletePassword(5);

                expect(result.success).toBe(true);
                expect(Database.deletePassword).toHaveBeenCalledWith(5);
                expect(FirestoreService.deletePassword).toHaveBeenCalled();
            });

            test('should delete locally even if cloud delete fails', async () => {
                Database.deletePassword.mockImplementation(() => { });
                FirestoreService.deletePassword.mockResolvedValue({
                    success: false,
                    error: 'Network error',
                });

                const result = await HybridStorageService.deletePassword(5);

                expect(result.success).toBe(true);
                expect(Database.deletePassword).toHaveBeenCalled();
            });

            test('should handle delete when cloud sync disabled', async () => {
                SecureStore.getItemAsync.mockResolvedValue(null);
                Database.deletePassword.mockImplementation(() => { });

                const result = await HybridStorageService.deletePassword(5);

                expect(result.success).toBe(true);
                expect(Database.deletePassword).toHaveBeenCalled();
                expect(FirestoreService.deletePassword).not.toHaveBeenCalled();
            });
        });

        describe('Negative Tests', () => {
            test('should handle local delete errors', async () => {
                Database.deletePassword.mockImplementation(() => {
                    throw new Error('Delete failed');
                });

                const result = await HybridStorageService.deletePassword(5);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Delete failed');
            });

            test('should handle delete of non-existent password', async () => {
                Database.deletePassword.mockImplementation(() => { });
                FirestoreService.deletePassword.mockResolvedValue({
                    success: false,
                    error: 'Document not found',
                });

                const result = await HybridStorageService.deletePassword(999);

                expect(result.success).toBe(true);
                expect(Database.deletePassword).toHaveBeenCalled();
            });
        });
    });

    describe('Utility Functions', () => {
        test('should check if cloud sync is enabled', async () => {
            SecureStore.getItemAsync.mockResolvedValue('https://api.url');

            const isEnabled = await HybridStorageService.isCloudSyncEnabled();

            expect(isEnabled).toBe(true);
        });

        test('should detect when cloud sync is disabled', async () => {
            SecureStore.getItemAsync.mockResolvedValue(null);

            const isEnabled = await HybridStorageService.isCloudSyncEnabled();

            expect(isEnabled).toBe(false);
        });

        test('should get last sync time', async () => {
            SecureStore.getItemAsync.mockResolvedValue('2024-01-01T00:00:00.000Z');

            const lastSync = await HybridStorageService.getLastSyncTime();

            expect(lastSync).toBe('2024-01-01T00:00:00.000Z');
        });

        test('should retrieve all passwords from local DB', async () => {
            const mockPasswords = [
                { id: 1, siteName: 'test1.com' },
                { id: 2, siteName: 'test2.com' },
            ];

            Database.getPasswords.mockReturnValue(mockPasswords);

            const result = await HybridStorageService.getPasswords();

            expect(result).toEqual(mockPasswords);
        });
    });

    describe('Performance and Scale Tests', () => {
        test('should handle large number of passwords efficiently', async () => {
            const largePasswordSet = Array.from({ length: 1000 }, (_, i) => ({
                id: `id_${i}`,
                siteName: `site${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: new Date().toISOString(),
            }));

            Database.getPasswords.mockReturnValue([]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: largePasswordSet,
            });

            Database.upsertPassword.mockImplementation(() => { });

            const startTime = Date.now();
            const result = await HybridStorageService.syncFromCloud();
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(Database.upsertPassword).toHaveBeenCalledTimes(1000);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
        });

        test('should handle batch operations efficiently', async () => {
            const localPasswords = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                siteName: `local${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: new Date().toISOString(),
            }));

            Database.getPasswords.mockReturnValue(localPasswords);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            FirestoreService.savePassword.mockResolvedValue({
                success: true,
                id: 'cloud_id',
            });

            const result = await HybridStorageService.syncBidirectional();

            expect(result.success).toBe(true);
        });
    });

    describe('Bug Fix: Duplicate Upload Prevention', () => {
        test('should not upload password twice when saved locally then synced after delete', async () => {
            // Scenario: User's exact bug report
            // 1. Login to new device (cloud has 10 passwords at limit)
            // 2. Add "spaceX" → Saved locally only (cloudSynced=0) because limit reached
            // 3. Delete old entry → Frees up space
            // 4. Sync → Should upload "spaceX" ONCE, not twice

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 10 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            // Cloud has 10 passwords (at limit)
            const cloudPasswords = Array.from({ length: 10 }, (_, i) => ({
                id: `cloud_${i}`,
                localId: i + 1,
                siteName: `site${i + 1}.com`,
                username: `user${i + 1}`,
                encryptedPassword: `pass${i + 1}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            // Local has those 10 PLUS "spaceX" (localId: 11, cloudSynced=0)
            const localPasswords = [
                ...cloudPasswords.map(p => ({ ...p, id: p.localId })),
                {
                    id: 11,
                    siteName: 'spaceX.com',
                    username: 'user@spacex.com',
                    encryptedPassword: 'pass11',
                    lastModified: '2024-01-02T00:00:00.000Z',
                    cloudSynced: 0, // Not synced yet (limit was reached)
                },
            ];

            Database.getActivePasswords.mockReturnValue(localPasswords);
            Database.getDeletedPasswords.mockReturnValue([]);

            // First sync attempt: Limit reached, can't upload
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudPasswords,
            });

            // User deletes one entry (frees up space)
            // Now cloud has 9 passwords
            const cloudAfterDelete = cloudPasswords.slice(0, 9);

            // Second sync: Should upload "spaceX" once
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudAfterDelete,
            });

            FirestoreService.savePassword.mockResolvedValue({
                success: true,
                id: 'cloud_11',
            });

            Database.updateCloudSyncStatus.mockImplementation(() => { });
            SecureStore.setItemAsync.mockResolvedValue();

            const result = await HybridStorageService.syncBidirectional();

            // Should upload "spaceX" exactly once
            expect(FirestoreService.savePassword).toHaveBeenCalledTimes(1);
            expect(FirestoreService.savePassword).toHaveBeenCalledWith(
                'test_user_123',
                expect.objectContaining({
                    siteName: 'spaceX.com',
                    localId: 11,
                })
            );

            // Should mark as synced
            expect(Database.updateCloudSyncStatus).toHaveBeenCalledWith(11, 1);
        });

        test('should skip upload if password already exists in cloud with same localId', async () => {
            // Scenario: Password was already uploaded in previous sync
            // but cloudSynced status wasn't updated (race condition)

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            // Local has password with localId: 11
            const localPasswords = [
                {
                    id: 11,
                    siteName: 'duplicate.com',
                    username: 'user@duplicate.com',
                    encryptedPassword: 'pass11',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    cloudSynced: 0, // Incorrectly marked as not synced
                },
            ];

            // Cloud already has this password with localId: 11
            const cloudPasswords = [
                {
                    id: 'cloud_11',
                    localId: 11,
                    siteName: 'duplicate.com',
                    username: 'user@duplicate.com',
                    encryptedPassword: 'pass11',
                    lastModified: '2024-01-01T00:00:00.000Z',
                },
            ];

            Database.getActivePasswords.mockReturnValue(localPasswords);
            Database.getDeletedPasswords.mockReturnValue([]);

            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudPasswords,
            });

            Database.updateCloudSyncStatus.mockImplementation(() => { });
            SecureStore.setItemAsync.mockResolvedValue();

            const result = await HybridStorageService.syncBidirectional();

            // Should NOT upload (already exists in cloud)
            expect(FirestoreService.savePassword).not.toHaveBeenCalled();

            // Should update cloudSynced status to prevent future attempts
            expect(Database.updateCloudSyncStatus).toHaveBeenCalledWith(11, 1);

            expect(result.success).toBe(true);
        });

        test('should handle multiple passwords saved locally then synced after space freed', async () => {
            // Scenario: User adds 3 passwords while at limit, then deletes 3 old ones

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 10 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            // Cloud has 7 passwords (after deleting 3)
            const cloudPasswords = Array.from({ length: 7 }, (_, i) => ({
                id: `cloud_${i}`,
                localId: i + 1,
                siteName: `site${i + 1}.com`,
                username: `user${i + 1}`,
                encryptedPassword: `pass${i + 1}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            // Local has those 7 PLUS 3 new ones (localId: 11, 12, 13)
            const localPasswords = [
                ...cloudPasswords.map(p => ({ ...p, id: p.localId })),
                {
                    id: 11,
                    siteName: 'new1.com',
                    username: 'user11',
                    encryptedPassword: 'pass11',
                    lastModified: '2024-01-02T00:00:00.000Z',
                    cloudSynced: 0,
                },
                {
                    id: 12,
                    siteName: 'new2.com',
                    username: 'user12',
                    encryptedPassword: 'pass12',
                    lastModified: '2024-01-02T00:00:00.000Z',
                    cloudSynced: 0,
                },
                {
                    id: 13,
                    siteName: 'new3.com',
                    username: 'user13',
                    encryptedPassword: 'pass13',
                    lastModified: '2024-01-02T00:00:00.000Z',
                    cloudSynced: 0,
                },
            ];

            Database.getActivePasswords.mockReturnValue(localPasswords);
            Database.getDeletedPasswords.mockReturnValue([]);

            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudPasswords,
            });

            FirestoreService.savePassword.mockResolvedValue({
                success: true,
                id: 'cloud_new',
            });

            Database.updateCloudSyncStatus.mockImplementation(() => { });
            SecureStore.setItemAsync.mockResolvedValue();

            const result = await HybridStorageService.syncBidirectional();

            // Should upload all 3 new passwords exactly once each
            expect(FirestoreService.savePassword).toHaveBeenCalledTimes(3);
            expect(result.uploaded).toBe(3);
        });
    });
});
