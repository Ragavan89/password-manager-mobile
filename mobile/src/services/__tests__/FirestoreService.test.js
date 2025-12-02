/**
 * Unit Tests for Firestore Service
 * Tests cloud storage operations and sync functionality
 */

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
} from 'firebase/firestore';
import * as FirestoreService from '../FirestoreService';

jest.mock('firebase/firestore');
jest.mock('../../../firebase.config', () => ({
    app: {},
}));

describe('Firestore Service - Cloud Storage Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Scenario 4: Cloud Storage and Sync Tests', () => {
        describe('Positive Tests', () => {
            test('should save password to Firestore successfully', async () => {
                const mockDocRef = { id: 'firestore_id_123' };
                doc.mockReturnValue(mockDocRef);
                setDoc.mockResolvedValue();

                const passwordData = {
                    localId: 1,
                    siteName: 'example.com',
                    username: 'user@example.com',
                    encryptedPassword: 'encrypted_pass',
                    comments: 'Test comment',
                };

                const result = await FirestoreService.savePassword('user123', passwordData);

                expect(result.success).toBe(true);
                expect(result.id).toBe('firestore_id_123');
                expect(setDoc).toHaveBeenCalledTimes(2); // User doc + password doc
            });

            test('should retrieve all passwords from Firestore', async () => {
                const mockPasswords = [
                    {
                        id: 'doc1',
                        siteName: 'site1.com',
                        username: 'user1',
                        encryptedPassword: 'pass1',
                    },
                    {
                        id: 'doc2',
                        siteName: 'site2.com',
                        username: 'user2',
                        encryptedPassword: 'pass2',
                    },
                ];

                const mockQuerySnapshot = {
                    size: 2,
                    forEach: (callback) => {
                        mockPasswords.forEach((pwd) => {
                            callback({ id: pwd.id, data: () => pwd });
                        });
                    },
                };

                getDocs.mockResolvedValue(mockQuerySnapshot);

                const result = await FirestoreService.getPasswords('user123');

                expect(result.success).toBe(true);
                expect(result.passwords).toHaveLength(2);
                expect(result.passwords[0].siteName).toBe('site1.com');
            });

            test('should update password in Firestore', async () => {
                updateDoc.mockResolvedValue();

                const passwordData = {
                    siteName: 'updated-site.com',
                    username: 'updated@user.com',
                    encryptedPassword: 'new_pass',
                };

                const result = await FirestoreService.updatePassword(
                    'user123',
                    'password_id_456',
                    passwordData
                );

                expect(result.success).toBe(true);
                expect(updateDoc).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({
                        siteName: 'updated-site.com',
                        updatedAt: expect.any(String),
                    })
                );
            });

            test('should delete password from Firestore', async () => {
                deleteDoc.mockResolvedValue();

                const result = await FirestoreService.deletePassword('user123', 'password_id_789');

                expect(result.success).toBe(true);
                expect(deleteDoc).toHaveBeenCalled();
            });

            test('should link local ID to cloud password', async () => {
                updateDoc.mockResolvedValue();

                const result = await FirestoreService.linkLocalId(
                    'user123',
                    'cloud_id_456',
                    'local_id_123'
                );

                expect(result.success).toBe(true);
                expect(updateDoc).toHaveBeenCalledWith(
                    expect.anything(),
                    { localId: 'local_id_123' }
                );
            });

            test('should save master password hash to Firestore', async () => {
                setDoc.mockResolvedValue();

                const result = await FirestoreService.saveMasterPasswordHash(
                    'user123',
                    'encrypted_hash_abc'
                );

                expect(result.success).toBe(true);
                expect(setDoc).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({
                        encryptedMasterPassword: 'encrypted_hash_abc',
                    }),
                    { merge: true }
                );
            });

            test('should retrieve master password hash from Firestore', async () => {
                const mockDoc = {
                    exists: () => true,
                    data: () => ({ encryptedMasterPassword: 'hash_xyz' }),
                };
                getDoc.mockResolvedValue(mockDoc);

                const result = await FirestoreService.getMasterPasswordHash('user123');

                expect(result.success).toBe(true);
                expect(result.encryptedHash).toBe('hash_xyz');
            });

            test('should return null when master password hash does not exist', async () => {
                const mockDoc = {
                    exists: () => false,
                };
                getDoc.mockResolvedValue(mockDoc);

                const result = await FirestoreService.getMasterPasswordHash('user123');

                expect(result.success).toBe(true);
                expect(result.encryptedHash).toBeNull();
            });
        });

        describe('Negative Tests', () => {
            test('should handle Firestore save errors', async () => {
                setDoc.mockRejectedValue(new Error('Permission denied'));

                const passwordData = {
                    localId: 1,
                    siteName: 'example.com',
                    username: 'user',
                    encryptedPassword: 'pass',
                };

                const result = await FirestoreService.savePassword('user123', passwordData);

                expect(result.success).toBe(false);
                expect(result.error).toContain('Permission denied');
            });

            test('should handle Firestore read errors', async () => {
                getDocs.mockRejectedValue(new Error('Network error'));

                const result = await FirestoreService.getPasswords('user123');

                expect(result.success).toBe(false);
                expect(result.error).toContain('Network error');
                expect(result.passwords).toEqual([]);
            });

            test('should handle Firestore update errors', async () => {
                updateDoc.mockRejectedValue(new Error('Document not found'));

                const result = await FirestoreService.updatePassword(
                    'user123',
                    'invalid_id',
                    { siteName: 'test' }
                );

                expect(result.success).toBe(false);
                expect(result.error).toContain('Document not found');
            });

            test('should handle Firestore delete errors', async () => {
                deleteDoc.mockRejectedValue(new Error('Insufficient permissions'));

                const result = await FirestoreService.deletePassword('user123', 'password_id');

                expect(result.success).toBe(false);
                expect(result.error).toContain('Insufficient permissions');
            });

            test('should handle missing user ID', async () => {
                const result = await FirestoreService.updatePassword(
                    null,
                    'password_id',
                    { siteName: 'test' }
                );

                expect(result.success).toBe(false);
                expect(result.error).toContain('Missing user ID');
            });

            test('should handle missing password ID', async () => {
                const result = await FirestoreService.updatePassword(
                    'user123',
                    null,
                    { siteName: 'test' }
                );

                expect(result.success).toBe(false);
                expect(result.error).toContain('Missing');
            });

            test('should handle network timeout', async () => {
                getDocs.mockRejectedValue(new Error('Request timeout'));

                const result = await FirestoreService.getPasswords('user123');

                expect(result.success).toBe(false);
                expect(result.error).toContain('timeout');
            });

            test('should handle authentication errors', async () => {
                setDoc.mockRejectedValue(new Error('User not authenticated'));

                const result = await FirestoreService.savePassword('user123', {
                    localId: 1,
                    siteName: 'test',
                });

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should handle quota exceeded errors', async () => {
                setDoc.mockRejectedValue(new Error('Quota exceeded'));

                const result = await FirestoreService.savePassword('user123', {
                    localId: 1,
                    siteName: 'test',
                });

                expect(result.success).toBe(false);
                expect(result.error).toContain('Quota exceeded');
            });
        });
    });

    describe('Real-time Subscription Tests', () => {
        describe('Positive Tests', () => {
            test('should subscribe to password updates', () => {
                const mockUnsubscribe = jest.fn();
                const onSnapshot = require('firebase/firestore').onSnapshot;
                onSnapshot.mockReturnValue(mockUnsubscribe);

                const callback = jest.fn();
                const unsubscribe = FirestoreService.subscribeToPasswords('user123', callback);

                expect(onSnapshot).toHaveBeenCalled();
                expect(unsubscribe).toBe(mockUnsubscribe);
            });

            test('should call callback with password updates', () => {
                const onSnapshot = require('firebase/firestore').onSnapshot;
                const callback = jest.fn();

                const mockQuerySnapshot = {
                    forEach: (cb) => {
                        cb({ id: 'doc1', data: () => ({ siteName: 'test.com' }) });
                    },
                };

                onSnapshot.mockImplementation((q, successCallback) => {
                    successCallback(mockQuerySnapshot);
                    return jest.fn();
                });

                FirestoreService.subscribeToPasswords('user123', callback);

                expect(callback).toHaveBeenCalledWith([
                    { id: 'doc1', siteName: 'test.com' },
                ]);
            });
        });

        describe('Negative Tests', () => {
            test('should handle subscription errors', () => {
                const onSnapshot = require('firebase/firestore').onSnapshot;
                const callback = jest.fn();

                onSnapshot.mockImplementation((q, successCallback, errorCallback) => {
                    errorCallback(new Error('Subscription failed'));
                    return jest.fn();
                });

                FirestoreService.subscribeToPasswords('user123', callback);

                expect(callback).toHaveBeenCalledWith([]);
            });
        });
    });

    describe('Data Validation Tests', () => {
        test('should include timestamps when saving', async () => {
            setDoc.mockResolvedValue();
            doc.mockReturnValue({ id: 'test_id' });

            const beforeSave = new Date().toISOString();
            await FirestoreService.savePassword('user123', { localId: 1, siteName: 'test' });

            const savedData = setDoc.mock.calls[1][1];
            expect(savedData.createdAt).toBeDefined();
            expect(savedData.updatedAt).toBeDefined();
            expect(new Date(savedData.createdAt).getTime()).toBeGreaterThanOrEqual(
                new Date(beforeSave).getTime()
            );
        });

        test('should include updatedAt when updating', async () => {
            updateDoc.mockResolvedValue();

            const beforeUpdate = new Date().toISOString();
            await FirestoreService.updatePassword('user123', 'pwd_id', { siteName: 'test' });

            const updatedData = updateDoc.mock.calls[0][1];
            expect(updatedData.updatedAt).toBeDefined();
            expect(new Date(updatedData.updatedAt).getTime()).toBeGreaterThanOrEqual(
                new Date(beforeUpdate).getTime()
            );
        });
    });
});
