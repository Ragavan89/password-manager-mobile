/**
 * SettingsScreen.js
 * 
 * App settings and cloud sync management screen.
 * 
 * Features:
 * - Cloud sync enable/disable and status display
 * - Sync now button with progress feedback
 * - Subscription tier display
 * - View master password (PIN protected)
 * - Sign out from cloud sync
 * 
 * Uses: HybridStorageService (sync), FirebaseAuthService (auth), Encryption (PIN verify)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity, Modal, ActivityIndicator, TextInput, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { verifyPIN, getMasterPassword, clearEncryptionKeyCache } from '../services/Encryption';
import { clearUserSaltCache, preserveCurrentSaltForOffline } from '../services/UserSaltService';
import { isMasterPasswordRequired } from '../config/EncryptionConfig';
import { getCurrentUser, signOut } from '../services/FirebaseAuthService';
import { syncToCloud, getLastSyncTime, getCloudPasswordLimit, getSubscriptionTierLimits } from '../services/HybridStorageService';
import * as FirestoreService from '../services/FirestoreService';
import { AppConfig } from '../config/AppConfig';
import { firestore } from '../../firebase.config';
import CustomAlert from '../components/CustomAlert';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { Colors, Shadows } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

export default function SettingsScreen({ navigation }) {
    // Responsive dimensions hook
    const { isTablet } = useResponsiveDimensions();
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [cloudLimit, setCloudLimit] = useState(AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT);
    const [subscriptionTier, setSubscriptionTier] = useState('free');
    const [tierLimits, setTierLimits] = useState({ free: 25, tier1: 75, tier2: 150 });
    const [isLoadingSyncStatus, setIsLoadingSyncStatus] = useState(true);

    // View Master Password states
    const [showPinModal, setShowPinModal] = useState(false);
    const [pin, setPin] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [showMasterPassword, setShowMasterPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Custom Alert state
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: [],
        textAlign: 'center'
    });

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
            setIsLoadingSyncStatus(true);
            const enabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
            const email = await SecureStore.getItemAsync('FIREBASE_USER_EMAIL');
            const lastSync = await getLastSyncTime();

            // Verify user is actually authenticated (not just flag set)
            const user = getCurrentUser();
            const isActuallyEnabled = enabled === 'true' && user !== null;

            // Get subscription tier if user is authenticated
            let tier = 'free';
            if (isActuallyEnabled && user) {
                try {
                    const tierResult = await FirestoreService.getUserSubscriptionTier(user.uid);
                    if (tierResult.success) {
                        tier = tierResult.tier || 'free';
                    }
                } catch (tierError) {
                    console.error('Error fetching subscription tier:', tierError);
                    // Try to get from cache
                    const cachedTier = await SecureStore.getItemAsync('USER_SUBSCRIPTION_TIER');
                    if (cachedTier) {
                        tier = cachedTier;
                    }
                }
            }

            // Get cloud limit (this will use tier if subscription tiers are enabled)
            let limit;
            try {
                limit = await getCloudPasswordLimit();
            } catch (limitError) {
                // If limit fetch fails, try cached value
                const cachedLimit = await SecureStore.getItemAsync('CLOUD_PASSWORD_LIMIT');
                limit = cachedLimit ? parseInt(cachedLimit, 10) : AppConfig.DEFAULT_CLOUD_PASSWORD_LIMIT;
            }

            // Get tier limits for UI display (only if cloud sync is enabled)
            let limits = { free: 25, tier1: 75, tier2: 150 }; // Default fallback
            if (isActuallyEnabled) {
                try {
                    const tierLimitsResult = await getSubscriptionTierLimits();
                    if (tierLimitsResult.success && tierLimitsResult.tiers) {
                        limits = tierLimitsResult.tiers;
                        console.log('✅ Tier limits loaded:', limits);
                    } else {
                        console.log('⚠️ Failed to load tier limits, using defaults');
                    }
                } catch (tierLimitsError) {
                    console.error('Error fetching tier limits:', tierLimitsError);
                }
            }

            setCloudSyncEnabled(isActuallyEnabled);
            setUserEmail(email || '');
            setLastSyncTime(lastSync);
            setCloudLimit(limit);
            setSubscriptionTier(tier);
            setTierLimits(limits);
        } catch (error) {
            console.error('Error loading cloud sync status:', error);
            // On error, verify user status synchronously as fallback
            const user = getCurrentUser();
            setCloudSyncEnabled(user !== null);
        } finally {
            setIsLoadingSyncStatus(false);
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
                            // CRITICAL: Get userId BEFORE signing out
                            const user = getCurrentUser();
                            const userId = user?.uid;

                            // Clear encryption state BEFORE signing out to prevent stale cached keys
                            // This fixes the bug where cloud passwords can't be decrypted after logout/login cycle
                            if (userId) {
                                await clearUserSaltCache(userId);
                            }
                            await clearEncryptionKeyCache();

                            await signOut();
                            await SecureStore.deleteItemAsync('CLOUD_SYNC_ENABLED');
                            await SecureStore.deleteItemAsync('FIREBASE_USER_EMAIL');
                            await SecureStore.deleteItemAsync('LAST_SYNC_TIME');
                            setCloudSyncEnabled(false);
                            setUserEmail('');
                            setLastSyncTime(null);
                            Alert.alert('Success', 'Cloud sync disabled');
                        } catch (error) {
                            console.error('Error disabling cloud sync:', error);
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
                // Suppress local/cloud update counts to keep UI simple
                // if (result.updatedLocal > 0) details.push(`🔄 Updated ${result.updatedLocal} item${result.updatedLocal > 1 ? 's' : ''} on this device local storage`);
                // if (result.updatedCloud > 0) details.push(`☁️ Updated ${result.updatedCloud} item${result.updatedCloud > 1 ? 's' : ''} in the cloud storage`);

                const message = details.length > 0
                    ? `Sync successful!\n\n${details.join('\n')}`
                    : 'Your vault is fully up to date! ✅\n\nNo changes were needed.';

                setAlertConfig({
                    visible: true,
                    title: 'Sync Complete',
                    message: message,
                    type: 'success',
                    buttons: [{ text: 'OK', style: 'default' }],
                    textAlign: details.length > 0 ? 'left' : 'center'
                });
            } else if (result.error === 'LIMIT_REACHED') {
                const { current, pending, limit, exceeded } = result.limitDetails;

                const LimitMessage = (
                    <View>
                        <Text style={{ fontSize: 15, color: '#495057', marginBottom: 12, textAlign: 'center' }}>
                            Your cloud storage is full (<Text style={{ fontWeight: 'bold', color: '#e03131' }}>{current}/{limit}</Text> passwords).
                        </Text>
                        <Text style={{ fontSize: 15, color: '#495057', marginBottom: 20, textAlign: 'center' }}>
                            Sync is paused for <Text style={{ fontWeight: 'bold' }}>{pending}</Text> new passwords.
                        </Text>

                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#212529', marginBottom: 8 }}>
                            To resume syncing:
                        </Text>
                        <View style={{ paddingLeft: 8 }}>
                            <Text style={{ fontSize: 15, color: '#495057', marginBottom: 6 }}>
                                • Delete <Text style={{ fontWeight: 'bold' }}>{exceeded}</Text> password{exceeded > 1 ? 's' : ''} from local storage
                            </Text>
                            <Text style={{ fontSize: 15, color: '#495057' }}>
                                {/* • Or upgrade to a higher plan */}
                            </Text>
                        </View>
                    </View>
                );

                setAlertConfig({
                    visible: true,
                    title: 'Storage Limit Reached',
                    message: LimitMessage,
                    type: 'error',
                    buttons: [{ text: 'OK', style: 'default' }],
                    textAlign: 'left'
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Sync Failed',
                    message: result.error || 'Failed to sync. Please check your internet connection and try again.',
                    type: 'error',
                    buttons: [{ text: 'OK', style: 'default' }],
                    textAlign: result.error && result.error.includes('\n') ? 'left' : 'center'
                });
            }
        } catch (error) {
            setAlertConfig({
                visible: true,
                title: 'Sync Error',
                message: 'Failed to sync to cloud. Please check your internet connection and try again.',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }]
            });
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
        <View style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
            >
                {/* Cloud Sync Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>☁️ Cloud Sync</Text>

                    {isLoadingSyncStatus ? (
                        <View style={styles.card}>
                            <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 20 }} />
                            <Text style={[styles.cardDescription, { textAlign: 'center' }]}>Loading sync status...</Text>
                        </View>
                    ) : !cloudSyncEnabled ? (
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
                            <View style={styles.syncStatus}>
                                <Text style={styles.syncStatusLabel}>Subscription:</Text>
                                <Text style={[styles.syncStatusValue, styles.subscriptionTier]}>
                                    {subscriptionTier === 'tier2' ? `⭐ Tier 2 (${tierLimits.tier2} passwords)` :
                                        subscriptionTier === 'tier1' ? `⭐ Tier 1 (${tierLimits.tier1} passwords)` :
                                            `🆓 Free (${tierLimits.free} passwords)`}
                                </Text>
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

                            {/* Delete Account Button */}
                            <TouchableOpacity
                                style={[styles.dangerButton, { marginTop: 10, borderColor: '#fa5252', backgroundColor: '#fff5f5' }]}
                                onPress={() => {
                                    Alert.alert(
                                        'Delete Account',
                                        'Unknown Warning: This will permanently delete your account and all data stored in the cloud. This action cannot be undone.\n\nYour local data on this device will generally be preserved, but cloud backups will be gone.',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete Permanently',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        const user = getCurrentUser();
                                                        if (!user) {
                                                            Alert.alert('Error', 'No user logged in');
                                                            return;
                                                        }

                                                        setIsLoading(true);

                                                        // 1. Preserve Salt for Local Data Access (IMPORTANT)
                                                        // Ensures that after account deletion, the local app can still decrypt data
                                                        // using the salt that was previously synced from cloud.
                                                        await preserveCurrentSaltForOffline(user.uid);

                                                        // 2. Delete Firestore Data
                                                        await FirestoreService.deleteAllUserData(user.uid);

                                                        // 3. Mark all local data as 'Unsynced' (Yellow Status)
                                                        const Database = require('../services/Database');
                                                        Database.markAllAsUnsynced();

                                                        // 4. Clear Local Cloud Cache (But we just preserved the salt above!)
                                                        await clearUserSaltCache(user.uid);
                                                        await clearEncryptionKeyCache();
                                                        await SecureStore.deleteItemAsync('CLOUD_SYNC_ENABLED');
                                                        await SecureStore.deleteItemAsync('FIREBASE_USER_EMAIL');
                                                        await SecureStore.deleteItemAsync('LAST_SYNC_TIME');

                                                        // 5. Delete Auth Account
                                                        const { deleteUserAccount } = require('../services/FirebaseAuthService');
                                                        const result = await deleteUserAccount();

                                                        if (result.success) {
                                                            // Reset State
                                                            setCloudSyncEnabled(false);
                                                            setUserEmail('');
                                                            setLastSyncTime(null);
                                                            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                                                        } else if (result.error === 'REQUIRES_RECENT_LOGIN') {
                                                            Alert.alert('Security Check', 'For security, please sign out and sign in again before deleting your account.');
                                                        } else {
                                                            Alert.alert('Error', 'Failed to delete account: ' + result.error);
                                                        }
                                                    } catch (error) {
                                                        console.error('Delete account error:', error);
                                                        Alert.alert('Error', 'An unexpected error occurred.');
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Text style={[styles.dangerButtonText, { color: '#c92a2a' }]}>Delete Account</Text>
                            </TouchableOpacity>

                            <View style={styles.limitInfoContainer}>
                                <Text style={styles.limitInfoIcon}>ℹ️</Text>
                                <Text style={styles.limitInfoText}>
                                    {subscriptionTier === 'free'
                                        ? `You can store up to ${tierLimits.free} passwords with the free tier.`
                                        : subscriptionTier === 'tier1'
                                            ? `You can store up to ${tierLimits.tier1} passwords with Tier 1.`
                                            : `You can store up to ${tierLimits.tier2} passwords with Tier 2.`
                                    }
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Master Password Section */}
                {
                    isMasterPasswordRequired() && (
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
                    )
                }

                {/* Legal Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚖️ Legal</Text>
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => Linking.openURL('https://sites.google.com/view/privacypolicyforkeyvault/home')}
                        >
                            <Text style={styles.secondaryButtonText}>📄 Privacy Policy</Text>
                        </TouchableOpacity>
                        <Text style={[styles.hint, { marginTop: 10 }]}>Version 1.0.0</Text>
                    </View>
                </View>

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
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalOverlay}
                    >
                        <View style={styles.modalContent}>
                            <View style={{ alignItems: 'center', marginBottom: 16 }}>
                                <Ionicons name="lock-closed" size={48} color={Colors.primary.solid} />
                            </View>
                            <Text style={styles.modalTitle}>Enter Your PIN</Text>
                            <Text style={styles.modalDescription}>
                                Verify your identity to view the master password
                            </Text>

                            <TextInput
                                style={styles.pinInput}
                                placeholder="Enter 4-digit PIN"
                                placeholderTextColor="#999"
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
                    </KeyboardAvoidingView>
                </Modal>

                {/* Master Password Display Modal */}
                <Modal
                    visible={showMasterPassword}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseMasterPasswordModal}
                >
                    <View style={styles.modalOverlay}>
                        <View
                            style={[
                                styles.modalContent,
                                {
                                    width: isTablet ? '70%' : '85%',
                                    maxWidth: isTablet ? 600 : 400,
                                    minWidth: 300,
                                }
                            ]}
                        >
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

                {/* Custom Alert for Sync Messages */}
                <CustomAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    buttons={alertConfig.buttons}
                    textAlign={alertConfig.textAlign}
                    onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background.light,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.background.light,
    },
    scrollContent: {
        paddingBottom: Platform.OS === 'android' ? 24 : 16,
    },
    section: {
        margin: 16,
    },
    sectionTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 12,
    },
    card: {
        backgroundColor: Colors.neutral.white,
        padding: 20,
        borderRadius: 12,
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.border.light,
    },
    cardTitle: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: FontSizes.small,
        color: Colors.text.secondary,
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
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold,
        color: Colors.text.primary,
    },
    primaryButton: {
        backgroundColor: Colors.primary.solid,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 8,
        ...Shadows.small,
    },
    primaryButtonText: {
        color: Colors.neutral.white,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.bold,
    },
    secondaryButton: {
        backgroundColor: '#f0f8ff',  // Very light sky blue (Alice Blue)
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.primary.solid,
        marginBottom: 8,
        ...Shadows.small,
    },
    secondaryButtonText: {
        color: Colors.primary.solid,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
    },
    dangerButton: {
        backgroundColor: Colors.danger.light,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.danger.solid,
        marginBottom: 8,
        ...Shadows.small,
    },
    dangerButtonText: {
        color: Colors.danger.solid,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.bold,
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
        backgroundColor: Colors.neutral.white,
        borderRadius: 16,
        padding: 24,
        ...Shadows.large,
        borderWidth: 1,
        borderColor: Colors.border.light,
    },
    modalTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: FontSizes.small,
        color: Colors.text.secondary,
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
        borderColor: Colors.primary.solid,
        padding: 14,
        fontSize: FontSizes.large,
        borderRadius: 10,
        backgroundColor: Colors.neutral.gray50,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 8,
        color: Colors.text.primary,
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
        backgroundColor: Colors.neutral.gray100,
        borderWidth: 1,
        borderColor: Colors.border.medium,
    },
    cancelButtonText: {
        color: Colors.text.secondary,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
    },
    verifyButton: {
        backgroundColor: Colors.primary.solid,
        ...Shadows.small,
    },
    verifyButtonText: {
        color: Colors.neutral.white,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.bold,
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
    limitInfoContainer: {
        flexDirection: 'row',
        backgroundColor: '#e7f5ff',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        alignItems: 'flex-start',
    },
    limitInfoIcon: {
        fontSize: 18,
        marginRight: 10,
        marginTop: 2,
    },
    subscriptionTier: {
        fontWeight: 'bold',
        color: '#007AFF',
    },
    limitInfoText: {
        flex: 1,
        fontSize: 13,
        color: '#1971c2',
        lineHeight: 18,
    },
});
