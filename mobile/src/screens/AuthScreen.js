import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail, signUpWithEmail, sendResetEmail } from '../services/FirebaseAuthService';
import * as SecureStore from 'expo-secure-store';
import CustomAlert from '../components/CustomAlert';

export default function AuthScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: [],
        textAlign: 'center'
    });

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter your email address first',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setLoading(true);
        const result = await sendResetEmail(email);
        setLoading(false);

        if (result.success) {
            setAlertConfig({
                visible: true,
                title: 'Check Your Email',
                message: 'A password reset link has been sent to your email address.\n\nIf you don\'t see it in your inbox, please check your spam or junk folder.',
                type: 'success',
                buttons: [{ text: 'OK', style: 'default' }],
                textAlign: 'left'
            });
        } else {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: result.error,
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
        }
    };

    const handleAuth = async () => {
        if (!email || !password) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter email and password',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        if (!validateEmail(email)) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter a valid email address',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        if (isSignUp && password !== confirmPassword) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Passwords do not match',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        setLoading(true);

        const result = isSignUp
            ? await signUpWithEmail(email, password)
            : await signInWithEmail(email, password);

        setLoading(false);

        if (!result.success) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: result.error,
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
        } else {
            // Save user email for cloud sync
            await SecureStore.setItemAsync('FIREBASE_USER_EMAIL', email);
            await SecureStore.setItemAsync('CLOUD_SYNC_ENABLED', 'true');

            Alert.alert(
                'Success',
                'Cloud sync enabled! Your passwords will now be backed up to the cloud.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.icon}>☁️</Text>
                        <Text style={styles.title}>Enable Cloud Sync</Text>
                        <Text style={styles.subtitle}>
                            Sign in to backup your passwords to the cloud and sync across devices
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.formTitle}>
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />

                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoComplete={isSignUp ? 'password-new' : 'password'}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Text style={{ fontSize: 20 }}>{showPassword ? '👁️' : '🙈'}</Text>
                            </TouchableOpacity>
                        </View>

                        {!isSignUp && (
                            <TouchableOpacity
                                style={styles.forgotPasswordButton}
                                onPress={handleForgotPassword}
                            >
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </TouchableOpacity>
                        )}

                        {isSignUp && (
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Confirm Password"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    autoComplete="password-new"
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    <Text style={{ fontSize: 20 }}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={() => {
                                setIsSignUp(!isSignUp);
                                setConfirmPassword('');
                            }}
                        >
                            <Text style={styles.switchText}>
                                {isSignUp
                                    ? 'Already have an account? Sign In'
                                    : "Don't have an account? Create One"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            🔒 Your passwords are encrypted end-to-end
                        </Text>
                        <Text style={styles.footerText}>
                            📱 Works offline - syncs when online
                        </Text>
                        <Text style={styles.footerText}>
                            ⚡ Optional - app works without cloud sync
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Custom Alert */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
                textAlign={alertConfig.textAlign}
                onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    icon: {
        fontSize: 60,
        marginBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        fontSize: 16,
        marginBottom: 15,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 15,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 5,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    switchButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    switchText: {
        color: '#007AFF',
        fontSize: 16,
    },
    cancelButton: {
        marginTop: 15,
        alignItems: 'center',
    },
    cancelText: {
        color: '#666',
        fontSize: 16,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        textAlign: 'center',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 15,
    },
    forgotPasswordText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
