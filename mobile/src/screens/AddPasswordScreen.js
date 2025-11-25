import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { addPasswordOffline, updatePasswordOffline } from '../services/SyncService';
import { encryptPassword, decryptPassword } from '../services/Encryption';
import CustomAlert from '../components/CustomAlert';

export default function AddPasswordScreen({ navigation, route }) {
    const itemToEdit = route.params?.item;
    const isEditMode = !!itemToEdit;

    const [siteName, setSiteName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: []
    });

    const usernameRef = useRef(null);
    const passwordRef = useRef(null);
    const commentsRef = useRef(null);

    useEffect(() => {
        if (isEditMode) {
            setSiteName(itemToEdit.siteName);
            setUsername(itemToEdit.username);
            // Decrypt password asynchronously
            decryptPassword(itemToEdit.encryptedPassword).then(setPassword);
            setComments(itemToEdit.comments || '');
            navigation.setOptions({ title: 'Edit Password' });
        }
    }, [isEditMode, itemToEdit, navigation]);

    // Calculate password strength
    const getPasswordStrength = (pwd) => {
        if (!pwd) return { strength: '', color: '#adb5bd', percentage: 0 };

        let score = 0;

        // Length criteria
        if (pwd.length >= 8) score += 1;
        if (pwd.length >= 12) score += 1;
        if (pwd.length >= 16) score += 1;

        // Character variety
        if (/[a-z]/.test(pwd)) score += 1; // lowercase
        if (/[A-Z]/.test(pwd)) score += 1; // uppercase
        if (/[0-9]/.test(pwd)) score += 1; // numbers
        if (/[^a-zA-Z0-9]/.test(pwd)) score += 1; // special chars

        // Determine strength
        if (score <= 2) return { strength: 'Weak', color: '#ff6b6b', percentage: 25 };
        if (score <= 4) return { strength: 'Medium', color: '#ffa94d', percentage: 50 };
        if (score <= 5) return { strength: 'Strong', color: '#51cf66', percentage: 75 };
        return { strength: 'Very Strong', color: '#37b24d', percentage: 100 };
    };

    const passwordStrength = getPasswordStrength(password);

    const handleSave = async () => {
        if (!siteName || !username || !password) {
            setAlertConfig({
                visible: true,
                title: 'Missing Information',
                message: 'Please fill in all required fields: Website/App, Username, and Password.',
                type: 'warning',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            return;
        }

        setLoading(true);
        try {
            const encrypted = await encryptPassword(password);

            if (isEditMode) {
                await updatePasswordOffline(itemToEdit.id, siteName, username, encrypted, comments);
                setAlertConfig({
                    visible: true,
                    title: 'Password Updated!',
                    message: 'Your password has been saved locally and will sync to Google Sheets when you\'re online.',
                    type: 'success',
                    buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
                });
                return;
            } else {
                await addPasswordOffline(siteName, username, encrypted, comments);
                setAlertConfig({
                    visible: true,
                    title: 'Password Saved!',
                    message: 'Your password is securely saved on this device and will automatically sync to Google Sheets when you\'re online.',
                    type: 'success',
                    buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
                });
                return;
            }

        } catch (error) {
            setAlertConfig({
                visible: true,
                title: 'Save Failed',
                message: 'Could not save password. Please try again.\n\nError: ' + error.message,
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.headerTitle}>{isEditMode ? 'Edit Entry' : 'New Entry'}</Text>
                    <Text style={styles.headerSubtitle}>Securely save your credentials</Text>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>WEBSITE / APP</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Netflix"
                                placeholderTextColor="#adb5bd"
                                value={siteName}
                                onChangeText={setSiteName}
                                returnKeyType="next"
                                onSubmitEditing={() => usernameRef.current.focus()}
                                blurOnSubmit={false}
                                maxLength={100}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>USERNAME / EMAIL</Text>
                            <TextInput
                                ref={usernameRef}
                                style={styles.input}
                                placeholder="e.g. john@example.com"
                                placeholderTextColor="#adb5bd"
                                value={username}
                                onChangeText={setUsername}
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current.focus()}
                                blurOnSubmit={false}
                                autoCapitalize="none"
                                maxLength={100}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    ref={passwordRef}
                                    style={styles.passwordInput}
                                    placeholder="Required"
                                    placeholderTextColor="#adb5bd"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="next"
                                    onSubmitEditing={() => commentsRef.current.focus()}
                                    blurOnSubmit={false}
                                    maxLength={256}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                >
                                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Password Strength Indicator */}
                            {password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBar}>
                                        <View
                                            style={[
                                                styles.strengthFill,
                                                {
                                                    width: `${passwordStrength.percentage}%`,
                                                    backgroundColor: passwordStrength.color
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                                        {passwordStrength.strength}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>COMMENTS (OPTIONAL)</Text>
                            <TextInput
                                ref={commentsRef}
                                style={[styles.input, styles.commentsInput]}
                                placeholder="Add any notes or comments..."
                                placeholderTextColor="#adb5bd"
                                value={comments}
                                onChangeText={setComments}
                                multiline
                                numberOfLines={3}
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                                maxLength={500}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{isEditMode ? 'Update Password' : 'Save Password'}</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

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
        padding: 24,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#868e96',
        marginBottom: 40,
    },
    form: {
        marginBottom: 30,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#868e96',
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#212529',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 12,
    },
    passwordInput: {
        flex: 1,
        padding: 16,
        fontSize: 16,
        color: '#212529',
    },
    eyeButton: {
        padding: 16,
    },
    eyeIcon: {
        fontSize: 20,
    },
    strengthContainer: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    strengthBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#e9ecef',
        borderRadius: 3,
        overflow: 'hidden',
    },
    strengthFill: {
        height: '100%',
        borderRadius: 3,
        transition: 'width 0.3s ease',
    },
    strengthText: {
        fontSize: 12,
        fontWeight: 'bold',
        minWidth: 80,
        textAlign: 'right',
    },
    commentsInput: {
        height: 80,
        textAlignVertical: 'top',
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
        backgroundColor: '#a5d8ff',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
