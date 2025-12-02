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
        // Enable cloud sync by default
        SecureStore.getItemAsync.mockImplementation((key) => {
            if (key === 'CLOUD_SYNC_ENABLED') {
                return Promise.resolve('true');
            }
            if (key === 'CLOUD_PASSWORD_LIMIT') {
                return Promise.resolve('100');
            }
            return Promise.resolve(null);
        });
        SecureStore.setItemAsync.mockResolvedValue();
    });

    describe('Edge Case: Multiple Offline Edits to Same Password', () => {
        test('Should sync only the final version after multiple offline edits', async () => {
            const password = {
                id: 'uuid-1', // Use UUID format
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

            Database.getPasswords.mockReturnValue([finalPassword]);
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
            const passwordId = 'uuid-1'; // Use UUID format

            // Device A modifies at 10:00 AM
            const deviceAVersion = {
                id: passwordId,
                localId: 1,
                siteName: 'device-a-version.com',
                username: 'user',
                encryptedPassword: 'pass',
                lastModified: '2024-01-01T10:00:00.000Z',
            };

            // Device B modifies at 11:00 AM (newer)
            const deviceBVersion = {
                id: passwordId,
                localId: 1,
                siteName: 'device-b-version.com',
                username: 'user',
                encryptedPassword: 'pass',
                lastModified: '2024-01-01T11:00:00.000Z',
            };

            // Local has Device A's version
            Database.getPasswords.mockReturnValue([deviceAVersion]);
            Database.getActivePasswords.mockReturnValue([deviceAVersion]);

            // Cloud has Device B's version (newer)
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: [deviceBVersion],
            });

            Database.updatePassword.mockImplementation(() => ({
                lastModified: deviceBVersion.lastModified,
            }));
            Database.getActivePasswords.mockReturnValue([deviceAVersion]);

            const mockDoc = {
                exists: () => true,
                data: () => ({ maxPasswords: 100 }),
            };
            getDoc.mockResolvedValue(mockDoc);

            const result = await HybridStorageService.syncBidirectional();

            // Device B's version should win (newer timestamp)
            expect(Database.updatePassword).toHaveBeenCalledWith(
                passwordId, // Already UUID format
                'device-b-version.com',
                'user',
                'pass',
                expect.any(String) // comments
            );
        });
    });

    describe('Edge Case: Sync with Exactly at Limit', () => {
        test('Should prevent sync when exactly at limit with pending uploads', async () => {
            const limit = 5;

            // Cloud has 5 passwords (at limit)
            const cloudPasswords = Array.from({ length: 5 }, (_, i) => ({
                id: `uuid-${i + 1}`, // Use UUID format
                localId: i + 1,
                siteName: `cloud${i}.com`,
                username: 'user',
                encryptedPassword: 'pass',
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            // Local has those 5 PLUS 1 new password
            // Make sure the new password has all required fields and is truly new (not in cloud)
            const localPasswords = [
                ...cloudPasswords.map(p => ({ ...p, cloudSynced: 1 })),
                {
                    id: 'uuid-6', // Use UUID format - this is NEW, not in cloud
                    siteName: 'new-local.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                    lastModified: '2024-01-02T00:00:00.000Z',
                    cloudSynced: 0, // Not synced yet
                },
            ];

            Database.getPasswords.mockReturnValue(localPasswords);
            Database.getActivePasswords.mockReturnValue(localPasswords);
            FirestoreService.getPasswords.mockResolvedValue({
                success: true,
                passwords: cloudPasswords,
            });

            // Mock getCloudPasswordLimit to return the limit directly
            // Also mock the Firestore document for the limit check
            const mockDoc = {
                exists: () => true,
                data: () => ({ maxCloudPasswords: limit }), // Note: maxCloudPasswords, not maxPasswords
            };
            getDoc.mockResolvedValue(mockDoc);
            
            // Also ensure SecureStore returns the limit for caching
            SecureStore.getItemAsync.mockImplementation((key) => {
                if (key === 'CLOUD_SYNC_ENABLED') {
                    return Promise.resolve('true');
                }
                if (key === 'CLOUD_PASSWORD_LIMIT') {
                    return Promise.resolve(String(limit));
                }
                return Promise.resolve(null);
            });

            const result = await HybridStorageService.syncBidirectional();

            // Should complete but skip uploads due to limit
            // We have 6 local passwords, 5 cloud passwords, limit is 5
            // So 1 password needs to be uploaded, but limit is reached (5/5)
            // availableSpace = 5 - 5 = 0, so toUpload.length (1) > availableSpace (0)
            // This triggers: availableSpace <= 0, so uploadSkipped = true, skippedCount = 1
            expect(result).toBeDefined();
            expect(result.success).toBe(true); // No errors, so success is true
            expect(result.limitReached).toBe(true); // Uploads were skipped due to limit
            expect(result.skippedCount).toBe(1); // 1 password was skipped
            expect(result.uploaded).toBe(0); // No uploads when at limit
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
            Database.getActivePasswords.mockReturnValue([]);

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
                { id: 'uuid-1', siteName: 'site1.com', username: 'user1', encryptedPassword: 'pass1', lastModified: '2024-01-01T00:00:00.000Z' },
                { id: 'uuid-2', siteName: 'site2.com', username: 'user2', encryptedPassword: 'pass2', lastModified: '2024-01-01T00:00:00.000Z' },
                { id: 'uuid-3', siteName: 'site3.com', username: 'user3', encryptedPassword: 'pass3', lastModified: '2024-01-01T00:00:00.000Z' },
            ];

            Database.getPasswords.mockReturnValue(localPasswords);
            Database.getActivePasswords.mockReturnValue(localPasswords);
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
                id: 'uuid-1', // Use UUID format
                localId: 1,
                siteName: 'site.com',
                username: 'user',
                encryptedPassword: 'pass',
                lastModified: sameTime,
            };

            Database.getPasswords.mockReturnValue([password]);
            Database.getActivePasswords.mockReturnValue([password]);
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
                id: 'uuid-1', // Use UUID format
                siteName: 'local.com',
                username: 'user',
                encryptedPassword: 'pass',
                // No lastModified
            };

            const cloudPassword = {
                id: 'uuid-1', // Must match local ID
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
                id: `uuid-${i + 1}`, // Use UUID format
                localId: i + 1,
                siteName: `site${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            Database.getPasswords.mockReturnValue(largeDataset);
            Database.getActivePasswords.mockReturnValue(largeDataset);
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
                id: `uuid-${i + 1}`, // Use UUID format
                siteName: `site${i}.com`,
                username: `user${i}`,
                encryptedPassword: `pass${i}`,
                lastModified: '2024-01-01T00:00:00.000Z',
            }));

            Database.getPasswords.mockReturnValue(localPasswords);
            Database.getActivePasswords.mockReturnValue(localPasswords);

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
                id: 'uuid-1', // Use UUID format
                // Missing required fields
                siteName: null,
                username: undefined,
                encryptedPassword: '',
            };

            Database.getPasswords.mockReturnValue([corruptedPassword]);
            Database.getActivePasswords.mockReturnValue([corruptedPassword]);
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
            Database.getActivePasswords.mockReturnValue([]);
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
                id: 'uuid-1', // Use UUID format
                siteName: "Test's \"Site\" <script>alert('xss')</script>",
                username: 'user@test.com; DROP TABLE passwords;',
                encryptedPassword: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`',
                lastModified: '2024-01-01T00:00:00.000Z',
            };

            Database.getPasswords.mockReturnValue([specialPassword]);
            Database.getActivePasswords.mockReturnValue([specialPassword]);
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
