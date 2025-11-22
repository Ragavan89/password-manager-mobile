import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'SHEETS_API_URL';

export default function SettingsScreen({ navigation }) {
    const [url, setUrl] = useState('');

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
            if (storedUrl) setUrl(storedUrl);
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
            Alert.alert('Success', 'URL saved successfully');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Failed to save URL');
            console.error(e);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Google Apps Script Web App URL:</Text>
            <TextInput
                style={styles.input}
                placeholder="https://script.google.com/macros/s/..."
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Text style={styles.hint}>
                Deploy your Google Apps Script as a Web App and paste the URL here.
            </Text>

            <View style={styles.buttonContainer}>
                <Button title="How to Setup?" onPress={() => navigation.navigate('SetupGuide')} color="#666" />
                <View style={{ height: 10 }} />
                <Button title="Save Configuration" onPress={handleSave} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        fontSize: 16,
        borderRadius: 6,
        marginBottom: 10,
        height: 50,
    },
    hint: {
        color: '#666',
        fontSize: 14,
        marginBottom: 20,
    },
    buttonContainer: {
        marginTop: 10,
    }
});
