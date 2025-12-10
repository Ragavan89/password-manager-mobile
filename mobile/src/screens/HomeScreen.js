/**
 * HomeScreen.js
 * 
 * Main dashboard screen displaying all saved passwords.
 * 
 * Features:
 * - Password list with expand/collapse cards
 * - Search by site name, username, or comments
 * - Copy username/password to clipboard
 * - Edit and delete passwords
 * - Cloud sync status indicators
 * - Data loss warning banner (when cloud sync disabled)
 * 
 * Uses: HybridStorageService (data), Encryption (decrypt passwords)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Animated, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as HybridStorageService from '../services/HybridStorageService';
import { decryptPassword } from '../services/Encryption';
import * as Clipboard from 'expo-clipboard';
import { getCurrentUser, onAuthChange } from '../services/FirebaseAuthService';
import * as SecureStore from 'expo-secure-store';
import { useResponsiveDimensions, useFontSizes } from '../utils/DimensionsHelper';
import { Colors } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

export default function HomeScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    // Responsive dimensions hook
    const { responsiveFontSize, isTablet } = useResponsiveDimensions();
    const fontSizes = useFontSizes();
    const [passwords, setPasswords] = useState([]);
    const [filteredPasswords, setFilteredPasswords] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPassword, setShowPassword] = useState({});
    const [expandedCards, setExpandedCards] = useState({});
    const [decryptedPasswords, setDecryptedPasswords] = useState({});
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(null); // null = not determined yet
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [lastLoginTime, setLastLoginTime] = useState(null);
    const [isAuthStateReady, setIsAuthStateReady] = useState(false);

    // Listen to auth state changes to update sync status
    useEffect(() => {
        let hasInitialized = false;

        // Set up auth state listener to handle auth state restoration
        // This fires immediately with current auth state, then on any changes
        const unsubscribe = onAuthChange((user) => {
            // Auth state is now ready (either user or null)
            if (!hasInitialized) {
                hasInitialized = true;
                setIsAuthStateReady(true);
                // Load sync status now that auth state is determined
                loadCloudSyncStatus();
            } else {
                // Auth state changed after initial load - reload sync status
                loadCloudSyncStatus();
            }
        });

        // Cleanup listener on unmount
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Load passwords without triggering sync on focus (to avoid delays)
            loadPasswords({ silent: false, skipSync: true });
            loadLastLoginTime();
            // Only reload sync status if auth state is ready
            if (isAuthStateReady) {
                loadCloudSyncStatus();
            }
        }, [isAuthStateReady])
    );

    const loadLastLoginTime = async () => {
        try {
            const timestamp = await SecureStore.getItemAsync('LAST_LOGIN_TIMESTAMP');
            setLastLoginTime(timestamp);
        } catch (error) {
            console.error('Error loading last login time:', error);
        }
    };

    const loadCloudSyncStatus = async () => {
        try {
            const enabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
            const lastSync = await HybridStorageService.getLastSyncTime();

            // Verify user is actually authenticated (not just flag set)
            // This prevents the banner from flashing when user logs in
            const user = getCurrentUser();
            const isActuallyEnabled = enabled === 'true' && user !== null;

            setCloudSyncEnabled(isActuallyEnabled);
            setLastSyncTime(lastSync);
        } catch (error) {
            console.error('Error loading cloud sync status:', error);
        }
    };


    // Add Settings and Logout Buttons to Header
    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 5 }}>
                    {/* Add New Button - Icon Only */}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('AddPassword')}
                        style={{
                            marginHorizontal: 6,
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#d3f9d8',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>➕</Text>
                    </TouchableOpacity>

                    {/* Settings Button - Icon Only */}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Settings')}
                        style={{
                            marginHorizontal: 6,
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#fff3bf',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>⚙️</Text>
                    </TouchableOpacity>

                    {/* Logout Button - Icon Only */}
                    <TouchableOpacity
                        onPress={() => navigation.replace('Login')}
                        style={{
                            marginHorizontal: 6,
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#ffe3e3',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>🔓</Text>
                    </TouchableOpacity>
                </View>
            ),
            headerStyle: {
                backgroundColor: '#f8f9fa',
                elevation: 0, // Remove shadow on Android
                shadowOpacity: 0, // Remove shadow on iOS
                borderBottomWidth: 1,
                borderBottomColor: '#e9ecef'
            },
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 20,
                color: '#343a40'
            }
        });
    }, [navigation, cloudSyncEnabled]);

    const loadPasswords = async (options = { silent: false, skipSync: false }) => {
        // OPTIMIZATION: Never show loading spinner - always load instantly
        try {
            // OPTIMIZATION: Load local data FIRST (instant display)
            const data = await HybridStorageService.getPasswords();
            // Sort by site name ascending
            const sortedData = [...data].sort((a, b) =>
                a.siteName.localeCompare(b.siteName, undefined, { sensitivity: 'base' })
            );
            setPasswords(sortedData);

            // OPTIMIZATION: Lazy decryption - only decrypt when needed (when card is expanded)
            // Initialize with empty decrypted passwords - will decrypt on-demand
            const decrypted = {};
            setDecryptedPasswords(decrypted);

            // Data is now visible - no loading indicator needed

            // OPTIMIZATION: Sync in background AFTER showing local data
            let isSyncEnabled = false;
            if (!options.skipSync) {
                try {
                    const enabled = await SecureStore.getItemAsync('CLOUD_SYNC_ENABLED');
                    isSyncEnabled = enabled === 'true' && getCurrentUser() !== null;
                } catch (error) {
                    console.error('Error checking sync status:', error);
                }
            }

            // OPTIMIZATION: Trigger completely silent background sync (no visual indicators)
            if (!options.skipSync && isSyncEnabled) {
                // Don't set syncing state - keep it completely invisible
                // Don't await - let it run in background silently
                HybridStorageService.syncToCloud()
                    .then((syncResult) => {
                        if (syncResult && syncResult.success) {
                            console.log('✅ Silent background sync completed');
                            // Silently reload passwords to show any new data from cloud
                            loadPasswords({ silent: true, skipSync: true }).catch(err =>
                                console.error('Error reloading after sync:', err)
                            );
                        } else if (syncResult && syncResult.error) {
                            console.warn('⚠️ Background sync had issues:', syncResult.error);
                        }
                        // Update last sync time silently
                        HybridStorageService.getLastSyncTime().then(lastSync => {
                            setLastSyncTime(lastSync);
                        }).catch(err => console.error('Error getting last sync time:', err));
                    })
                    .catch((syncError) => {
                        console.error('❌ Background sync error:', syncError);
                    });
                // No finally block - don't update syncing state
            } else if (!options.skipSync) {
                // Update last sync time even if sync is disabled
                const lastSync = await HybridStorageService.getLastSyncTime();
                setLastSyncTime(lastSync);
            }
        } catch (error) {
            console.error('Error loading passwords:', error);
        }
    };

    const handleRefresh = async () => {
        // Explicitly trigger sync and wait for it during refresh
        await loadPasswords({ silent: false, skipSync: false });
    };

    const handleDelete = async (id) => {
        await HybridStorageService.deletePassword(id);

        // If cloud sync is enabled, trigger a sync to upload any pending entries
        if (cloudSyncEnabled) {
            HybridStorageService.syncToCloud().catch(err =>
                console.error('Background sync after delete failed:', err)
            );
        }

        loadPasswords();
    };

    const toggleVisibility = (id) => {
        setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleExpand = async (id) => {
        const isCurrentlyExpanded = expandedCards[id];
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

        // OPTIMIZATION: Decrypt password only when card is expanded (lazy loading)
        if (!isCurrentlyExpanded && !decryptedPasswords[id]) {
            const password = passwords.find(p => p.id === id);
            if (password) {
                try {
                    const decrypted = await decryptPassword(password.encryptedPassword);
                    setDecryptedPasswords(prev => ({ ...prev, [id]: decrypted }));
                } catch (error) {
                    console.error(`Error decrypting password ${id}:`, error);
                    setDecryptedPasswords(prev => ({ ...prev, [id]: '' }));
                }
            }
        }
    };

    const copyToClipboard = async (text, label) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', `${label} copied to clipboard!`);
    };

    // Filter passwords based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredPasswords(passwords);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = passwords.filter(item =>
                item.siteName.toLowerCase().includes(query) ||
                item.username.toLowerCase().includes(query) ||
                (item.comments && item.comments.toLowerCase().includes(query))
            );
            setFilteredPasswords(filtered);
        }
    }, [searchQuery, passwords]);

    const clearSearch = () => {
        setSearchQuery('');
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);

        // Date part
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        // Time part
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    };

    const renderItem = ({ item }) => {
        const displayPassword = decryptedPasswords[item.id];
        const isExpanded = expandedCards[item.id];
        // Only show yellow 'Not Synced' highlight if:
        // 1. Cloud sync is explicitly ENABLED by the user
        // 2. The item itself has not been synced (cloudSynced === 0)
        // If sync is disabled, everything is local-only by design, so no warning needed.
        const isUnsynced = cloudSyncEnabled && item.cloudSynced === 0;

        return (
            <View style={[styles.card, isUnsynced && styles.unsyncedCard, isTablet && styles.cardTablet]}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconContainer}>
                        <Text style={[styles.siteInitial, { fontSize: responsiveFontSize(24) }]}>{item.siteName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={[styles.siteName, { fontSize: responsiveFontSize(18) }]}>{item.siteName}</Text>
                        {!isExpanded && (
                            <Text style={[styles.username, { fontSize: responsiveFontSize(14) }]}>{item.username}</Text>
                        )}
                    </View>
                    {isUnsynced && (
                        <View style={styles.unsyncedBadge}>
                            <Text style={styles.unsyncedIcon}>☁️❌</Text>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            navigation.navigate('AddPassword', { item });
                        }}
                        style={styles.editButton}
                    >
                        <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                    <View style={styles.expandButton}>
                        <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <>
                        <View style={styles.divider} />

                        <View style={styles.cardBody}>
                            <View style={styles.fieldRow}>
                                <View style={styles.fieldContainer}>
                                    <Text style={[styles.label, { fontSize: responsiveFontSize(10) }]}>USERNAME</Text>
                                    <Text style={[styles.value, { fontSize: responsiveFontSize(16) }]}>{item.username}</Text>
                                </View>
                                <TouchableOpacity onPress={() => copyToClipboard(item.username, 'Username')} style={styles.iconButton}>
                                    <Text style={styles.iconText}>📋</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.fieldRow}>
                                <View style={styles.fieldContainer}>
                                    <Text style={[styles.label, { fontSize: responsiveFontSize(10) }]}>PASSWORD</Text>
                                    <Text style={[styles.password, { fontSize: responsiveFontSize(16) }]}>
                                        {showPassword[item.id] ? (displayPassword || '••••••••••••') : '••••••••••••'}
                                    </Text>
                                </View>
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        onPress={() => toggleVisibility(item.id)}
                                        style={styles.iconButton}
                                        disabled={!displayPassword}
                                    >
                                        <Text style={styles.iconText}>{showPassword[item.id] ? '👁️‍🗨️' : '👁️'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(displayPassword || '', 'Password')}
                                        style={styles.iconButton}
                                        disabled={!displayPassword}
                                    >
                                        <Text style={styles.iconText}>📋</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {item.comments && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.fieldRow}>
                                        <View style={styles.fieldContainer}>
                                            <Text style={[styles.label, { fontSize: responsiveFontSize(10) }]}>COMMENTS</Text>
                                            <Text style={[styles.value, { fontSize: responsiveFontSize(16) }]}>{item.comments}</Text>
                                        </View>
                                    </View>
                                </>
                            )}

                            {item.lastModified && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.fieldRow}>
                                        <View style={styles.fieldContainer}>
                                            <Text style={[styles.label, { fontSize: responsiveFontSize(10) }]}>LAST MODIFIED</Text>
                                            <Text style={[styles.timestamp, { fontSize: responsiveFontSize(13) }]}>
                                                {formatDate(item.lastModified)}
                                            </Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                            <Text style={styles.deleteText}>Delete</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Sync Status Banners */}
            {/* Only show banner if auth state is ready AND sync is explicitly disabled (not null/undefined) */}
            {isAuthStateReady && cloudSyncEnabled === false && (
                <TouchableOpacity
                    style={styles.dataLossWarningBanner}
                    onPress={() => navigation.navigate('Settings')}
                    activeOpacity={0.8}
                >
                    <View style={styles.warningContent}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <View style={styles.warningTextContainer}>
                            <Text style={styles.warningTitle}>WARNING: Local Storage Only</Text>
                            <Text style={styles.warningMessage}>
                                Your passwords are NOT backed up. If you uninstall this app, all passwords will be permanently lost.
                            </Text>
                            <Text style={styles.warningAction}>👉 Tap here to enable cloud sync</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            )}


            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by site, username, or comments..."
                        placeholderTextColor="#6c757d"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                            <Text style={styles.clearButtonText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {searchQuery.length > 0 && (
                    <Text style={[styles.resultCount, { fontSize: responsiveFontSize(12) }]}>
                        {filteredPasswords.length} result{filteredPasswords.length !== 1 ? 's' : ''} found
                    </Text>
                )}
            </View>

            {/* Last Login Indicator */}
            {lastLoginTime && (
                <View style={styles.lastLoginContainer}>
                    <Text style={styles.lastLoginText}>
                        Last logged in: {formatDate(lastLoginTime)}
                    </Text>
                </View>
            )}

            <FlatList
                data={filteredPasswords}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={renderItem}
                numColumns={isTablet ? 2 : 1}
                columnWrapperStyle={isTablet ? styles.row : null}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: 120 + insets.bottom },
                    isTablet && styles.listContentTablet
                ]}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        {searchQuery.length > 0 ? (
                            <>
                                <Text style={[styles.emptyText, { fontSize: responsiveFontSize(18) }]}>No passwords found</Text>
                                <Text style={[styles.emptySubText, { fontSize: responsiveFontSize(14) }]}>Try a different search term</Text>
                                <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                                    <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.emptyText, { fontSize: responsiveFontSize(18) }]}>No passwords found.</Text>
                                <Text style={[styles.emptySubText, { fontSize: responsiveFontSize(14) }]}>Tap "Add New" in the header to add one.</Text>
                            </>
                        )}
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background.light,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 120,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: Colors.text.secondary,
        fontSize: FontSizes.medium,
    },
    card: {
        backgroundColor: Colors.neutral.white,
        borderRadius: 16,
        marginBottom: 20,
        padding: 20,
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: Colors.border.light,
    },
    unsyncedCard: {
        backgroundColor: Colors.warning.light,
        borderColor: Colors.warning.solid,
        borderWidth: 1.5,
    },
    cardTablet: {
        marginHorizontal: 10,
        flex: 0.5,
    },
    row: {
        justifyContent: 'space-between',
    },
    listContentTablet: {
        paddingHorizontal: 20,
    },
    unsyncedBadge: {
        backgroundColor: '#ffe066',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    unsyncedIcon: {
        fontSize: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary.solid,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    siteInitial: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.bold,
        color: Colors.neutral.white,
    },
    headerText: {
        flex: 1,
    },
    siteName: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
    },
    username: {
        fontSize: FontSizes.small,
        color: Colors.text.secondary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f3f5',
        marginBottom: 15,
    },
    cardBody: {
        marginBottom: 10,
    },
    fieldRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    fieldContainer: {
        flex: 1,
    },
    actionsRow: {
        flexDirection: 'row',
    },
    label: {
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.bold,
        color: Colors.text.disabled,
        letterSpacing: 1,
        marginBottom: 4,
    },
    value: {
        fontSize: FontSizes.medium,
        color: Colors.text.primary,
        fontWeight: FontWeights.medium,
    },
    password: {
        fontSize: FontSizes.medium,
        color: Colors.text.secondary,
        fontFamily: 'monospace',
    },
    timestamp: {
        // Dynamic fontSize set inline in component
        color: '#868e96',
        fontStyle: 'italic',
    },
    iconButton: {
        padding: 10,
        marginLeft: 5,
    },
    iconText: {
        fontSize: 18,
    },
    deleteButton: {
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#fff5f5',
        borderRadius: 6,
    },
    deleteText: {
        color: '#ff6b6b',
        fontSize: 12,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        backgroundColor: '#007AFF',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    fabText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        marginTop: -2,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
    },
    editButton: {
        padding: 8,
        backgroundColor: '#f1f3f5',
        borderRadius: 8,
        marginLeft: 10,
    },
    editIcon: {
        fontSize: 16,
    },
    expandButton: {
        marginLeft: 8,
        backgroundColor: '#f1f3f5',
        borderRadius: 18,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandIcon: {
        fontSize: 22,
        color: '#495057',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 22,
    },
    dataLossWarningBanner: {
        backgroundColor: Colors.danger.solid,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: Colors.danger.dark,
    },
    warningContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    warningIcon: {
        fontSize: 24,
        marginRight: 12,
        marginTop: 2,
    },
    warningTextContainer: {
        flex: 1,
    },
    warningTitle: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.bold,
        color: Colors.neutral.white,
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    warningMessage: {
        fontSize: FontSizes.tiny,
        color: Colors.neutral.white,
        lineHeight: 18,
        marginBottom: 6,
    },
    warningAction: {
        fontSize: FontSizes.tiny,
        color: Colors.neutral.white,
        fontWeight: FontWeights.semibold,
        fontStyle: 'italic',
    },
    offlineBanner: {
        backgroundColor: Colors.warning.light,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.warning.solid,
    },
    offlineText: {
        color: Colors.warning.dark,
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.semibold,
        textAlign: 'center',
    },
    syncingBanner: {
        backgroundColor: Colors.info.light,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.info.solid,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncingText: {
        color: Colors.info.solid,
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.semibold,
    },
    lastSyncBanner: {
        backgroundColor: Colors.success.light,
        paddingVertical: 6,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.success.solid,
    },
    lastSyncText: {
        color: Colors.success.dark,
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.medium,
    },
    lastLoginContainer: {
        paddingHorizontal: 20,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lastLoginText: {
        fontSize: FontSizes.tiny,
        color: Colors.text.secondary,
        fontStyle: 'italic',
    },
    searchContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dee2e6',
        paddingHorizontal: 12,
        height: 48,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: 8,
        color: '#6c757d',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#212529',
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
        marginLeft: 8,
    },
    clearButtonText: {
        fontSize: 20,
        color: '#6c757d',
        fontWeight: 'bold',
    },
    resultCount: {
        // Dynamic fontSize set inline in component
        color: '#6c757d',
        marginTop: 8,
        fontStyle: 'italic',
    },
    clearSearchButton: {
        marginTop: 16,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    clearSearchButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        // Dynamic fontSize set inline in component
        fontWeight: 'bold',
        color: '#343a40',
    },
    emptySubText: {
        // Dynamic fontSize set inline in component
        color: '#868e96',
        marginTop: 5,
    },
    usageBanner: {
        backgroundColor: '#e7f5ff',
        paddingVertical: 8,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#d0ebff',
    },
    usageBannerWarning: {
        backgroundColor: '#fff3bf',
        borderBottomColor: '#ffe066',
    },
    usageText: {
        fontSize: 13,
        color: '#495057',
        fontWeight: '500',
    },
    usageWarning: {
        fontSize: 12,
        color: '#e67700',
        fontWeight: '600',
    },
});
