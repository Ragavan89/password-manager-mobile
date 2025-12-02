/**
 * Unit Tests for Database Service
 * Tests local storage operations (SQLite and Web localStorage)
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Define mock functions outside the mock factory to be used? No, jest.mock hoisting prevents this.
// We will access the mock instance via SQLite.openDatabaseSync.mock.results[0].value

jest.mock('expo-sqlite', () => ({
    openDatabaseSync: jest.fn(() => ({
        execSync: jest.fn(),
        runSync: jest.fn(),
        getAllSync: jest.fn(),
    })),
}));

import * as Database from '../Database';

describe('Database Service - Local Storage Tests', () => {
    let mockDb;

    beforeAll(() => {
        // Capture the db instance created by Database.js
        // Database.js calls openDatabaseSync once at import time
        if (SQLite.openDatabaseSync.mock.results.length > 0) {
            mockDb = SQLite.openDatabaseSync.mock.results[0].value;
        } else {
            // Fallback if not called (e.g. if Platform was web during import, which shouldn't happen here)
            mockDb = {
                execSync: jest.fn(),
                runSync: jest.fn(),
                getAllSync: jest.fn(),
            };
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock behaviors
        if (mockDb) {
            mockDb.runSync.mockReturnValue({
                lastInsertRowId: 1,
                changes: 1,
            });
            mockDb.getAllSync.mockReturnValue([]);
            mockDb.execSync.mockReturnValue(undefined);
        }
    });

    describe('Scenario 1: New Entry Tests', () => {
        describe('Positive Tests', () => {
            test('should add a new password successfully', () => {
                const result = Database.addPassword(
                    'example.com',
                    'user@example.com',
                    'encrypted_password_123',
                    'Test comment'
                );

                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('lastModified');
                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO passwords'),
                    'example.com',
                    'user@example.com',
                    'encrypted_password_123',
                    expect.any(String),
                    'Test comment',
                    1
                );
            });

            test('should add password without comments', () => {
                const result = Database.addPassword(
                    'test.com',
                    'test@test.com',
                    'encrypted_pass'
                );

                expect(result).toHaveProperty('id');
                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO passwords'),
                    'test.com',
                    'test@test.com',
                    'encrypted_pass',
                    expect.any(String),
                    '',
                    1
                );
            });

            test('should generate unique IDs for multiple entries', () => {
                mockDb.runSync
                    .mockReturnValueOnce({ lastInsertRowId: 1, changes: 1 })
                    .mockReturnValueOnce({ lastInsertRowId: 2, changes: 1 })
                    .mockReturnValueOnce({ lastInsertRowId: 3, changes: 1 });

                const result1 = Database.addPassword('site1.com', 'user1', 'pass1');
                const result2 = Database.addPassword('site2.com', 'user2', 'pass2');
                const result3 = Database.addPassword('site3.com', 'user3', 'pass3');

                expect(result1.id).toBe(1);
                expect(result2.id).toBe(2);
                expect(result3.id).toBe(3);
            });
        });

        describe('Negative Tests', () => {
            test('should handle database errors gracefully', () => {
                mockDb.runSync.mockImplementation(() => {
                    throw new Error('Database error');
                });

                expect(() => {
                    Database.addPassword('test.com', 'user', 'pass');
                }).toThrow('Database error');
            });

            test('should handle empty site name', () => {
                const result = Database.addPassword('', 'user@test.com', 'pass');

                expect(result).toHaveProperty('id');
                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO passwords'),
                    '',
                    'user@test.com',
                    'pass',
                    expect.any(String),
                    '',
                    1
                );
            });

            test('should handle special characters in data', () => {
                const specialSite = "test's \"site\" <script>";
                const specialUser = 'user@test.com; DROP TABLE passwords;';

                const result = Database.addPassword(specialSite, specialUser, 'pass');

                expect(result).toHaveProperty('id');
                expect(mockDb.runSync).toHaveBeenCalled();
            });
        });
    });

    describe('Scenario 2: Edit Data and Save Tests', () => {
        describe('Positive Tests', () => {
            test('should update existing password successfully', () => {
                const result = Database.updatePassword(
                    1,
                    'updated-site.com',
                    'updated@user.com',
                    'new_encrypted_pass',
                    'Updated comment'
                );

                expect(result).toHaveProperty('lastModified');
                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.stringContaining('UPDATE passwords'),
                    'updated-site.com',
                    'updated@user.com',
                    'new_encrypted_pass',
                    expect.any(String),
                    'Updated comment',
                    1
                );
            });

            test('should update password and return new timestamp', () => {
                const beforeUpdate = new Date().toISOString();

                const result = Database.updatePassword(
                    5,
                    'site.com',
                    'user@site.com',
                    'encrypted'
                );

                expect(result.lastModified).toBeDefined();
                expect(new Date(result.lastModified).getTime()).toBeGreaterThanOrEqual(
                    new Date(beforeUpdate).getTime()
                );
            });

            test('should handle upsert operation - update existing', () => {
                mockDb.runSync.mockReturnValue({ changes: 1 });

                Database.upsertPassword(
                    10,
                    'site.com',
                    'user',
                    'pass',
                    new Date().toISOString(),
                    'comment'
                );

                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.stringContaining('UPDATE passwords'),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    10
                );
            });

            test('should handle upsert operation - insert new', () => {
                // First call (UPDATE) returns 0 changes
                // Second call (INSERT) returns success
                mockDb.runSync
                    .mockReturnValueOnce({ changes: 0 })
                    .mockReturnValueOnce({ lastInsertRowId: 20, changes: 1 });

                Database.upsertPassword(
                    20,
                    'newsite.com',
                    'newuser',
                    'newpass',
                    new Date().toISOString(),
                    'new comment'
                );

                expect(mockDb.runSync).toHaveBeenCalledTimes(2);
                expect(mockDb.runSync).toHaveBeenLastCalledWith(
                    expect.stringContaining('INSERT INTO passwords'),
                    20,
                    'newsite.com',
                    'newuser',
                    'newpass',
                    expect.any(String),
                    'new comment'
                );
            });
        });

        describe('Negative Tests', () => {
            test('should handle update of non-existent password', () => {
                mockDb.runSync.mockReturnValue({ changes: 0 });

                const result = Database.updatePassword(
                    999,
                    'site.com',
                    'user',
                    'pass'
                );

                expect(result).toHaveProperty('lastModified');
                expect(mockDb.runSync).toHaveBeenCalled();
            });

            test('should handle database errors during update', () => {
                mockDb.runSync.mockImplementation(() => {
                    throw new Error('Update failed');
                });

                expect(() => {
                    Database.updatePassword(1, 'site', 'user', 'pass');
                }).toThrow('Update failed');
            });

            test('should handle invalid ID types', () => {
                const result = Database.updatePassword(
                    'invalid_id',
                    'site.com',
                    'user',
                    'pass'
                );

                expect(result).toHaveProperty('lastModified');
                expect(mockDb.runSync).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                    'invalid_id'
                );
            });
        });
    });

    describe('Scenario 3: Local Storage Tests', () => {
        describe('Positive Tests', () => {
            test('should retrieve all passwords from database', () => {
                const mockPasswords = [
                    {
                        id: 1,
                        siteName: 'site1.com',
                        username: 'user1',
                        encryptedPassword: 'pass1',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        comments: 'Comment 1',
                    },
                    {
                        id: 2,
                        siteName: 'site2.com',
                        username: 'user2',
                        encryptedPassword: 'pass2',
                        lastModified: '2024-01-02T00:00:00.000Z',
                        comments: 'Comment 2',
                    },
                ];

                mockDb.getAllSync.mockReturnValue(mockPasswords);

                const result = Database.getPasswords();

                expect(result).toEqual(mockPasswords);
                expect(mockDb.getAllSync).toHaveBeenCalledWith('SELECT * FROM passwords WHERE isDeleted = 0 OR isDeleted IS NULL');
            });

            test('should return empty array when no passwords exist', () => {
                mockDb.getAllSync.mockReturnValue([]);

                const result = Database.getPasswords();

                expect(result).toEqual([]);
                expect(result).toHaveLength(0);
            });

            test('should initialize database with correct schema', () => {
                Database.initDatabase();

                expect(mockDb.execSync).toHaveBeenCalledWith(
                    expect.stringContaining('CREATE TABLE IF NOT EXISTS passwords')
                );
            });

            test('should update cloud sync status', () => {
                Database.updateCloudSyncStatus(1, 1);

                expect(mockDb.runSync).toHaveBeenCalledWith(
                    'UPDATE passwords SET cloudSynced = ? WHERE id = ?',
                    1,
                    1
                );
            });
        });

        describe('Negative Tests', () => {
            test('should handle database read errors', () => {
                mockDb.getAllSync.mockImplementation(() => {
                    throw new Error('Read error');
                });

                expect(() => {
                    Database.getPasswords();
                }).toThrow('Read error');
            });

            test('should handle initialization errors gracefully', () => {
                mockDb.execSync.mockImplementation(() => {
                    throw new Error('Already exists');
                });

                // Should not throw - errors are caught
                expect(() => {
                    Database.initDatabase();
                }).not.toThrow();
            });

            test('should handle corrupted data', () => {
                mockDb.getAllSync.mockReturnValue([
                    { id: 1, siteName: null, username: undefined },
                ]);

                const result = Database.getPasswords();

                expect(result).toHaveLength(1);
                expect(result[0].siteName).toBeNull();
            });
        });
    });

    describe('Delete Operations', () => {
        describe('Positive Tests', () => {
            test('should delete password by ID', () => {
                Database.deletePassword(5);

                expect(mockDb.runSync).toHaveBeenCalledWith(
                    'DELETE FROM passwords WHERE id = ?',
                    5
                );
            });

            test('should clear all passwords', () => {
                Database.clearAllPasswords();

                expect(mockDb.runSync).toHaveBeenCalledWith('DELETE FROM passwords');
            });
        });

        describe('Negative Tests', () => {
            test('should handle delete of non-existent password', () => {
                mockDb.runSync.mockReturnValue({ changes: 0 });

                Database.deletePassword(999);

                expect(mockDb.runSync).toHaveBeenCalledWith(
                    'DELETE FROM passwords WHERE id = ?',
                    999
                );
            });

            test('should handle delete errors', () => {
                mockDb.runSync.mockImplementation(() => {
                    throw new Error('Delete failed');
                });

                expect(() => {
                    Database.deletePassword(1);
                }).toThrow('Delete failed');
            });
        });
    });

    describe('Web Platform Tests', () => {
        beforeEach(() => {
            // Mock Platform.OS to be 'web'
            // NOTE: Changing Platform.OS at runtime might not work if it's a constant in the module.
            // But jest-expo/react-native mock usually allows it.
            // However, Database.js checks Platform.OS at IMPORT time for db initialization.
            // For methods, it checks Platform.OS at RUNTIME.
            Platform.OS = 'web';

            // Mock localStorage
            global.localStorage = {
                getItem: jest.fn(() => '[]'),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            };
        });

        afterEach(() => {
            Platform.OS = 'ios'; // Reset
        });

        test('should add password to localStorage on web', () => {
            const result = Database.addPassword('site.com', 'user', 'pass', 'comment');

            expect(result).toHaveProperty('id');
            expect(global.localStorage.setItem).toHaveBeenCalled();
        });

        test('should retrieve passwords from localStorage on web', () => {
            const mockData = JSON.stringify([
                { id: 1, siteName: 'site.com', username: 'user', encryptedPassword: 'pass' },
            ]);
            global.localStorage.getItem.mockReturnValue(mockData);

            const result = Database.getPasswords();

            expect(result).toHaveLength(1);
            expect(result[0].siteName).toBe('site.com');
        });
    });
});
