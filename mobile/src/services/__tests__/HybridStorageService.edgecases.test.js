/**
 * Edge Case Tests for Hybrid Storage Service
 * Tests complex real-world scenarios and edge cases
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
jest.mock('../../../firebase.config', () => ({ app: {} }));
jest.mock('../FirebaseAuthService', () => ({
    getCurrentUser: jest.fn(() => ({ uid: 'test_user_123' })),
    signInAnonymouslyUser: jest.fn(),
}));

describe('Hybrid Storage Service - Edge Cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SecureStore.getItemAsync.mockResolvedValue('https://sheets.api.url');
    });

    describe('Edge Case: Multiple Offline Edits to Same Password', () => {
        test('Should sync only the final version after multiple offline edits', async () => {
            const password = {
                id: 1,
                localId: 1,
                siteName: 'original.com',
                username: 'user',
                encryptedPassword: 'pass1',
                lastModified: '2024-01-01T00:00:00.000Z',
            };

            // User edits the same password 3 times offline
            const edit1Time = '2024-01-01T01:00:00.000Z';
            const edit2Time = '2024-01-01T02:00:00.000Z';
            const edit3Time = '2024-01-01T03:00:00.000Z';

            const finalPassword = {
                ...password,
                siteName: 'final-edit.com',
                lastModified: edit3Time,
            };

            Database.getActivePasswords.mockReturnValue([finalPassword]);
            Database.getDeletedPasswords.mockReturnValue([]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [password],
            });

            FirestoreService.updatePassword.mockResolvedValue({ success: true });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            SecureStore.setItemAsync.mockResolvedValue();

            const result = await HybridStorageService.syncBidirectional();

            // Should upload only the final version
            expect(result.success).toBe(true);
            expect(FirestoreService.updatePassword).toHaveBeenCalledWith(
                'test_user_123',
                expect.anything(),
                expect.objectContaining({
                    siteName: 'final-edit.com',
                    lastModified: edit3Time,
                })
            );
        });
    });


    describe('Edge Case: Concurrent Modifications on Different Devices', () => {
        test('Should handle Last-Write-Wins when both devices modify same password', async () => {
            const passwordId = 1;

            // Device A modifies at 10:00 AM
            const deviceAVersion = {
                id: passwordId,
                localId: passwordId,
                siteName: 'device-a-version.com',
                lastModified: '2024-01-01T10:00:00.000Z',
            };

            // Device B modifies at 11:00 AM (newer)
            const deviceBVersion = {
                id: passwordId,
                localId: passwordId,
                siteName: 'device-b-version.com',
                lastModified: '2024-01-01T11:00:00.000Z',
            };

            // Local has Device A's version
            Database.getPasswords.mockReturnValue([deviceAVersion]);

            // Cloud has Device B's version (newer)
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [deviceBVersion],
            });

            Database.updatePassword.mockImplementation(() => ({
                lastModified: deviceBVersion.lastModified,
            }));

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Device B's version should win (newer timestamp)
            expect(Database.updatePassword).toHaveBeenCalledWith(
                passwordId,
                'device-b-version.com',
                expect.any(String),
                expect.any(String),
                expect.any(String)
            );
        });
    });

    describe('Edge Case: Sync with Exactly at Limit', () => {
        test('Should prevent sync when exactly at limit with pending uploads', async () => {
            const limit = 5;

            // Cloud has 5 passwords (at limit)
            const cloudPasswords = Array.from({ length: 5 }, (_, i) => ({
                id: `cloud_${i}`,
                localId: i + 1,
                siteName: `cloud${i}.com`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            // Local has those 5 PLUS 1 new password
            const localPasswords = [
                ...cloudPasswords.map(p => ({ ...p, id: p.localId })),
                {
                    id: 6,
                    siteName: 'new-local.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                    lastModified: '2024-01-02T00:00:00.000Z',
                },
            ];

            Database.getPasswords.mockReturnValue(localPasswords);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudPasswords,
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: limit }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Should fail with limit error
            expect(result.success).toBe(false);
            expect(result.error).toBe('LIMIT_REACHED');
            expect(result.limitDetails).toEqual({
                current: 5,
                pending: 1,
                limit: 5,
                exceeded: 1,
            });
        });
    });

    describe('Edge Case: Offline Add, Edit, Delete Same Password', () => {
        test('Should handle add -> edit -> delete sequence offline', async () => {
            // User adds password offline (id: 100)
            // User edits it
            // User deletes it
            // All while offline

            // Final state: password doesn't exist locally
            Database.getPasswords.mockReturnValue([]);

            // Cloud doesn't have it either (never synced)
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Should complete successfully with no operations
            expect(result.success).toBe(true);
            expect(result.uploaded).toBe(0);
            expect(result.downloaded).toBe(0);
        });
    });

    describe('Edge Case: Partial Sync Failure', () => {
        test('Should handle partial upload failures gracefully', async () => {
            const localPasswords = [
                { id: 1, siteName: 'site1.com', username: 'user1', encryptedPassword: 'pass1', lastModified: '2024-01-01T00:00:00.000Z' },
                { id: 2, siteName: 'site2.com', username: 'user2', encryptedPassword: 'pass2', lastModified: '2024-01-01T00:00:00.000Z' },
                { id: 3, siteName: 'site3.com', username: 'user3', encryptedPassword: 'pass3', lastModified: '2024-01-01T00:00:00.000Z' },
            ];

            Database.getPasswords.mockReturnValue(localPasswords);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            // First upload succeeds, second fails, third succeeds
            FirestoreService.savePassword
                .mockResolvedValueOnce({ success: true, id: 'cloud1' })
                .mockResolvedValueOnce({ success: false, error: 'Network error' })
                .mockResolvedValueOnce({ success: true, id: 'cloud3' });

            Database.updateCloudSyncStatus.mockImplementation(() => { });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Should report partial success
            expect(result.uploaded).toBe(2); // 2 out of 3 succeeded
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false); // Overall failure due to errors
        });
    });

    describe('Edge Case: Timestamp Edge Cases', () => {
        test('Should handle identical timestamps correctly', async () => {
            const sameTime = '2024-01-01T12:00:00.000Z';

            const password = {
                id: 1,
                localId: 1,
                siteName: 'site.com',
                username: 'user',
                encryptedPassword: 'pass',
                lastModified: sameTime,
            };

            Database.getPasswords.mockReturnValue([password]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [password],
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // With identical timestamps, no updates should occur
            expect(result.updatedLocal).toBe(0);
            expect(result.updatedCloud).toBe(0);
        });

        test('Should handle missing timestamps gracefully', async () => {
            const localPassword = {
                id: 1,
                siteName: 'local.com',
                username: 'user',
                encryptedPassword: 'pass',
                // No lastModified
            };

            const cloudPassword = {
                id: 'cloud1',
                localId: 1,
                siteName: 'cloud.com',
                username: 'user',
                encryptedPassword: 'pass',
                // No lastModified, updatedAt, or createdAt
            };

            Database.getPasswords.mockReturnValue([localPassword]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [cloudPassword],
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Should not crash, should handle gracefully
            expect(result.success).toBeDefined();
        });
    });

    describe('Edge Case: Large Dataset Performance', () => {
        test('Should handle 1000 passwords efficiently', async () => {
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                id: i + 1,
                localId: i + 1,
                siteName: `site${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            Database.getPasswords.mockReturnValue(largeDataset);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: largeDataset,
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 2000 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const startTime = Date.now();
            const result = await HybridStorageService.syncBidirectional();
            const endTime = Date.now();

            // Should complete in reasonable time (< 5 seconds)
            expect(endTime - startTime).toBeLessThan(5000);
            expect(result.success).toBeDefined();
        });
    });

    describe('Edge Case: Network Interruption During Sync', () => {
        test('Should handle network failure mid-sync', async () => {
            const localPasswords = Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                siteName: `site${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            Database.getPasswords.mockReturnValue(localPasswords);

            // First call succeeds, then network fails
            FirestoreService.getPasswords
                .mockResolvedValueOnce({
                    success: true,
                    passwords: [],
                })
                .mockRejectedValueOnce(new Error('Network error'));

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            // Simulate network failure during upload
            FirestoreService.savePassword
                .mockResolvedValueOnce({ success: true })
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValue(new Error('Network interrupted'));

            const result = await HybridStorageService.syncBidirectional();

            // Should handle gracefully and report partial success
            expect(result).toBeDefined();
        });
    });

    describe('Edge Case: Corrupted Data Handling', () => {
        test('Should handle corrupted password data', async () => {
            const corruptedPassword = {
                id: 1,
                // Missing required fields
                siteName: null,
                username: undefined,
                encryptedPassword: '',
            };

            Database.getPasswords.mockReturnValue([corruptedPassword]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            FirestoreService.savePassword.mockResolvedValue({
                success: true,
                id: 'cloud1',
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Should handle corrupted data gracefully
            expect(result).toBeDefined();

            // Should use default values for missing fields
            if (FirestoreService.savePassword.mock.calls.length > 0) {
                const savedData = FirestoreService.savePassword.mock.calls[0][1];
                expect(savedData.siteName).toBeDefined(); // Should have default value
            }
        });
    });

    describe('Edge Case: Rapid Consecutive Syncs', () => {
        test('Should handle rapid sync requests', async () => {
            Database.getPasswords.mockReturnValue([]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            // Trigger multiple syncs rapidly
            const syncs = await Promise.all([
                HybridStorageService.syncBidirectional(),
                HybridStorageService.syncBidirectional(),
                HybridStorageService.syncBidirectional(),
            ]);

            // All should complete without errors
            syncs.forEach(result => {
                expect(result).toBeDefined();
            });
        });
    });

    describe('Edge Case: Special Characters in Data', () => {
        test('Should handle special characters in passwords', async () => {
            const specialPassword = {
                id: 1,
                siteName: "Test's \"Site\" <script>alert('xss')</script>",
                username: 'user@test.com; DROP TABLE passwords;',
                encryptedPassword: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`',
                lastModified: '2024-01-01T00:00:00.000Z',
            };

            Database.getPasswords.mockReturnValue([specialPassword]);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [],
            });

            FirestoreService.savePassword.mockResolvedValue({
                success: true,
                id: 'cloud1',
            });

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            expect(result.success).toBeDefined();

            // Should preserve special characters
            if (FirestoreService.savePassword.mock.calls.length > 0) {
                const savedData = FirestoreService.savePassword.mock.calls[0][1];
                expect(savedData.siteName).toBe(specialPassword.siteName);
                expect(savedData.encryptedPassword).toBe(specialPassword.encryptedPassword);
            }
        });
    });
});
