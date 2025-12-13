/**
 * SetupPINScreen.js
 * 
 * First-time PIN creation screen (part of initial app setup).
 * 
 * Features:
 * - 4-digit PIN entry with visual dots
 * - Two-step flow: create PIN → confirm PIN
 * - PIN tips for choosing secure PINs
 * - Keyboard-avoiding layout
 * 
 * Navigation: App Launch (first time) → SetupPIN → SetupMasterPassword
 */

import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setupPIN } from '../services/Encryption';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { theme } from '../theme';

export default function SetupPINScreen({ navigation }) {
    // Responsive dimensions hook
    const { scale, responsiveFontSize, isTablet } = useResponsiveDimensions();
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
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="lock-closed" size={40} color={theme.colors.primary} />
                        </View>
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
                            <Ionicons name="information-circle" size={20} color={theme.colors.info} style={{ marginRight: 12 }} />
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
                                {/* PIN Digit Boxes */}
                                <View style={styles.pinContainer}>
                                    {[0, 1, 2, 3].map((index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.pinBox,
                                                {
                                                    width: isTablet ? scale(70) : scale(60),
                                                    height: isTablet ? scale(80) : scale(70),
                                                }
                                            ]}
                                        >
                                            <Text style={[styles.pinDot, { fontSize: responsiveFontSize(40) }]}>
                                                {currentPin.length > index ? '●' : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </TouchableWithoutFeedback>

                            {/* Hidden input */}
                            <TextInput
                                ref={pinInputRef}
                                style={styles.hiddenInput}
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
                    </View>
                    <View style={[styles.footer, { marginTop: 'auto' }]}>
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
        backgroundColor: theme.colors.surface,
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
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    title: {
        fontSize: theme.fonts.sizes.h2,
        fontWeight: theme.fonts.weights.bold,
        color: theme.colors.text,
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: theme.fonts.sizes.medium,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: theme.colors.infoLight,
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.info,
        alignItems: 'flex-start',
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.bold,
        color: theme.colors.info,
        marginBottom: 6,
    },
    infoText: {
        fontSize: theme.fonts.sizes.tiny,
        color: theme.colors.textSecondary,
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
        backgroundColor: theme.colors.surface,
        borderWidth: 2,
        borderColor: theme.colors.border,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.small,
    },
    pinDot: {
        color: theme.colors.primary,
        fontWeight: theme.fonts.weights.bold,
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        ...theme.shadows.small,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: theme.colors.textInverse,
        fontSize: theme.fonts.sizes.large,
        fontWeight: theme.fonts.weights.bold,
    },
    backButton: {
        marginTop: 20,
        alignItems: 'center',
        padding: 12,
    },
    backButtonText: {
        color: theme.colors.primary,
        fontSize: theme.fonts.sizes.medium,
        fontWeight: theme.fonts.weights.semibold,
    },
    footer: {
        padding: 24,
        paddingTop: 12,
        backgroundColor: theme.colors.surface,
    },
});
