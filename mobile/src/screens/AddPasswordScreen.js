import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { addPasswordOffline, updatePasswordOffline } from '../services/SyncService';
import { encryptPassword, decryptPassword } from '../services/Encryption';

export default function AddPasswordScreen({ navigation, route }) {
    const itemToEdit = route.params?.item;
    const isEditMode = !!itemToEdit;

    const [siteName, setSiteName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);

    const usernameRef = useRef(null);
    const passwordRef = useRef(null);
    const commentsRef = useRef(null);

    useEffect(() => {
        if (isEditMode) {
            setSiteName(itemToEdit.siteName);
            setUsername(itemToEdit.username);
            setPassword(decryptPassword(itemToEdit.encryptedPassword));
            setComments(itemToEdit.comments || '');
            navigation.setOptions({ title: 'Edit Password' });
        }
    }, [isEditMode, itemToEdit, navigation]);

    const handleSave = async () => {
        if (!siteName || !username || !password) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            const encrypted = encryptPassword(password);

            if (isEditMode) {
                await updatePasswordOffline(itemToEdit.id, siteName, username, encrypted, comments);
                Alert.alert('Success', 'Password updated and queued for sync');
            } else {
                await addPasswordOffline(siteName, username, encrypted, comments);
                Alert.alert('Success', 'Password saved and queued for sync');
            }

            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to save password');
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
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <TextInput
                                ref={passwordRef}
                                style={styles.input}
                                placeholder="Required"
                                placeholderTextColor="#adb5bd"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                returnKeyType="next"
                                onSubmitEditing={() => commentsRef.current.focus()}
                                blurOnSubmit={false}
                            />
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
