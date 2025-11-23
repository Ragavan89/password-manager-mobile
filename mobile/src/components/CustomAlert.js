import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

export default function CustomAlert({ visible, onClose, title, message, type = 'info', buttons = [] }) {
    // Determine icon and color based on type
    const getTypeConfig = () => {
        switch (type) {
            case 'error':
                return { icon: '❌', color: '#ff6b6b', bgColor: '#ffe3e3' };
            case 'success':
                return { icon: '✅', color: '#37b24d', bgColor: '#d3f9d8' };
            case 'warning':
                return { icon: '⚠️', color: '#f59f00', bgColor: '#fff3bf' };
            case 'info':
            default:
                return { icon: 'ℹ️', color: '#1971c2', bgColor: '#e7f5ff' };
        }
    };

    const config = getTypeConfig();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.alertContainer}>
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
                        <Text style={styles.icon}>{config.icon}</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {buttons.length > 0 ? (
                            buttons.map((button, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        button.style === 'cancel' ? styles.cancelButton : styles.primaryButton,
                                        buttons.length === 1 && styles.singleButton
                                    ]}
                                    onPress={() => {
                                        button.onPress?.();
                                        onClose();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.buttonText,
                                            button.style === 'cancel' ? styles.cancelButtonText : styles.primaryButtonText
                                        ]}
                                    >
                                        {button.text}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton, styles.singleButton]}
                                onPress={onClose}
                            >
                                <Text style={styles.primaryButtonText}>OK</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    icon: {
        fontSize: 36,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#6c757d',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    singleButton: {
        flex: 1,
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    cancelButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryButtonText: {
        color: '#fff',
    },
    cancelButtonText: {
        color: '#495057',
    },
});
