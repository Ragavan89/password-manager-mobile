/**
 * AddCardScreen.js
 * 
 * Specialized screen for adding/editing Credit Cards.
 * Saves data to the unified 'passwords' table with type='card'.
 * 
 * Features:
 * - Card Number Formatting
 * - Visual Color Picker
 * - Secure Storage of CVV/PIN
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as HybridStorageService from '../services/HybridStorageService';
import { encryptPassword, decryptPassword } from '../services/Encryption';
import CustomAlert from '../components/CustomAlert';
import GradientButton from '../components/GradientButton';
import SuccessAnimation from '../components/SuccessAnimation';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from '../services/FirebaseAuthService';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { Colors } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';
import CreditCard from '../components/CreditCard';

export default function AddCardScreen({ navigation, route }) {
    const { responsiveFontSize, width } = useResponsiveDimensions();
    const itemToEdit = route.params?.item;
    const isEditMode = !!itemToEdit;

    // Form State
    const [bankName, setBankName] = useState(''); // data.siteName
    const [holderName, setHolderName] = useState(''); // data.username
    const [cardNumber, setCardNumber] = useState(''); // Inside encrypted JSON
    const [expiry, setExpiry] = useState(''); // Inside encrypted JSON
    const [cvv, setCVV] = useState(''); // Inside encrypted JSON
    const [pin, setPin] = useState(''); // Inside encrypted JSON
    const [zip, setZip] = useState(''); // Inside encrypted JSON
    const [comments, setComments] = useState(''); // data.comments

    // Visual State
    const [cardType, setCardType] = useState('visa'); // meta.cardType
    const [cardColor, setCardColor] = useState('blue'); // meta.colorTheme

    const [loading, setLoading] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
    const [showCVV, setShowCVV] = useState(false);
    const [showPIN, setShowPIN] = useState(false);

    // Constants for colors
    const CARD_THEMES = {
        blue: { c1: '#4c6ef5', c2: '#15aabf' },
        gold: { c1: '#fcc419', c2: '#ff6b6b' },
        black: { c1: '#343a40', c2: '#868e96' },
        purple: { c1: '#845ef7', c2: '#be4bdb' },
    };

    const CARD_NETWORKS = ['visa', 'mastercard', 'amex', 'discover', 'generic'];

    useEffect(() => {
        if (isEditMode) {
            setBankName(itemToEdit.siteName);
            setHolderName(itemToEdit.username);
            setComments(itemToEdit.comments || '');

            // Decrypt and Parse JSON
            decryptPassword(itemToEdit.encryptedPassword).then(decrypted => {
                try {
                    const data = JSON.parse(decrypted);
                    setCardNumber(data.number || '');
                    setExpiry(data.expiry || '');
                    setCVV(data.cvv || '');
                    setPin(data.pin || '');
                    setZip(data.zip || '');
                } catch (e) {
                    console.error("Failed to parse card data", e);
                }
            });

            // Parse Meta
            try {
                const meta = JSON.parse(itemToEdit.meta || '{}');
                if (meta.cardType) setCardType(meta.cardType);
                if (meta.colorTheme) setCardColor(meta.colorTheme);
            } catch (e) { }

            navigation.setOptions({ title: 'Edit Card' });
        }
    }, [isEditMode, itemToEdit, navigation]);

    // Formatters
    const handleCardNumberChange = (text) => {
        // Remove spaces and non-digits
        const cleaned = text.replace(/[^0-9]/g, '');
        // Add spaces every 4 digits
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        setCardNumber(formatted);

        // Auto-detect type only if user hasn't manually selected (implied) or just update it as a suggestion
        // Actually, let's keep auto-detect as a convenience but user can override below
        if (cleaned.startsWith('4')) setCardType('visa');
        else if (cleaned.startsWith('5')) setCardType('mastercard');
        else if (cleaned.startsWith('3')) setCardType('amex');
        else if (cleaned.startsWith('6')) setCardType('discover');
    };

    const handleExpiryChange = (text) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length >= 2) {
            setExpiry(cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4));
        } else {
            setExpiry(cleaned);
        }
    };

    const handleSave = async () => {
        if (!bankName || !holderName || !cardNumber) {
            setAlertConfig({
                visible: true,
                title: 'Missing Information',
                message: 'Please fill in Bank Name, Cardholder Name, and Card Number.',
                type: 'warning',
                buttons: [{ text: 'OK' }]
            });
            return;
        }

        setLoading(true);
        try {
            // 1. Prepare Sensitive Payload
            const securePayload = {
                number: cardNumber,
                expiry,
                cvv,
                pin,
                zip
            };
            const encryptedBlob = await encryptPassword(JSON.stringify(securePayload));

            // 2. Prepare Meta Payload
            const last4 = cardNumber.replace(/[^0-9]/g, '').slice(-4);
            const metaPayload = {
                cardType,
                colorTheme: cardColor,
                color1: CARD_THEMES[cardColor].c1,
                color2: CARD_THEMES[cardColor].c2,
                last4
            };

            const dataToSave = {
                siteName: bankName,
                username: holderName,
                encryptedPassword: encryptedBlob,
                comments,
                type: 'card',
                meta: JSON.stringify(metaPayload)
            };

            // 3. Save via Service
            let result;
            if (isEditMode) {
                result = await HybridStorageService.updatePassword(itemToEdit.id, dataToSave);
            } else {
                result = await HybridStorageService.savePassword(dataToSave);
            }

            // 4. Handle Result
            if (isEditMode) {
                // EDIT MODE - Card Updated
                if (result.synced) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setAlertConfig({
                        visible: true,
                        title: 'Card Updated!',
                        message: 'Your card has been updated and synced to the cloud.',
                        type: 'success',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
                    });
                } else if (result.isOffline) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Check if cloud sync is enabled
                    const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
                    const user = getCurrentUser();
                    const isCloudSyncActive = cloudSyncEnabled === 'true' && user !== null;

                    setAlertConfig({
                        visible: true,
                        title: 'Updated Locally',
                        message: isCloudSyncActive
                            ? 'Your card has been updated on this device.\n\nIt is currently stored locally since the device doesn\'t have internet access. It will be synced when connection is available.'
                            : 'Your card has been updated on this device.\n\nIt is stored offline only and will not be synced to the cloud. To enable cloud sync, please go to settings and sign in.',
                        type: 'info',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                } else if (result.limitReached) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setAlertConfig({
                        visible: true,
                        title: 'Updated Locally Only',
                        message: 'Your card has been updated securely on this device.\n\nHowever, it could not be synced to the cloud because you have reached your storage limit.\n\nTo enable cloud sync, please delete some passwords or cards.',
                        type: 'warning',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Check if cloud sync is enabled
                    const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
                    const user = getCurrentUser();
                    const isCloudSyncActive = cloudSyncEnabled === 'true' && user !== null;

                    setAlertConfig({
                        visible: true,
                        title: 'Updated Locally',
                        message: isCloudSyncActive
                            ? 'Your card has been updated on this device.\n\nIt is currently stored offline and will be synced when connection is available.'
                            : 'Your card has been updated on this device.\n\nIt is stored offline only and will not be synced to the cloud. To enable cloud sync, please go to settings and sign in.',
                        type: 'info',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                }
            } else {
                // CREATE MODE - New Card Saved
                if (result.isOffline) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Check if cloud sync is enabled
                    const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
                    const user = getCurrentUser();
                    const isCloudSyncActive = cloudSyncEnabled === 'true' && user !== null;

                    setAlertConfig({
                        visible: true,
                        title: 'Saved Locally',
                        message: isCloudSyncActive
                            ? 'Your card has been saved securely on this device.\n\nIt is currently stored locally since the device doesn\'t have internet access. It will be synced when connection is available.'
                            : 'Your card has been saved securely on this device.\n\nIt is stored offline only and will not be synced to the cloud. To enable cloud sync, please go to settings and sign in.',
                        type: 'info',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                } else if (result.limitReached || result.warning) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setAlertConfig({
                        visible: true,
                        title: 'Saved Locally Only',
                        message: 'Your card has been saved securely on this device.\n\nHowever, it could not be synced to the cloud because you have reached your storage limit.\n\nTo enable cloud sync, please delete some passwords or cards.',
                        type: 'warning',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                } else if (result.synced) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setAlertConfig({
                        visible: true,
                        title: 'Card Saved!',
                        message: 'Your card has been saved securely on this device and synced to the cloud.',
                        type: 'success',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }]
                    });
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Check if cloud sync is enabled
                    const cloudSyncEnabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
                    const user = getCurrentUser();
                    const isCloudSyncActive = cloudSyncEnabled === 'true' && user !== null;

                    setAlertConfig({
                        visible: true,
                        title: 'Saved Locally',
                        message: isCloudSyncActive
                            ? 'Your card has been saved securely on this device.\n\nIt is currently stored offline and will be synced when connection is available.'
                            : 'Your card has been saved securely on this device.\n\nIt is stored offline only and will not be synced to the cloud. To enable cloud sync, please go to settings and sign in.',
                        type: 'info',
                        buttons: [{ text: 'OK', style: 'default', onPress: () => navigation.goBack() }],
                        textAlign: 'left'
                    });
                }
            }

        } catch (error) {
            setAlertConfig({
                visible: true,
                title: 'Save Failed',
                message: error.message,
                type: 'error',
                buttons: [{ text: 'OK' }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        setAlertConfig({
            visible: true,
            title: 'Delete Card',
            message: `Are you sure you want to delete "${bankName}"? This action cannot be undone.`,
            type: 'warning',
            buttons: [
                { text: 'Cancel' },
                {
                    text: 'Delete',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await HybridStorageService.deletePassword(itemToEdit.id);
                            if (result.success) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                navigation.goBack();
                            } else {
                                throw new Error('Delete failed');
                            }
                        } catch (error) {
                            setAlertConfig({
                                visible: true,
                                title: 'Delete Failed',
                                message: error.message,
                                type: 'error',
                                buttons: [{ text: 'OK' }]
                            });
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Live Preview */}
                    <View style={styles.previewContainer}>
                        <CreditCard
                            type={cardType}
                            bankName={bankName || 'Bank Name'}
                            holderName={holderName || 'CARDHOLDER'}
                            last4={cardNumber.slice(-4) || '••••'}
                            color1={CARD_THEMES[cardColor].c1}
                            color2={CARD_THEMES[cardColor].c2}
                        />
                    </View>

                    {/* Color Picker */}
                    <View style={styles.colorPicker}>
                        {Object.keys(CARD_THEMES).map(color => (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorOption,
                                    { backgroundColor: CARD_THEMES[color].c1 },
                                    cardColor === color && styles.selectedColor
                                ]}
                                onPress={() => setCardColor(color)}
                            />
                        ))}
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>BANK NAME</Text>
                            <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. Chase" placeholderTextColor={Colors.text.tertiary} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>CARDHOLDER NAME</Text>
                            <TextInput style={styles.input} value={holderName} onChangeText={setHolderName} placeholder="Name on card" placeholderTextColor={Colors.text.tertiary} />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>CARD NUMBER</Text>
                            <TextInput
                                style={styles.input}
                                value={cardNumber}
                                onChangeText={handleCardNumberChange}
                                keyboardType="numeric"
                                placeholder="0000 0000 0000 0000"
                                placeholderTextColor={Colors.text.tertiary}
                                maxLength={19}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>CARD NETWORK</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.networkParams}>
                                {CARD_NETWORKS.map(network => (
                                    <TouchableOpacity
                                        key={network}
                                        style={[
                                            styles.networkChip,
                                            cardType === network && styles.selectedNetworkChip
                                        ]}
                                        onPress={() => setCardType(network)}
                                    >
                                        <Text style={[
                                            styles.networkText,
                                            cardType === network && styles.selectedNetworkText
                                        ]}>
                                            {network.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>EXPIRY</Text>
                                <TextInput style={styles.input} value={expiry} onChangeText={handleExpiryChange} placeholder="MM/YY" placeholderTextColor={Colors.text.tertiary} maxLength={5} keyboardType="numeric" />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>CVV</Text>
                                <View style={styles.rowInput}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, paddingRight: 40 }]}
                                        value={cvv}
                                        onChangeText={setCVV}
                                        placeholder="123"
                                        placeholderTextColor={Colors.text.tertiary}
                                        maxLength={4}
                                        keyboardType="numeric"
                                        secureTextEntry={!showCVV}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowCVV(!showCVV)}
                                    >
                                        <Ionicons name={showCVV ? 'eye-off' : 'eye'} size={20} color="#999" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>PIN (OPTIONAL)</Text>
                                <View style={styles.rowInput}>
                                    <TextInput
                                        style={[styles.input, { flex: 1, paddingRight: 40 }]}
                                        value={pin}
                                        onChangeText={setPin}
                                        placeholder="****"
                                        placeholderTextColor={Colors.text.tertiary}
                                        keyboardType="numeric"
                                        secureTextEntry={!showPIN}
                                    />
                                    <TouchableOpacity
                                        style={styles.eyeIcon}
                                        onPress={() => setShowPIN(!showPIN)}
                                    >
                                        <Ionicons name={showPIN ? 'eye-off' : 'eye'} size={20} color="#999" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>ZIP CODE (OPTIONAL)</Text>
                                <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="Zip" placeholderTextColor={Colors.text.tertiary} keyboardType="numeric" />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>NOTES / COMMENTS (OPTIONAL)</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={comments}
                                onChangeText={setComments}
                                placeholder="E.g. Use for online shopping only"
                                placeholderTextColor={Colors.text.tertiary}
                                multiline
                            />
                        </View>
                    </View>

                    <View style={styles.buttonRow}>
                        <GradientButton
                            onPress={handleSave}
                            loading={loading}
                            style={isEditMode ? styles.saveButtonHalf : styles.saveButtonFull}
                        >
                            {isEditMode ? 'Update Card' : 'Save Card'}
                        </GradientButton>

                        {isEditMode && (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={handleDelete}
                                disabled={loading}
                            >
                                <Text style={styles.deleteButtonText}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            <SuccessAnimation
                visible={showSuccessAnimation}
                onComplete={() => { setShowSuccessAnimation(false); navigation.goBack(); }}
            />

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
    container: { flex: 1, backgroundColor: Colors.neutral.white },
    content: { padding: 20 },
    previewContainer: { alignItems: 'center', marginBottom: 20 },
    colorPicker: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    colorOption: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 8, borderWidth: 1, borderColor: '#fff' },
    selectedColor: { borderWidth: 2, borderColor: '#000', transform: [{ scale: 1.2 }] },
    form: { marginBottom: 20 },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 10, fontWeight: 'bold', color: Colors.text.secondary, marginBottom: 5, letterSpacing: 1 },
    input: { backgroundColor: Colors.neutral.gray100, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#eee', color: Colors.text.primary },
    row: { flexDirection: 'row' },
    rowInput: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
    eyeIcon: { position: 'absolute', right: 10, padding: 5 },
    cardTypeIcon: { position: 'absolute', right: 10 },
    networkParams: { flexDirection: 'row', paddingVertical: 5 },
    networkChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: Colors.neutral.gray200, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
    selectedNetworkChip: { backgroundColor: '#4c6ef5', borderColor: '#4c6ef5' },
    networkText: { fontSize: 10, fontWeight: '600', color: Colors.text.secondary },
    selectedNetworkText: { color: '#fff' },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'stretch'
    },
    saveButtonFull: {
        flex: 1
    },
    saveButtonHalf: {
        flex: 1
    },
    deleteButton: {
        flex: 1,
        paddingVertical: 16,
        minHeight: 56,
        borderRadius: 12,
        backgroundColor: '#ffebee',
        borderWidth: 1.5,
        borderColor: '#ff6b6b',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteButtonText: {
        color: '#ff6b6b',
        fontSize: 16,
        fontWeight: '600'
    }
});
