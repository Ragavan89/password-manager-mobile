import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SetupGuideScreen() {
    const openLink = (url) => {
        Linking.openURL(url);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={true}
            >
                <Text style={styles.title}>How to Setup Your Backend</Text>

                <View style={styles.step}>
                    <Text style={styles.stepTitle}>Step 1: Get the Sheet</Text>
                    <Text style={styles.stepText}>
                        You need your own Google Sheet to store passwords.
                    </Text>
                    <Text style={styles.stepText}>
                        1. Open the Template Sheet (click the button at the bottom).
                    </Text>
                    <Text style={styles.stepText}>
                        2. Click <Text style={styles.bold}>File {'>'} Make a copy</Text>.
                    </Text>
                </View>

                <View style={styles.step}>
                    <Text style={styles.stepTitle}>Step 2: Deploy the Script</Text>
                    <Text style={styles.stepText}>
                        1. In your new Sheet, go to <Text style={styles.bold}>Extensions {'>'} Apps Script</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        2. Click the blue <Text style={styles.bold}>Deploy</Text> button (top right).
                    </Text>
                    <Text style={styles.stepText}>
                        3. Select <Text style={styles.bold}>New deployment</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        4. Select type: <Text style={styles.bold}>Web app</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        5. Set "Who has access" to: <Text style={styles.bold}>Anyone</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        6. Click <Text style={styles.bold}>Deploy</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        7. Click <Text style={styles.bold}>Authorize access</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        8. Choose your account. If you see "Google hasn't verified this app":
                    </Text>
                    <Text style={styles.stepText}>
                        - Click <Text style={styles.bold}>Advanced</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        - Click <Text style={styles.bold}>Go to ... (unsafe)</Text>.
                    </Text>
                    <Text style={styles.stepText}>
                        - Click <Text style={styles.bold}>Allow</Text>.
                    </Text>
                </View>

                <View style={styles.step}>
                    <Text style={styles.stepTitle}>Step 3: Connect to App</Text>
                    <Text style={styles.stepText}>
                        1. Copy the <Text style={styles.bold}>Web App URL</Text> (starts with script.google.com).
                    </Text>
                    <Text style={styles.stepText}>
                        2. Go back to this app's Settings.
                    </Text>
                    <Text style={styles.stepText}>
                        3. Paste the URL and click Save.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => openLink('https://docs.google.com/spreadsheets/d/115IizwRB6BFuIKbWIFeuKsAEtIhm3ON50RRGv3sRIu8/copy')}
                >
                    <Text style={styles.buttonText}>Open Template Sheet</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 100, // Extra padding to ensure button is visible
        flexGrow: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
        textAlign: 'center',
    },
    step: {
        marginBottom: 25,
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#007AFF',
    },
    stepText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#444',
        marginBottom: 5,
    },
    bold: {
        fontWeight: 'bold',
        color: '#000',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
