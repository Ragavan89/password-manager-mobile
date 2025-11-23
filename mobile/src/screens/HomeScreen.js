import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Button, ActivityIndicator, RefreshControl, SafeAreaView, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { getPasswords } from '../services/Database';
import { deletePasswordOffline, syncWithCloud, getSyncStatus, initSyncService } from '../services/SyncService';
import { decryptPassword } from '../services/Encryption';

export default function HomeScreen({ navigation }) {
    const [passwords, setPasswords] = useState([]);
    const [filteredPasswords, setFilteredPasswords] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState({});
    const [syncStatus, setSyncStatus] = useState({ isOnline: true, pendingOperations: 0, isSyncing: false });


    // Initialize sync service on mount
    useEffect(() => {
        initSyncService();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadPasswords();
            updateSyncStatus();

            // Check if sync is already in progress (from add/edit)
            // If so, start monitoring it
            const checkAndMonitor = async () => {
                const status = await getSyncStatus();
                if (status.isSyncing) {
                    console.log('🔍 Detected ongoing sync, starting monitor...');

                    // Monitor sync status continuously
                    let checkCount = 0;
                    const maxChecks = 70; // 70 * 500ms = 35 seconds max

                    const checkStatus = setInterval(async () => {
                        const currentStatus = await getSyncStatus();
                        setSyncStatus(currentStatus);
                        checkCount++;

                        // Stop checking when sync is complete OR timeout
                        if (!currentStatus.isSyncing || checkCount >= maxChecks) {
                            clearInterval(checkStatus);

                            if (checkCount >= maxChecks) {
                                console.warn('⏰ Status polling timeout - stopped checking');
                            }

                            // Final status update and reload passwords
                            setTimeout(async () => {
                                const finalStatus = await getSyncStatus();
                                setSyncStatus(finalStatus);
                                loadPasswords({ silent: true }); // Reload silently to show synced data
                                console.log('🔄 Background sync monitor complete');
                            }, 500);
                        }
                    }, 500); // Check every 500ms
                }
            };

            checkAndMonitor();

            // Sync only happens on app start, network change, or after add/edit/delete
            // Not on every screen focus to avoid excessive syncing
        }, [])
    );

    const updateSyncStatus = async () => {
        const status = await getSyncStatus();
        setSyncStatus(status);
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

                    {/* Cloud Sync Button - Icon Only */}
                    <TouchableOpacity
                        onPress={async () => {
                            // Start sync
                            syncWithCloud();

                            // Monitor sync status continuously
                            let checkCount = 0;
                            const maxChecks = 70; // 70 * 500ms = 35 seconds max

                            const checkStatus = setInterval(async () => {
                                const status = await getSyncStatus();
                                setSyncStatus(status);
                                checkCount++;

                                // Stop checking when sync is complete OR timeout
                                if (!status.isSyncing || checkCount >= maxChecks) {
                                    clearInterval(checkStatus);

                                    if (checkCount >= maxChecks) {
                                        console.warn('⏰ Status polling timeout - stopped checking');
                                    }

                                    // Final status update and reload passwords
                                    setTimeout(async () => {
                                        const finalStatus = await getSyncStatus();
                                        setSyncStatus(finalStatus);
                                        loadPasswords(); // Reload to show synced data
                                        console.log('🔄 Final status update complete');
                                    }, 500);
                                }
                            }, 500); // Check every 500ms
                        }}
                        style={{
                            marginHorizontal: 6,
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#e7f5ff',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 20 }}>🔄</Text>
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
    }, [navigation]);

    const loadPasswords = async (options = { silent: false }) => {
        if (!options.silent) {
            setLoading(true);
        }
        try {
            // Load from local database (offline-first)
            const data = getPasswords();
            setPasswords(data);
            await updateSyncStatus();
        } catch (error) {
            console.error('Error loading passwords:', error);
        } finally {
            if (!options.silent) {
                setLoading(false);
            }
        }
    };

    const handleDelete = async (id) => {
        await deletePasswordOffline(id);
        loadPasswords();
        updateSyncStatus();
    };

    const toggleVisibility = (id) => {
        setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
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
        const displayPassword = decryptPassword(item.encryptedPassword);

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.siteInitial}>{item.siteName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.siteName}>{item.siteName}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('AddPassword', { item })} style={styles.editButton}>
                        <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardBody}>
                    <View style={styles.fieldRow}>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>USERNAME</Text>
                            <Text style={styles.value}>{item.username}</Text>
                        </View>
                        <TouchableOpacity onPress={() => copyToClipboard(item.username, 'Username')} style={styles.iconButton}>
                            <Text style={styles.iconText}>📋</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.fieldRow}>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <Text style={styles.password}>
                                {showPassword[item.id] ? displayPassword : '••••••••••••'}
                            </Text>
                        </View>
                        <View style={styles.actionsRow}>
                            <TouchableOpacity onPress={() => toggleVisibility(item.id)} style={styles.iconButton}>
                                <Text style={styles.iconText}>{showPassword[item.id] ? '👁️‍🗨️' : '👁️'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => copyToClipboard(displayPassword, 'Password')} style={styles.iconButton}>
                                <Text style={styles.iconText}>📋</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {item.comments && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.fieldRow}>
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>COMMENTS</Text>
                                    <Text style={styles.value}>{item.comments}</Text>
                                </View>
                            </View>
                        </>
                    )}

                    {item.lastModified && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.fieldRow}>
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>LAST MODIFIED</Text>
                                    <Text style={styles.timestamp}>
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
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Sync Status Indicator */}
            {!syncStatus.isOnline && (
                <View style={styles.offlineBanner}>
                    <Text style={styles.offlineText}>
                        📡 Offline Mode {syncStatus.pendingOperations > 0 && `• ${syncStatus.pendingOperations} pending`}
                    </Text>
                </View>
            )}
            {/* Sync Status Banners */}
            {!syncStatus.isConfigured && (
                <View style={[styles.lastSyncBanner, { backgroundColor: '#fff3bf' }]}>
                    <Text style={[styles.lastSyncText, { color: '#f08c00' }]}>
                        ⚠️ Local Only Mode (Cloud Sync Not Configured)
                    </Text>
                </View>
            )}

            {syncStatus.isConfigured && syncStatus.isOnline && syncStatus.isSyncing && (
                <View style={styles.syncingBanner}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.syncingText}>  Syncing...</Text>
                </View>
            )}

            {/* Last Synced Indicator */}
            {syncStatus.isConfigured && syncStatus.isOnline && !syncStatus.isSyncing && syncStatus.lastSyncTime && (
                <View style={styles.lastSyncBanner}>
                    <Text style={styles.lastSyncText}>
                        Last synced: {formatDate(new Date(syncStatus.lastSyncTime).toISOString())}
                    </Text>
                </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by site, username, or comments..."
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
                    <Text style={styles.resultCount}>
                        {filteredPasswords.length} result{filteredPasswords.length !== 1 ? 's' : ''} found
                    </Text>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Syncing with Google Sheets...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredPasswords}
                    keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadPasswords} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            {searchQuery.length > 0 ? (
                                <>
                                    <Text style={styles.emptyText}>No passwords found</Text>
                                    <Text style={styles.emptySubText}>Try a different search term</Text>
                                    <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                                        <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.emptyText}>No passwords found.</Text>
                                    <Text style={styles.emptySubText}>Tap "Add New" in the header to add one.</Text>
                                </>
                            )}
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddPassword')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#6c757d',
        fontSize: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f3f5',
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
        backgroundColor: '#e7f5ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    siteInitial: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    headerText: {
        flex: 1,
    },
    siteName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212529',
    },
    username: {
        fontSize: 14,
        color: '#868e96',
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
        fontSize: 10,
        fontWeight: 'bold',
        color: '#adb5bd',
        letterSpacing: 1,
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        color: '#212529',
        fontWeight: '500',
    },
    password: {
        fontSize: 16,
        color: '#495057',
        fontFamily: 'monospace',
    },
    timestamp: {
        fontSize: 13,
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
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
    },
    emptySubText: {
        fontSize: 14,
        color: '#868e96',
        marginTop: 5,
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
    offlineBanner: {
        backgroundColor: '#fff3cd',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ffc107',
    },
    offlineText: {
        color: '#856404',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    syncingBanner: {
        backgroundColor: '#e7f5ff',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#74c0fc',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncingText: {
        color: '#1971c2',
        fontSize: 13,
        fontWeight: '600',
    },
    lastSyncBanner: {
        backgroundColor: '#d3f9d8',
        paddingVertical: 6,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#8ce99a',
    },
    lastSyncText: {
        color: '#2b8a3e',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
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
        fontSize: 12,
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
    }
});
