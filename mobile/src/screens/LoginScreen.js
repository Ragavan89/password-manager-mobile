import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import CustomAlert from '../components/CustomAlert';
import { isMasterPasswordSet, isPINSet, verifyPIN } from '../services/Encryption';

export default function LoginScreen({ navigation }) {
    const [pin, setPin] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [biometricAvailable, setBiometricAvailable] = useState(false);
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
        // Verify PIN
        const isValid = await verifyPIN(pin);

        if (isValid) {
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
            setAlertConfig({
                visible: true,
                title: 'Invalid PIN',
                message: 'The PIN you entered is incorrect. Please try again.',
                type: 'error',
                buttons: [{ text: 'Try Again', style: 'default' }]
            });
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

    const handleSaveNewPin = () => {
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

        // In a real app, you would save this securely
        // For now, we'll just show success and close modal
        Alert.alert(
            'Success! ✅',
            `Your new PIN has been set.\n\nNew PIN: ${newPin}\n\n⚠️ Important: In this demo version, the PIN is still hardcoded to 1234. In production, your new PIN would be saved securely.`,
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
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <Text style={styles.icon}>🔒</Text>
                    <Text style={styles.title}>KeyVault Pro</Text>
                    <Text style={styles.subtitle}>Enter your Master PIN to unlock</Text>
                </View>

                <View style={styles.form}>
                    {/* PIN Input Container with Overlay */}
                    <View style={styles.pinInputWrapper}>
                        {/* PIN Digit Boxes */}
                        <View style={styles.pinContainer}>
                            {[0, 1, 2, 3].map((index) => (
                                <View key={index} style={styles.pinBox}>
                                    <Text style={styles.pinDot}>
                                        {pin.length > index ? '●' : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Transparent overlay input */}
                        <TextInput
                            ref={pinInputRef}
                            style={styles.overlayInput}
                            value={pin}
                            onChangeText={setPin}
                            keyboardType="numeric"
                            maxLength={4}
                            onSubmitEditing={handleLogin}
                            autoFocus
                            caretHidden
                            textContentType="oneTimeCode"
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={handleLogin}>
                        <Text style={styles.buttonText}>Unlock Vault</Text>
                    </TouchableOpacity>

                    {/* Forgot PIN Link */}
                    <TouchableOpacity
                        style={styles.forgotPinContainer}
                        onPress={handleForgotPin}
                    >
                        <Text style={styles.forgotPinText}>Forgot PIN?</Text>
                        <Text style={styles.forgotPinSubtext}>
                            {biometricAvailable
                                ? 'Reset using your device unlock'
                                : 'Reset using device authentication'}
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalIcon}>✅</Text>
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
                                    onChangeText={setNewPin}
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
                                    onChangeText={setConfirmPin}
                                    secureTextEntry
                                    keyboardType="numeric"
                                    maxLength={4}
                                />

                                <View style={styles.infoBox}>
                                    <Text style={styles.infoIcon}>💡</Text>
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
                                    style={styles.saveButton}
                                    onPress={handleSaveNewPin}
                                >
                                    <Text style={styles.saveButtonText}>Save New PIN</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {/* Footer with Copyright & Legal */}
            <View style={styles.footer}>
                <Text style={styles.copyrightText}>© 2025 KeyVault Pro • v1.0.0</Text>
                <View style={styles.legalLinks}>
                    <TouchableOpacity onPress={() => Alert.alert(
                        'Terms of Service',
                        'By using KeyVault Pro, you agree to:\n\n1. Security: You are responsible for maintaining the confidentiality of your Master PIN and recovery methods.\n\n2. Liability: This software is provided "as is". We are not liable for any data loss or security breaches resulting from device compromise or lost credentials.\n\n3. Usage: This app is for personal use.\n\n4. Updates: We may update these terms to reflect app changes.',
                        [{ text: 'I Agree' }]
                    )}>
                        <Text style={styles.legalLinkText}>Terms</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalSeparator}>•</Text>
                    <TouchableOpacity onPress={() => Alert.alert(
                        'Privacy Policy',
                        'Your privacy is our priority.\n\n1. Data Ownership: You own your data. Passwords are stored locally on your device and synced only to your personal Google Sheet.\n\n2. Encryption: All sensitive data is encrypted using AES-256 before storage.\n\n3. No Tracking: We do not collect, track, or sell your personal information.\n\n4. Permissions: Internet access is required only for syncing with your Google Sheet.',
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
        backgroundColor: '#fff',
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
    icon: {
        fontSize: 60,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#868e96',
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    pinInputWrapper: {
        position: 'relative',
        marginBottom: 30,
    },
    pinContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    pinBox: {
        width: 60,
        height: 70,
        backgroundColor: '#f8f9fa',
        borderWidth: 2,
        borderColor: '#007AFF',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pinDot: {
        fontSize: 40,
        color: '#007AFF',
        fontWeight: 'bold',
    },
    overlayInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
        fontSize: 1,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPinContainer: {
        marginTop: 30,
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    forgotPinText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 4,
    },
    forgotPinSubtext: {
        fontSize: 12,
        color: '#6c757d',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 30,
    },
    modalIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6c757d',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    modalForm: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 8,
        marginTop: 12,
    },
    modalInput: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 12,
        padding: 16,
        fontSize: 24,
        textAlign: 'center',
        letterSpacing: 8,
        color: '#212529',
        fontWeight: 'bold',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#e7f5ff',
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#1971c2',
    },
    infoIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: '#495057',
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
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    cancelButtonText: {
        color: '#495057',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#007AFF',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        alignItems: 'center',
        marginBottom: 40,
    },
    copyrightText: {
        fontSize: 12,
        color: '#adb5bd',
        marginBottom: 8,
    },
    legalLinks: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legalLinkText: {
        fontSize: 12,
        color: '#868e96',
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        fontSize: 12,
        color: '#adb5bd',
        marginHorizontal: 8,
    },
});
