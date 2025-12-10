/**
 * Unit Tests for Encryption Service
 * Tests encryption, decryption, PIN, and master password operations
 */

import * as SecureStore from 'expo-secure-store';
import * as Encryption from '../Encryption';
import CryptoJS from 'crypto-js';

import { ENCRYPTION_CONFIG } from '../../config/EncryptionConfig';

describe('Encryption Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('PIN Management Tests', () => {
        describe('Positive Tests', () => {
            test('should setup PIN successfully', async () => {
                SecureStore.setItemAsync.mockResolvedValue();

                const result = await Encryption.setupPIN('1234');

                expect(result.success).toBe(true);
                expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                    'credvault_user_pin_hash',
                    expect.any(String)
                );
            });

            test('should verify correct PIN', async () => {
                const pinHash = CryptoJS.SHA256('1234').toString();
                SecureStore.getItemAsync.mockResolvedValue(pinHash);

                const result = await Encryption.verifyPIN('1234');

                expect(result).toBe(true);
            });

            test('should detect if PIN is set', async () => {
                SecureStore.getItemAsync.mockResolvedValue('some_hash');

                const result = await Encryption.isPINSet();

                expect(result).toBe(true);
            });

            test('should detect if PIN is not set', async () => {
                SecureStore.getItemAsync.mockResolvedValue(null);

                const result = await Encryption.isPINSet();

                expect(result).toBe(false);
            });
        });

        describe('Negative Tests', () => {
            test('should reject PIN with less than 4 digits', async () => {
                const result = await Encryption.setupPIN('123');

                expect(result.success).toBe(false);
                expect(result.error).toContain('4 digits');
            });

            test('should reject PIN with more than 4 digits', async () => {
                const result = await Encryption.setupPIN('12345');

                expect(result.success).toBe(false);
                expect(result.error).toContain('4 digits');
            });

            test('should reject PIN with non-numeric characters', async () => {
                const result = await Encryption.setupPIN('12ab');

                expect(result.success).toBe(false);
                expect(result.error).toContain('4 digits');
            });

            test('should reject empty PIN', async () => {
                const result = await Encryption.setupPIN('');

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should reject null PIN', async () => {
                const result = await Encryption.setupPIN(null);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should return false for incorrect PIN', async () => {
                const correctPinHash = CryptoJS.SHA256('1234').toString();
                SecureStore.getItemAsync.mockResolvedValue(correctPinHash);

                const result = await Encryption.verifyPIN('5678');

                expect(result).toBe(false);
            });

            test('should handle SecureStore errors during PIN setup', async () => {
                SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

                const result = await Encryption.setupPIN('1234');

                expect(result.success).toBe(false);
                expect(result.error).toBe('Storage error');
            });

            test('should handle SecureStore errors during PIN verification', async () => {
                SecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

                const result = await Encryption.verifyPIN('1234');

                expect(result).toBe(false);
            });
        });
    });

    describe('Master Password Management Tests', () => {
        describe('Positive Tests', () => {
            test('should setup master password successfully', async () => {
                SecureStore.setItemAsync.mockResolvedValue();

                const result = await Encryption.setupMasterPassword('MySecurePassword123');

                expect(result.success).toBe(true);
                expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(3);
                expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                    'credvault_master_password_hash',
                    expect.any(String)
                );
                expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                    'credvault_encryption_key',
                    expect.any(String)
                );
                expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                    'credvault_master_password_encrypted',
                    expect.any(String)
                );
            });

            test('should verify correct master password', async () => {
                const password = 'MySecurePassword123';
                const passwordHash = CryptoJS.SHA256(password).toString();
                SecureStore.getItemAsync.mockResolvedValue(passwordHash);

                const result = await Encryption.verifyMasterPassword(password);

                expect(result).toBe(true);
            });

            test('should detect if master password is set', async () => {
                SecureStore.getItemAsync.mockResolvedValue('some_hash');

                const result = await Encryption.isMasterPasswordSet();

                expect(result).toBe(true);
            });

            test('should retrieve master password', async () => {
                const password = 'MySecurePassword123';
                const encrypted = CryptoJS.AES.encrypt(password, ENCRYPTION_CONFIG.APP_SECRET).toString();
                SecureStore.getItemAsync.mockResolvedValue(encrypted);

                const result = await Encryption.getMasterPassword();

                expect(result.success).toBe(true);
                expect(result.masterPassword).toBeDefined();
            });
        });

        describe('Negative Tests', () => {
            test('should reject password shorter than 8 characters', async () => {
                const result = await Encryption.setupMasterPassword('short');

                expect(result.success).toBe(false);
                expect(result.error).toContain('8 characters');
            });

            test('should reject empty password', async () => {
                const result = await Encryption.setupMasterPassword('');

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should reject null password', async () => {
                const result = await Encryption.setupMasterPassword(null);

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });

            test('should return false for incorrect master password', async () => {
                const correctHash = CryptoJS.SHA256('CorrectPassword123').toString();
                SecureStore.getItemAsync.mockResolvedValue(correctHash);

                const result = await Encryption.verifyMasterPassword('WrongPassword123');

                expect(result).toBe(false);
            });

            test('should handle SecureStore errors during setup', async () => {
                SecureStore.setItemAsync.mockRejectedValue(new Error('Storage full'));

                const result = await Encryption.setupMasterPassword('ValidPassword123');

                expect(result.success).toBe(false);
                expect(result.error).toBe('Storage full');
            });

            test('should handle missing master password during retrieval', async () => {
                SecureStore.getItemAsync.mockResolvedValue(null);

                const result = await Encryption.getMasterPassword();

                expect(result.success).toBe(false);
                expect(result.error).toContain('not found');
            });

            test('should handle decryption errors', async () => {
                SecureStore.getItemAsync.mockResolvedValue('invalid_encrypted_data');

                const result = await Encryption.getMasterPassword();

                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
            });
        });
    });

    describe('Password Encryption/Decryption Tests', () => {
        describe('Positive Tests', () => {
            test('should encrypt password successfully', async () => {
                SecureStore.getItemAsync.mockResolvedValue('encryption_key_123');

                const encrypted = await Encryption.encryptPassword('myPassword123');

                expect(encrypted).toBeDefined();
                expect(encrypted).not.toBe('myPassword123');
                expect(encrypted.length).toBeGreaterThan(0);
            });

            test('should decrypt password successfully', async () => {
                const password = 'myPassword123';
                const key = 'encryption_key_123';
                const encrypted = CryptoJS.AES.encrypt(password, key).toString();

                SecureStore.getItemAsync.mockResolvedValue(key);

                const decrypted = await Encryption.decryptPassword(encrypted);

                expect(decrypted).toBe(password);
            });

            test('should handle encrypt-decrypt round trip', async () => {
                const originalPassword = 'TestPassword!@#123';
                const key = 'test_encryption_key';

                SecureStore.getItemAsync.mockResolvedValue(key);

                const encrypted = await Encryption.encryptPassword(originalPassword);
                const decrypted = await Encryption.decryptPassword(encrypted);

                expect(decrypted).toBe(originalPassword);
            });

            test('should encrypt different passwords to different ciphertexts', async () => {
                SecureStore.getItemAsync.mockResolvedValue('key123');

                const encrypted1 = await Encryption.encryptPassword('password1');
                const encrypted2 = await Encryption.encryptPassword('password2');

                expect(encrypted1).not.toBe(encrypted2);
            });

            test('should handle empty password encryption', async () => {
                const encrypted = await Encryption.encryptPassword('');

                expect(encrypted).toBe('');
            });

            test('should handle empty password decryption', async () => {
                const decrypted = await Encryption.decryptPassword('');

                expect(decrypted).toBe('');
            });
        });

        describe('Negative Tests', () => {
            test('should handle encryption errors gracefully', async () => {
                SecureStore.getItemAsync.mockRejectedValue(new Error('Key not found'));

                const encrypted = await Encryption.encryptPassword('password');

                expect(encrypted).not.toBe('');
                expect(encrypted.length).toBeGreaterThan(0);
            });

            test('should handle decryption of invalid data', async () => {
                SecureStore.getItemAsync.mockResolvedValue('key123');

                const decrypted = await Encryption.decryptPassword('invalid_encrypted_data');

                // Should fallback to original text for legacy support
                expect(decrypted).toBe('invalid_encrypted_data');
            });

            test('should handle decryption with wrong key', async () => {
                const password = 'secret';
                const correctKey = 'correct_key';
                const wrongKey = 'wrong_key';

                const encrypted = CryptoJS.AES.encrypt(password, correctKey).toString();
                SecureStore.getItemAsync.mockResolvedValue(wrongKey);

                const decrypted = await Encryption.decryptPassword(encrypted);

                // Should fallback to encrypted text when decryption fails
                expect(decrypted).toBe(encrypted);
            });

            test('should handle null password encryption', async () => {
                const encrypted = await Encryption.encryptPassword(null);

                expect(encrypted).toBe('');
            });

            test('should handle undefined password encryption', async () => {
                const encrypted = await Encryption.encryptPassword(undefined);

                expect(encrypted).toBe('');
            });

            test('should handle special characters in password', async () => {
                const specialPassword = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
                SecureStore.getItemAsync.mockResolvedValue('key123');

                const encrypted = await Encryption.encryptPassword(specialPassword);
                const decrypted = await Encryption.decryptPassword(encrypted);

                expect(decrypted).toBe(specialPassword);
            });

            test('should handle very long passwords', async () => {
                const longPassword = 'a'.repeat(1000);
                SecureStore.getItemAsync.mockResolvedValue('key123');

                const encrypted = await Encryption.encryptPassword(longPassword);
                const decrypted = await Encryption.decryptPassword(encrypted);

                expect(decrypted).toBe(longPassword);
            });

            test('should handle unicode characters in password', async () => {
                const unicodePassword = '密码🔐パスワード';
                SecureStore.getItemAsync.mockResolvedValue('key123');

                const encrypted = await Encryption.encryptPassword(unicodePassword);
                const decrypted = await Encryption.decryptPassword(encrypted);

                expect(decrypted).toBe(unicodePassword);
            });
        });
    });

    describe('Security Tests', () => {
        test('should use different hashes for different PINs', async () => {
            SecureStore.setItemAsync.mockResolvedValue();

            await Encryption.setupPIN('1234');
            const hash1 = SecureStore.setItemAsync.mock.calls[0][1];

            await Encryption.setupPIN('5678');
            const hash2 = SecureStore.setItemAsync.mock.calls[1][1];

            expect(hash1).not.toBe(hash2);
        });

        test('should use different hashes for different passwords', async () => {
            SecureStore.setItemAsync.mockResolvedValue();

            await Encryption.setupMasterPassword('Password123');
            const hash1 = SecureStore.setItemAsync.mock.calls[0][1];

            jest.clearAllMocks();
            SecureStore.setItemAsync.mockResolvedValue();

            await Encryption.setupMasterPassword('DifferentPass456');
            const hash2 = SecureStore.setItemAsync.mock.calls[0][1];

            expect(hash1).not.toBe(hash2);
        });

        test('should not store plain text PIN', async () => {
            SecureStore.setItemAsync.mockResolvedValue();

            await Encryption.setupPIN('1234');

            const storedValue = SecureStore.setItemAsync.mock.calls[0][1];
            expect(storedValue).not.toContain('1234');
        });

        test('should not store plain text master password', async () => {
            SecureStore.setItemAsync.mockResolvedValue();

            await Encryption.setupMasterPassword('MyPassword123');

            const calls = SecureStore.setItemAsync.mock.calls;
            calls.forEach(call => {
                expect(call[1]).not.toContain('MyPassword123');
            });
        });
    });
});
