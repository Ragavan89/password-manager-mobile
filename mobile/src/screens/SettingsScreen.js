import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, Platform, ScrollView, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'SHEETS_API_URL';

export default function SettingsScreen({ navigation }) {
    const [url, setUrl] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        loadUrl();
    }, []);

    const loadUrl = async () => {
        try {
            let storedUrl = null;
            if (Platform.OS === 'web') {
                storedUrl = localStorage.getItem(STORE_KEY);
            } else {
                storedUrl = await SecureStore.getItemAsync(STORE_KEY);
            }
            if (storedUrl) {
                setUrl(storedUrl);
                setIsConfigured(true);
            } else {
                setIsConfigured(false);
            }
        } catch (e) {
            console.error('Failed to load URL', e);
        }
    };

    const handleSave = async () => {
        if (!url) {
            Alert.alert('Error', 'Please enter a URL');
            return;
        }

        try {
            if (Platform.OS === 'web') {
                localStorage.setItem(STORE_KEY, url);
            } else {
                await SecureStore.setItemAsync(STORE_KEY, url);
            }
            Alert.alert('Success', 'URL saved successfully! Your passwords will now sync with Google Sheets.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Failed to save URL');
            console.error(e);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
                <Text style={styles.headerIcon}>⚙️</Text>
                <Text style={styles.headerTitle}>Google Sheets Configuration</Text>
                <Text style={styles.headerSubtitle}>
                    Connect your app to Google Sheets to sync passwords across devices
                </Text>
            </View>

            {/* Data Loss Warning Card - Only show when not configured */}
            {!isConfigured && (
                <View style={styles.dataLossWarningCard}>
                    <Text style={styles.warningCardIcon}>⚠️</Text>
                    <Text style={styles.warningCardTitle}>Data Loss Risk</Text>
                    <Text style={styles.warningCardText}>
                        Your passwords are currently stored ONLY on this device. If you:
                    </Text>
                    <View style={styles.warningList}>
                        <Text style={styles.warningListItem}>• Uninstall this app</Text>
                        <Text style={styles.warningListItem}>• Factory reset your device</Text>
                        <Text style={styles.warningListItem}>• Lose or damage your device</Text>
                    </View>
                    <Text style={styles.warningCardEmphasis}>
                        ALL YOUR PASSWORDS WILL BE PERMANENTLY LOST.
                    </Text>
                    <Text style={styles.warningCardAction}>
                        Configure cloud sync below to protect your data.
                    </Text>
                </View>
            )}

            {/* Info Card */}
            <View style={styles.infoCard}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoTitle}>What is this?</Text>
                <Text style={styles.infoText}>
                    This app uses Google Sheets as a secure cloud database. Your passwords are encrypted before being stored in your personal Google Sheet.
                </Text>
            </View>

            {/* Setup Steps */}
            <View style={styles.stepsCard}>
                <Text style={styles.stepsTitle}>📋 Quick Setup Steps:</Text>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>1.</Text>
                    <Text style={styles.stepText}>Copy the Template Google Sheet</Text>
                </View>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>2.</Text>
                    <Text style={styles.stepText}>Open Extensions → Apps Script</Text>
                </View>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>3.</Text>
                    <Text style={styles.stepText}>Deploy → New deployment → Web app</Text>
                </View>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>4.</Text>
                    <Text style={styles.stepText}>Set access to "Anyone" and Deploy</Text>
                </View>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>5.</Text>
                    <Text style={styles.stepText}>Copy the Web App URL</Text>
                </View>
                <View style={styles.step}>
                    <Text style={styles.stepNumber}>6.</Text>
                    <Text style={styles.stepText}>Paste the URL below and Save</Text>
                </View>
            </View>

            {/* URL Input Section */}
            <View style={styles.inputSection}>
                <Text style={styles.label}>Google Apps Script Web App URL</Text>
                <TextInput
                    style={styles.input}
                    placeholder="https://script.google.com/macros/s/..."
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    numberOfLines={3}
                />
                <Text style={styles.hint}>
                    💡 The URL should start with "https://script.google.com/macros/s/"
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.setupButton}
                    onPress={() => navigation.navigate('SetupGuide')}
                >
                    <Text style={styles.setupButtonIcon}>📖</Text>
                    <Text style={styles.setupButtonText}>View Detailed Setup Guide</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                >
                    <Text style={styles.saveButtonText}>💾 Save Configuration</Text>
                </TouchableOpacity>
            </View>

            {/* Security Note */}
            <View style={styles.securityNote}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={styles.securityText}>
                    Your passwords are encrypted with AES-256 before syncing. Only you can decrypt them.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerSection: {
        backgroundColor: '#fff',
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    headerIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6c757d',
        textAlign: 'center',
        lineHeight: 20,
    },
    dataLossWarningCard: {
        backgroundColor: '#ff8787',
        margin: 16,
        padding: 18,
        borderRadius: 12,
        borderLeftWidth: 5,
        borderLeftColor: '#fa5252',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    warningCardIcon: {
        fontSize: 32,
        marginBottom: 10,
        textAlign: 'center',
    },
    warningCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    warningCardText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
        marginBottom: 8,
    },
    warningList: {
        marginLeft: 12,
        marginBottom: 12,
    },
    warningListItem: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 22,
        marginBottom: 4,
    },
    warningCardEmphasis: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    warningCardAction: {
        fontSize: 13,
        color: '#fff',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    infoCard: {
        backgroundColor: '#e7f5ff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#1971c2',
    },
    infoIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1971c2',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#495057',
        lineHeight: 20,
    },
    stepsCard: {
        backgroundColor: '#fff',
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    stepsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 12,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    stepNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        width: 24,
    },
    stepText: {
        fontSize: 14,
        color: '#495057',
        flex: 1,
    },
    inputSection: {
        backgroundColor: '#fff',
        margin: 16,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ced4da',
        padding: 12,
        fontSize: 14,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    hint: {
        color: '#6c757d',
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic',
    },
    buttonContainer: {
        margin: 16,
        marginTop: 0,
    },
    setupButton: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#007AFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    setupButtonIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    setupButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    securityNote: {
        backgroundColor: '#d3f9d8',
        margin: 16,
        marginTop: 0,
        marginBottom: 32,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    securityIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: '#2b8a3e',
        lineHeight: 18,
    },
});
