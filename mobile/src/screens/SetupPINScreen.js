import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupPIN } from '../services/Encryption';

export default function SetupPINScreen({ navigation }) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1); // 1 = create PIN, 2 = confirm PIN
    const pinInputRef = useRef(null);

    const handleContinue = () => {
        if (step === 1) {
            // Validate first PIN entry
            if (pin.length !== 4) {
                Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits');
                return;
            }

            // Move to confirmation step
            setStep(2);
            setConfirmPin('');
            setTimeout(() => pinInputRef.current?.focus(), 100);
        } else {
            // Validate confirmation
            if (confirmPin.length !== 4) {
                Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits');
                return;
            }

            if (pin !== confirmPin) {
                Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
                setStep(1);
                setPin('');
                setConfirmPin('');
                return;
            }

            // Save PIN
            handleSavePIN();
        }
    };

    const handleSavePIN = async () => {
        const result = await setupPIN(pin);

        if (result.success) {
            // PIN saved! Navigate to Master Password setup
            navigation.replace('SetupMasterPassword');
        } else {
            Alert.alert('Error', result.error || 'Failed to save PIN. Please try again.');
        }
    };

    const handleBack = () => {
        if (step === 2) {
            setStep(1);
            setConfirmPin('');
        }
    };

    const currentPin = step === 1 ? pin : confirmPin;
    const setCurrentPin = step === 1 ? setPin : setConfirmPin;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.icon}>🔐</Text>
                        <Text style={styles.title}>
                            {step === 1 ? 'Create Your PIN' : 'Confirm Your PIN'}
                        </Text>
                        <Text style={styles.subtitle}>
                            {step === 1
                                ? 'Choose a 4-digit PIN to secure your vault'
                                : 'Re-enter your PIN to confirm'}
                        </Text>
                    </View>

                    {step === 1 && (
                        <View style={styles.infoBox}>
                            <Text style={styles.infoIcon}>💡</Text>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoTitle}>PIN Tips:</Text>
                                <Text style={styles.infoText}>
                                    • Avoid simple patterns (1234, 0000){'\n'}
                                    • Don't use all same digits{'\n'}
                                    • Choose something memorable but secure
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.form}>
                        {/* PIN Input Container with Overlay */}
                        <View style={styles.pinInputWrapper}>
                            {/* PIN Digit Boxes */}
                            <View style={styles.pinContainer}>
                                {[0, 1, 2, 3].map((index) => (
                                    <View key={index} style={styles.pinBox}>
                                        <Text style={styles.pinDot}>
                                            {currentPin.length > index ? '●' : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* Transparent overlay input */}
                            <TextInput
                                ref={pinInputRef}
                                style={styles.overlayInput}
                                value={currentPin}
                                onChangeText={setCurrentPin}
                                keyboardType="numeric"
                                maxLength={4}
                                onSubmitEditing={handleContinue}
                                autoFocus
                                caretHidden
                                textContentType="oneTimeCode"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, currentPin.length !== 4 && styles.buttonDisabled]}
                            onPress={handleContinue}
                            disabled={currentPin.length !== 4}
                        >
                            <Text style={styles.buttonText}>
                                {step === 1 ? 'Continue' : 'Confirm & Save'}
                            </Text>
                        </TouchableOpacity>

                        {step === 2 && (
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={handleBack}
                            >
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 30,
        paddingTop: 20,
        paddingBottom: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    icon: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#868e96',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#e7f5ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#1971c2',
    },
    infoIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1971c2',
        marginBottom: 6,
    },
    infoText: {
        fontSize: 13,
        color: '#495057',
        lineHeight: 20,
    },
    form: {
        width: '100%',
    },
    pinInputWrapper: {
        position: 'relative',
        marginBottom: 24,
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
    buttonDisabled: {
        backgroundColor: '#adb5bd',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        marginTop: 20,
        alignItems: 'center',
        padding: 12,
    },
    backButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
