import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { isMasterPasswordRequired } from '../config/EncryptionConfig';
import { validateMasterPasswordStrength } from '../services/AuthService';
import { setupMasterPassword } from '../services/Encryption';

export default function SetupMasterPasswordScreen({ navigation }) {
    const [masterPassword, setMasterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ valid: false, strength: 'none', message: '' });
    const [showBackupScreen, setShowBackupScreen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Check if master password is required
    useEffect(() => {
        if (!isMasterPasswordRequired()) {
            // Skip this screen in APP_SECRET_ONLY mode
            navigation.replace('Home');
        }
    }, []);

    // Validate password strength as user types
    useEffect(() => {
        if (masterPassword) {
            const validation = validateMasterPasswordStrength(masterPassword);
            setPasswordStrength(validation);
        } else {
            setPasswordStrength({ valid: false, strength: 'none', message: '' });
        }
    }, [masterPassword]);

    const handleContinue = () => {
        // Validate master password
        if (!masterPassword) {
            Alert.alert('Error', 'Please enter a master password');
            return;
        }

        const validation = validateMasterPasswordStrength(masterPassword);
        if (!validation.valid) {
            Alert.alert('Weak Password', validation.message);
            return;
        }

        // Check if passwords match
        if (masterPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match. Please try again.');
            setConfirmPassword('');
            return;
        }

        // Show backup screen
        setShowBackupScreen(true);
    };

    const handleBackupComplete = async () => {
        setIsSaving(true);
        // Allow UI to update before blocking with encryption
        setTimeout(async () => {
            try {
                // Save the master password
                const result = await setupMasterPassword(masterPassword);

                if (result.success) {
                    // Master password saved! Go to home
                    navigation.replace('Home');
                } else {
                    Alert.alert('Error', result.error || 'Failed to save master password. Please try again.');
                    setIsSaving(false);
                }
            } catch (error) {
                Alert.alert('Error', 'An unexpected error occurred.');
                setIsSaving(false);
            }
        }, 100);
    };

    const handleCopyToClipboard = async () => {
        await Clipboard.setStringAsync(masterPassword);
        Alert.alert('Copied!', 'Master password copied to clipboard. Paste it somewhere safe!');
    };

    const getStrengthColor = () => {
        switch (passwordStrength.strength) {
            case 'strong': return '#28a745';
            case 'medium': return '#ffc107';
            case 'weak': return '#dc3545';
            default: return '#6c757d';
        }
    };

    if (showBackupScreen) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.icon}>✅</Text>
                        <Text style={styles.title}>Master Password Created!</Text>
                        <Text style={styles.subtitle}>Save it now before continuing</Text>
                    </View>

                    <View style={styles.backupSection}>
                        <View style={styles.passwordDisplay}>
                            <Text style={styles.passwordLabel}>Your Master Password:</Text>
                            <View style={styles.passwordBox}>
                                <Text style={styles.passwordText}>{masterPassword}</Text>
                            </View>
                        </View>

                        <View style={styles.warningBox}>
                            <Text style={styles.warningIcon}>⚠️</Text>
                            <Text style={styles.warningTitle}>IMPORTANT - Save This Now!</Text>
                            <Text style={styles.warningText}>
                                You can view this later in Settings, but it's best to save it now:
                            </Text>
                        </View>

                        <View style={styles.backupOptions}>
                            <TouchableOpacity
                                style={styles.backupButton}
                                onPress={handleCopyToClipboard}
                            >
                                <Text style={styles.backupButtonIcon}>📋</Text>
                                <Text style={styles.backupButtonText}>Copy to Clipboard</Text>
                            </TouchableOpacity>

                            <View style={styles.backupOption}>
                                <Text style={styles.backupOptionIcon}>📸</Text>
                                <Text style={styles.backupOptionText}>Take a screenshot</Text>
                            </View>

                            <View style={styles.backupOption}>
                                <Text style={styles.backupOptionIcon}>📝</Text>
                                <Text style={styles.backupOptionText}>Write it down on paper</Text>
                            </View>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoIcon}>💡</Text>
                            <Text style={styles.infoText}>
                                You'll need this master password if you change devices or reinstall the app.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.continueButton, isSaving && styles.buttonDisabled]}
                        onPress={handleBackupComplete}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.continueButtonText}>I've Saved It - Continue</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <Text style={styles.icon}>🔐</Text>
                        <Text style={styles.title}>Secure Your Vault</Text>
                        <Text style={styles.subtitle}>Create your Master Password</Text>
                    </View>

                    <View style={styles.explanationBox}>
                        <Text style={styles.explanationTitle}>What is a Master Password?</Text>
                        <Text style={styles.explanationText}>
                            • A password YOU create and remember{'\n'}
                            • Used to encrypt all your stored passwords{'\n'}
                            • Unique to you (not shared with anyone){'\n'}
                            • Required if you change devices
                        </Text>
                    </View>

                    <View style={styles.warningBox}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningTitle}>Restoring from Cloud?</Text>
                        <Text style={styles.warningText}>
                            If you have existing cloud data, you MUST use the same Master Password to decrypt it. Using a different password will make your cloud data unreadable.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.inputLabel}>Create Master Password</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter a strong password"
                                placeholderTextColor="#adb5bd"
                                value={masterPassword}
                                onChangeText={setMasterPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {masterPassword.length > 0 && (
                            <View style={styles.strengthIndicator}>
                                <View style={styles.strengthBar}>
                                    <View
                                        style={[
                                            styles.strengthFill,
                                            {
                                                width: passwordStrength.strength === 'strong' ? '100%' :
                                                    passwordStrength.strength === 'medium' ? '66%' : '33%',
                                                backgroundColor: getStrengthColor()
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
                                    {passwordStrength.strength.toUpperCase()}: {passwordStrength.message}
                                </Text>
                            </View>
                        )}

                        <Text style={styles.inputLabel}>Confirm Master Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Re-enter your password"
                            placeholderTextColor="#adb5bd"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.tipsBox}>
                            <Text style={styles.tipsIcon}>💡</Text>
                            <View style={styles.tipsContent}>
                                <Text style={styles.tipsTitle}>Tips for a strong password:</Text>
                                <Text style={styles.tipsText}>
                                    ✓ Use a phrase: "MyDog@Fluffy2019"{'\n'}
                                    ✓ Combine words: "Blue$Coffee#Mountain"{'\n'}
                                    ✓ At least 8 characters{'\n'}
                                    ✓ Mix uppercase, numbers, symbols
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            (!passwordStrength.valid || !confirmPassword) && styles.buttonDisabled
                        ]}
                        onPress={handleContinue}
                        disabled={!passwordStrength.valid || !confirmPassword}
                    >
                        <Text style={styles.buttonText}>Continue</Text>
                    </TouchableOpacity>
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
        padding: 24,
        paddingTop: 16,
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    icon: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#868e96',
        textAlign: 'center',
    },
    explanationBox: {
        backgroundColor: '#e7f5ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#1971c2',
    },
    explanationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1971c2',
        marginBottom: 8,
    },
    explanationText: {
        fontSize: 14,
        color: '#495057',
        lineHeight: 22,
    },
    form: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 8,
        marginTop: 12,
    },
    inputContainer: {
        position: 'relative',
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#212529',
    },
    eyeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    eyeIcon: {
        fontSize: 20,
    },
    strengthIndicator: {
        marginTop: 12,
        marginBottom: 8,
    },
    strengthBar: {
        height: 4,
        backgroundColor: '#e9ecef',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tipsBox: {
        flexDirection: 'row',
        backgroundColor: '#fff3cd',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    tipsIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    tipsContent: {
        flex: 1,
    },
    tipsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 4,
    },
    tipsText: {
        fontSize: 12,
        color: '#856404',
        lineHeight: 18,
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
    backupSection: {
        marginBottom: 24,
    },
    passwordDisplay: {
        marginBottom: 24,
    },
    passwordLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 8,
    },
    passwordBox: {
        backgroundColor: '#f8f9fa',
        borderWidth: 2,
        borderColor: '#007AFF',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    passwordText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#007AFF',
        letterSpacing: 1,
    },
    warningBox: {
        backgroundColor: '#fff3cd',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    warningIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#856404',
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: '#856404',
        lineHeight: 20,
    },
    backupOptions: {
        marginBottom: 20,
    },
    backupButton: {
        backgroundColor: '#007AFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    backupButtonIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    backupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    backupOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        marginBottom: 8,
    },
    backupOptionIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    backupOptionText: {
        fontSize: 14,
        color: '#495057',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#e7f5ff',
        padding: 12,
        borderRadius: 12,
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
    continueButton: {
        backgroundColor: '#28a745',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#28a745',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
