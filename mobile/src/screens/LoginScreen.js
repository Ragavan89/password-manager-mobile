/**
 * LoginScreen.js
 * 
 * PIN-based login screen for app authentication.
 * 
 * Features:
 * - 4-digit PIN entry with visual feedback
 * - Biometric authentication support
 * - Forgot PIN flow (device authentication + reset)
 * - Terms of Service and Privacy Policy links
 * 
 * Navigation: Login → Home (if master password set) or SetupMasterPassword
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView, ActivityIndicator, Animated, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import CustomAlert from '../components/CustomAlert';
import GradientButton from '../components/GradientButton';
import { isMasterPasswordSet, isPINSet, verifyPIN, setupPIN, verifyPanicPIN, setPanicMode, checkLockoutStatus, recordFailedAttempt, resetFailedAttempts } from '../services/Encryption';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { Colors, Gradients, Shadows } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }) {
    // Responsive dimensions hook
    const { scale, responsiveFontSize, isTablet } = useResponsiveDimensions();
    const [pin, setPin] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [isResettingPin, setIsResettingPin] = useState(false);
    const pinInputRef = useRef(null);

    // Custom alert state
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: []
    });

    // Check if PIN is set on mount
    useEffect(() => {
        checkPINStatus();
        checkBiometricAvailability();
    }, []);

    const checkPINStatus = async () => {
        const pinSet = await isPINSet();
        if (!pinSet) {
            // No PIN set, navigate to PIN setup
            navigation.replace('SetupPIN');
        }
    };

    const checkBiometricAvailability = async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);
    };

    const handleLogin = async () => {
        // 1. Check for existing lockout (Security)
        const { isLocked, remainingSeconds } = await checkLockoutStatus();
        if (isLocked) {
            const minutes = Math.ceil(remainingSeconds / 60);
            setAlertConfig({
                visible: true,
                title: 'App Locked',
                message: `Too many failed attempts. Please try again in ${minutes} minute(s).`,
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        // Verify PIN
        const isValid = await verifyPIN(pin);
        const isPanic = await verifyPanicPIN(pin);

        if (isValid || isPanic) {

            // ✅ Success: Reset limits
            await resetFailedAttempts();

            // Set Panic Mode state for the session
            if (isPanic) {
                setPanicMode(true);
            } else {
                setPanicMode(false);
            }

            try {
                // Save last login timestamp
                // First, get the current "last login" which is about to become the "previous login"
                const currentLastLogin = await SecureStore.getItemAsync('LAST_LOGIN_TIMESTAMP');
                if (currentLastLogin) {
                    await SecureStore.setItemAsync('PREVIOUS_LOGIN_TIMESTAMP', currentLastLogin);
                }

                // Now update last login to now
                await SecureStore.setItemAsync('LAST_LOGIN_TIMESTAMP', new Date().toISOString());
            } catch (error) {
                console.error('Error saving last login time:', error);
            }

            try {
                const hasMasterPassword = await isMasterPasswordSet();
                if (hasMasterPassword) {
                    navigation.replace('Home');
                } else {
                    navigation.replace('SetupMasterPassword');
                }
            } catch (error) {
                console.error('Login error:', error);
                // Fallback to home if check fails (shouldn't happen)
                navigation.replace('Home');
            }
        } else {
            // Ssecurity: Record failure
            const { locked, minutes } = await recordFailedAttempt();

            if (locked) {
                setAlertConfig({
                    visible: true,
                    title: 'App Locked',
                    message: `Too many failed attempts. Application locked for ${minutes} minutes.`,
                    type: 'error',
                    buttons: [{ text: 'OK', style: 'default' }]
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Invalid PIN',
                    message: 'The PIN you entered is incorrect. Please try again.',
                    type: 'error',
                    buttons: [{ text: 'Try Again', style: 'default' }]
                });
            }
            setPin('');
        }
    };

    const handleForgotPin = async () => {
        // Show explanation modal first
        Alert.alert(
            '🔐 Reset PIN',
            'To reset your PIN, we need to verify your identity using your device\'s security (fingerprint, face, pattern, or device PIN).\n\nThis ensures only you can reset the PIN.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Verify & Reset',
                    onPress: () => authenticateWithDevice()
                }
            ]
        );
    };

    const authenticateWithDevice = async () => {
        try {
            // Check if device has any authentication method
            const hasHardware = await LocalAuthentication.hasHardwareAsync();

            if (!hasHardware) {
                Alert.alert(
                    'Not Available',
                    'Your device doesn\'t support biometric authentication. Please contact support or reinstall the app to reset.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // Authenticate with device
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify your identity to reset PIN',
                fallbackLabel: 'Use device password',
                disableDeviceFallback: false,
            });

            if (result.success) {
                // Authentication successful - show reset PIN modal
                setShowResetModal(true);
                setNewPin('');
                setConfirmPin('');
            } else {
                Alert.alert(
                    'Verification Failed',
                    'Could not verify your identity. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Authentication error:', error);
            Alert.alert(
                'Error',
                'An error occurred during verification. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleSaveNewPin = async () => {
        // Validate new PIN
        if (!newPin || newPin.length !== 4) {
            Alert.alert('Error', 'PIN must be exactly 4 digits');
            return;
        }

        if (newPin !== confirmPin) {
            Alert.alert('Error', 'PINs do not match. Please try again.');
            setConfirmPin('');
            return;
        }

        setIsResettingPin(true);
        try {
            // Save the new PIN securely
            const result = await setupPIN(newPin);

            if (result.success) {
                // Reset failed attempts counter so user starts fresh
                await resetFailedAttempts();

                Alert.alert(
                    'Success! ✅',
                    'Your PIN has been reset successfully. You can now use your new PIN to unlock the vault.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setShowResetModal(false);
                                setNewPin('');
                                setConfirmPin('');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert(
                    'Error',
                    result.error || 'Failed to reset PIN. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error resetting PIN:', error);
            Alert.alert(
                'Error',
                'An unexpected error occurred while resetting your PIN. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsResettingPin(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    {/* Simple Icon Circle */}
                    <View style={styles.iconCircle}>
                        <Ionicons name="lock-closed" size={40} color={Colors.primary.solid} />
                    </View>
                    <Text style={styles.title}>CredVault</Text>
                    <Text style={styles.subtitle}>Enter your Master PIN to unlock</Text>
                </View>

                <View style={styles.form}>
                    {/* PIN Input Container with Overlay */}
                    <View style={styles.pinInputWrapper}>
                        <TouchableWithoutFeedback onPress={() => {
                            // Force blur first if already focused but keyboard is hidden
                            if (pinInputRef.current?.isFocused()) {
                                pinInputRef.current.blur();
                            }
                            // Small delay to ensure the blur completes and keyboard state resets
                            setTimeout(() => {
                                pinInputRef.current?.focus();
                            }, 50);
                        }}>
                            {/* PIN Digit Boxes - Simple Borders */}
                            <View style={styles.pinContainer}>
                                {[0, 1, 2, 3].map((index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.pinBox,
                                            {
                                                width: isTablet ? scale(70) : scale(60),
                                                height: isTablet ? scale(80) : scale(70),
                                            },
                                            pin.length > index && styles.pinBoxFilled
                                        ]}
                                    >
                                        <Text style={[styles.pinDot, { fontSize: responsiveFontSize(40) }]}>
                                            {pin.length > index ? '●' : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>

                        {/* Hidden input */}
                        <TextInput
                            ref={pinInputRef}
                            style={styles.hiddenInput}
                            value={pin}
                            onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            maxLength={4}
                            onSubmitEditing={handleLogin}
                            autoFocus
                            caretHidden
                            textContentType="oneTimeCode"
                        />
                    </View>

                    <GradientButton
                        onPress={handleLogin}
                        size="large"
                        fullWidth
                        disabled={pin.length !== 4}
                        icon={<Ionicons name="lock-open" size={22} color="#fff" />}
                        iconPosition="left"
                        glowEffect={pin.length === 4}
                    >
                        Unlock Vault
                    </GradientButton>

                    {/* Forgot PIN Link - Simple and Subtle */}
                    <TouchableOpacity
                        style={styles.forgotPinContainer}
                        onPress={handleForgotPin}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.forgotPinText}>
                            Forgot PIN? <Text style={styles.forgotPinLink}>Reset it</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Reset PIN Modal */}
            <Modal
                visible={showResetModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowResetModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingRight: 12 }}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconContainer}>
                                    <Ionicons name="checkmark-circle" size={56} color={Colors.success.solid} />
                                </View>
                                <Text style={styles.modalTitle}>Identity Verified</Text>
                                <Text style={styles.modalSubtitle}>
                                    Create a new 4-digit PIN to secure your vault
                                </Text>
                            </View>

                            <View style={styles.modalForm}>
                                <Text style={styles.inputLabel}>New PIN</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Enter 4 digits"
                                    placeholderTextColor="#adb5bd"
                                    value={newPin}
                                    onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, ''))}
                                    secureTextEntry
                                    keyboardType="numeric"
                                    maxLength={4}
                                    autoFocus
                                />

                                <Text style={styles.inputLabel}>Confirm New PIN</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Re-enter 4 digits"
                                    placeholderTextColor="#adb5bd"
                                    value={confirmPin}
                                    onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, ''))}
                                    secureTextEntry
                                    keyboardType="numeric"
                                    maxLength={4}
                                />

                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle" size={20} color={Colors.info.solid} style={{ marginRight: 8 }} />
                                    <Text style={styles.infoText}>
                                        Choose a PIN you'll remember but others can't guess. Avoid simple patterns like 1234 or 0000.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowResetModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveButton, isResettingPin && styles.saveButtonDisabled]}
                                    onPress={handleSaveNewPin}
                                    disabled={isResettingPin}
                                >
                                    {isResettingPin ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>Save New PIN</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {/* Footer with Copyright & Legal */}
            <View style={styles.footer}>
                <Text style={styles.copyrightText}>© 2025 CredVault • v1.0.0</Text>
                <View style={styles.legalLinks}>
                    <TouchableOpacity onPress={() => Alert.alert(
                        'Terms of Service',
                        'Last Updated: December 11, 2025\n\nBy using CredVault, you agree to:\n\n1. ELIGIBILITY: You must be at least 13 years old to use this app.\n\n2. SECURITY: You are solely responsible for maintaining the confidentiality of your Master PIN, Master Password, and any recovery methods. Never share these credentials.\n\n3. LIABILITY: This software is provided "as is" without warranties. We are not liable for data loss, security breaches, or damages resulting from device compromise, lost credentials, or unauthorized access.\n\n4. USAGE: This app is for personal, non-commercial use only. Do not use it for illegal activities.\n\n5. ACCOUNT TERMINATION: You may delete your account anytime via Settings. Cloud data will be permanently deleted immediately (or within 30 days max).\n\n6. UPDATES: We may update these terms. Continued use after changes constitutes acceptance.\n\n7. CONTACT: For support, email veni.innovations@gmail.com',
                        [{ text: 'I Agree' }]
                    )}>
                        <Text style={styles.legalLinkText}>Terms</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalSeparator}>•</Text>
                    <TouchableOpacity onPress={() => Alert.alert(
                        'Privacy Policy',
                        'Last Updated: December 11, 2025\n\nYour privacy is our priority.\n\n1. DATA OWNERSHIP: You own your data. Passwords are stored locally on your device and optionally synced to Google Firebase Cloud Firestore when cloud sync is enabled.\n\n2. ENCRYPTION: All sensitive data (passwords, notes) is encrypted using AES-256-GCM encryption before storage. Your Master Password never leaves your device.\n\n3. DATA COLLECTION: We do NOT collect, track, analyze, or sell your personal information. No analytics, no ads, no third-party tracking.\n\n4. CLOUD STORAGE: If you enable cloud sync, your encrypted data is stored on Google Firebase (USA). Google\'s privacy policy applies to cloud infrastructure.\n\n5. PERMISSIONS: Internet access is required only for optional cloud sync. The app works fully offline.\n\n6. DATA DELETION: You can delete all local data and cloud data anytime via Settings → Sign Out or uninstall. Cloud data deletion is permanent and irreversible.\n\n7. SECURITY: We use industry-standard encryption. However, if you lose your Master Password or PIN, we CANNOT recover your data.\n\n8. CHILDREN: This app is not intended for children under 13.\n\n9. CONTACT: Questions? Email veni.innovations@gmail.com\n\nFull policy: sites.google.com/view/credvault-privacy',
                        [{ text: 'Close' }]
                    )}>
                        <Text style={styles.legalLinkText}>Privacy</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Custom Alert */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
                onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.neutral.white,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 30,
    },
    header: {
        alignItems: 'center',
        marginBottom: 50,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.neutral.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: Colors.border.light,
    },
    title: {
        fontSize: FontSizes.h1,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: FontSizes.medium,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    pinInputWrapper: {
        position: 'relative',
        marginBottom: 40,
    },
    pinContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    pinBox: {
        backgroundColor: Colors.neutral.white,
        borderWidth: 2,
        borderColor: Colors.border.medium,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.small,
    },
    pinBoxFilled: {
        borderColor: Colors.success.solid,
        backgroundColor: Colors.success.light,
    },
    pinDot: {
        color: Colors.primary.solid,
        fontWeight: FontWeights.bold,
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    forgotPinContainer: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    forgotPinText: {
        fontSize: FontSizes.small,
        color: Colors.text.tertiary,
        textAlign: 'center',
    },
    forgotPinLink: {
        color: Colors.primary.solid,
        fontWeight: FontWeights.semibold,
        textDecorationLine: 'underline',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.neutral.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '80%',
        ...Shadows.large,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 30,
    },
    modalIconContainer: {
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: FontSizes.small,
        color: Colors.text.secondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    modalForm: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold,
        color: Colors.text.secondary,
        marginBottom: 8,
        marginTop: 12,
    },
    modalInput: {
        backgroundColor: Colors.neutral.gray100,
        borderWidth: 1,
        borderColor: Colors.border.medium,
        borderRadius: 12,
        padding: 16,
        marginRight: 8,
        fontSize: 24,
        textAlign: 'center',
        letterSpacing: 8,
        color: Colors.text.primary,
        fontWeight: FontWeights.bold,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: Colors.info.light,
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        borderLeftWidth: 3,
        borderLeftColor: Colors.info.solid,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        fontSize: FontSizes.tiny,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: Colors.neutral.gray100,
        borderWidth: 1,
        borderColor: Colors.border.medium,
    },
    cancelButtonText: {
        color: Colors.text.secondary,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
    },
    saveButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: Colors.primary.solid,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: Colors.neutral.white,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.bold,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: Colors.neutral.gray50,
        borderTopWidth: 1,
        borderTopColor: Colors.border.light,
    },
    copyrightText: {
        fontSize: FontSizes.tiny,
        color: Colors.text.secondary,
        marginBottom: 8,
    },
    legalLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    legalLinkText: {
        fontSize: FontSizes.tiny,
        color: Colors.primary.solid,
        textDecorationLine: 'underline',
        fontWeight: FontWeights.semibold,
    },
    legalSeparator: {
        fontSize: FontSizes.tiny,
        color: Colors.text.disabled,
    },
});
