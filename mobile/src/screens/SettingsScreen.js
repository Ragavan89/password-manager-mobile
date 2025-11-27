import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { verifyPIN } from '../services/Encryption';
import { getMasterPassword } from '../services/Encryption';
import { isMasterPasswordRequired } from '../config/EncryptionConfig';
import { getCurrentUser, signOut } from '../services/FirebaseAuthService';
import { syncToCloud, getLastSyncTime } from '../services/HybridStorageService';
import { firestore } from '../../firebase.config';

export default function SettingsScreen({ navigation }) {
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncing, setSyncing] = useState(false);

    // View Master Password states
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [showMasterPassword, setShowMasterPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadCloudSyncStatus();
    }, []);

    // Reload sync status when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadCloudSyncStatus();
        });
        return unsubscribe;
    }, [navigation]);

    const loadCloudSyncStatus = async () => {
        try {
            const enabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
            const email = await SecureStore.getItemAsync('FIREBASE_USER_EMAIL');
            const lastSync = await getLastSyncTime();

            setCloudSyncEnabled(enabled === 'true');
            setUserEmail(email || '');
            setLastSyncTime(lastSync);
        } catch (error) {
            console.error('Error loading cloud sync status:', error);
        }
    };

    const handleEnableCloudSync = () => {
        navigation.navigate('Auth');
    };

    const handleDisableCloudSync = async () => {
        Alert.alert(
            'Disable Cloud Sync',
            'Are you sure? Your passwords will remain on this device but will no longer sync to the cloud.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut();
                            await SecureStore.deleteItemAsync('CLOUD_SYNC_ENABLED');
                            await SecureStore.deleteItemAsync('FIREBASE_USER_EMAIL');
                            await SecureStore.deleteItemAsync('LAST_SYNC_TIME');
                            setCloudSyncEnabled(false);
                            setUserEmail('');
                            setLastSyncTime(null);
                            Alert.alert('Success', 'Cloud sync disabled');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to disable cloud sync');
                        }
                    }
                }
            ]
        );
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const result = await syncToCloud();
            if (result.success) {
                const newSyncTime = await getLastSyncTime();
                setLastSyncTime(newSyncTime);

                // Show detailed sync results
                const details = [];
                if (result.uploaded > 0) details.push(`⬆️ Uploaded ${result.uploaded} new item${result.uploaded > 1 ? 's' : ''} to the cloud storage`);
                if (result.downloaded > 0) details.push(`⬇️ Downloaded ${result.downloaded} new item${result.downloaded > 1 ? 's' : ''} from the cloud storage`);
                if (result.updatedLocal > 0) details.push(`🔄 Updated ${result.updatedLocal} item${result.updatedLocal > 1 ? 's' : ''} on this device local storage`);
                if (result.updatedCloud > 0) details.push(`☁️ Updated ${result.updatedCloud} item${result.updatedCloud > 1 ? 's' : ''} in the cloud storage`);

                const message = details.length > 0
                    ? `Sync successful!\n\n${details.join('\n')}`
                    : 'Your vault is fully up to date! ✅\n\nNo changes were needed.';

                Alert.alert('Sync Complete', message);
            } else {
                Alert.alert('Error', result.error || 'Failed to sync');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to sync to cloud');
        } finally {
            setSyncing(false);
        }
    };



    const formatSyncTime = (isoString) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);

        // Format as YYYY-MM-DD HH:mm:ss (Local Time)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const handleViewMasterPassword = () => {
        if (!isMasterPasswordRequired()) {
            Alert.alert('Not Available', 'Master password is not available in the current encryption mode.');
            return;
        }
        setShowPinModal(true);
    };

    const handleVerifyPin = async () => {
        if (!pin || pin.length !== 4) {
            Alert.alert('Invalid PIN', 'Please enter a 4-digit PIN');
            return;
        }

        setIsLoading(true);
        try {
            const isValid = await verifyPIN(pin);

            if (isValid) {
                const result = await getMasterPassword();

                if (result.success) {
                    setMasterPassword(result.masterPassword);
                    setShowMasterPassword(true);
                    setShowPinModal(false);
                    setPin('');
                } else {
                    Alert.alert('Error', result.error || 'Failed to retrieve master password');
                    setPin('');
                }
            } else {
                Alert.alert('Error', 'Incorrect PIN');
                setPin('');
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyMasterPassword = async () => {
        await Clipboard.setStringAsync(masterPassword);
        Alert.alert('Copied! 📋', 'Master password copied to clipboard');
    };

    const handleCloseMasterPasswordModal = () => {
        setShowMasterPassword(false);
        setMasterPassword('');
    };

    const handleClosePinModal = () => {
        setShowPinModal(false);
        setPin('');
    };

    return (
        <ScrollView style={styles.container}>
            {/* Cloud Sync Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>☁️ Cloud Sync</Text>

                {!cloudSyncEnabled ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Backup to Cloud</Text>
                        <Text style={styles.cardDescription}>
                            Enable cloud sync to backup your passwords and access them across devices.
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleEnableCloudSync}
                        >
                            <Text style={styles.primaryButtonText}>Enable Cloud Sync</Text>
                        </TouchableOpacity>
                        <Text style={styles.hint}>
                            💡 Optional - app works offline without cloud sync
                        </Text>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <View style={styles.syncStatus}>
                            <Text style={styles.syncStatusLabel}>Status:</Text>
                            <Text style={styles.syncStatusValue}>✅ Enabled</Text>
                        </View>
                        <View style={styles.syncStatus}>
                            <Text style={styles.syncStatusLabel}>Account:</Text>
                            <Text style={styles.syncStatusValue}>{userEmail}</Text>
                        </View>
                        <View style={styles.syncStatus}>
                            <Text style={styles.syncStatusLabel}>Last Sync:</Text>
                            <Text style={styles.syncStatusValue}>{formatSyncTime(lastSyncTime)}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.secondaryButton, syncing && styles.buttonDisabled]}
                            onPress={handleSyncNow}
                            disabled={syncing}
                        >
                            {syncing ? (
                                <ActivityIndicator color="#007AFF" />
                            ) : (
                                <Text style={styles.secondaryButtonText}>🔄 Sync Now</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={handleDisableCloudSync}
                        >
                            <Text style={styles.dangerButtonText}>Sign Out</Text>
                        </TouchableOpacity>


                    </View>
                )}
            </View>

            {/* Master Password Section */}
            {isMasterPasswordRequired() && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔑 Master Password</Text>
                    <View style={styles.card}>
                        <Text style={styles.cardDescription}>
                            View your master password to set up the app on a new device.
                        </Text>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleViewMasterPassword}
                        >
                            <Text style={styles.secondaryButtonText}>👁️ View Master Password</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Security Note */}
            <View style={styles.securityNote}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={styles.securityText}>
                    Your passwords are encrypted with AES-256. Only you can decrypt them.
                </Text>
            </View>

            {/* PIN Verification Modal */}
            <Modal
                visible={showPinModal}
                transparent={true}
                animationType="fade"
                onRequestClose={handleClosePinModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter Your PIN</Text>
                        <Text style={styles.modalDescription}>
                            Verify your identity to view the master password
                        </Text>

                        <TextInput
                            style={styles.pinInput}
                            placeholder="Enter 4-digit PIN"
                            value={pin}
                            onChangeText={setPin}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                            autoFocus
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={handleClosePinModal}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.verifyButton]}
                                onPress={handleVerifyPin}
                                disabled={isLoading}
                            >
                                <Text style={styles.verifyButtonText}>
                                    {isLoading ? 'Verifying...' : 'Verify'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Master Password Display Modal */}
            <Modal
                visible={showMasterPassword}
                transparent={true}
                animationType="fade"
                onRequestClose={handleCloseMasterPasswordModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Your Master Password</Text>
                        <Text style={styles.modalWarning}>
                            ⚠️ Keep this safe! You'll need it to set up the app on a new device.
                        </Text>

                        <View style={styles.passwordDisplay}>
                            <Text style={styles.passwordText}>{masterPassword}</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.copyButton}
                            onPress={handleCopyMasterPassword}
                        >
                            <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={handleCloseMasterPasswordModal}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    section: {
        margin: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 12,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#6c757d',
        lineHeight: 20,
        marginBottom: 16,
    },
    syncStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    syncStatusLabel: {
        fontSize: 14,
        color: '#6c757d',
    },
    syncStatusValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#212529',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#007AFF',
        marginBottom: 8,
    },
    secondaryButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerButton: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dc3545',
        marginBottom: 8,
    },
    dangerButtonText: {
        color: '#dc3545',
        fontSize: 16,
        fontWeight: '600',
    },
    testButton: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#6c757d',
    },
    testButtonText: {
        color: '#6c757d',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    hint: {
        fontSize: 12,
        color: '#6c757d',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    securityNote: {
        backgroundColor: '#d3f9d8',
        margin: 16,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '85%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: 14,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    modalWarning: {
        fontSize: 13,
        color: '#856404',
        backgroundColor: '#fff3cd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 18,
    },
    pinInput: {
        borderWidth: 2,
        borderColor: '#007AFF',
        padding: 14,
        fontSize: 18,
        borderRadius: 10,
        backgroundColor: '#f8f9fa',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 8,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    cancelButtonText: {
        color: '#495057',
        fontSize: 16,
        fontWeight: '600',
    },
    verifyButton: {
        backgroundColor: '#007AFF',
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    passwordDisplay: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#007AFF',
        marginBottom: 16,
    },
    passwordText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212529',
        textAlign: 'center',
        letterSpacing: 1,
    },
    copyButton: {
        backgroundColor: '#28a745',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 12,
    },
    copyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        backgroundColor: '#6c757d',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
