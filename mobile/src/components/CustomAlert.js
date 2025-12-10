import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { Colors, Gradients, Shadows } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

export default function CustomAlert({ visible, onClose, title, message, type = 'info', buttons = [], textAlign }) {
    // Responsive dimensions hook
    const { isTablet } = useResponsiveDimensions();

    // Animation refs
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animate in
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.8);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    // Determine icon and gradient based on type
    const getTypeConfig = () => {
        switch (type) {
            case 'error':
                return {
                    iconName: 'close-circle',
                    gradient: Gradients.danger,
                    color: Colors.danger.solid,
                };
            case 'success':
                return {
                    iconName: 'checkmark-circle',
                    gradient: Gradients.success,
                    color: Colors.success.solid,
                };
            case 'warning':
                return {
                    iconName: 'warning',
                    gradient: Gradients.warning,
                    color: Colors.warning.solid,
                };
            case 'info':
            default:
                return {
                    iconName: 'information-circle',
                    gradient: Gradients.info,
                    color: Colors.info.solid,
                };
        }
    };

    const config = getTypeConfig();

    const handleButtonPress = (button) => {
        button.onPress?.();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <Animated.View
                    style={[
                        styles.alertContainer,
                        {
                            width: '90%',
                            maxWidth: isTablet ? 500 : 340,
                            minWidth: 280,
                            transform: [{ scale: scaleAnim }],
                        }
                    ]}
                >
                    {/* Icon with Gradient */}
                    <LinearGradient
                        colors={config.gradient.colors}
                        start={config.gradient.start}
                        end={config.gradient.end}
                        style={styles.iconContainer}
                    >
                        <Ionicons name={config.iconName} size={48} color={Colors.neutral.white} />
                    </LinearGradient>

                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    {typeof message === 'string' ? (
                        <Text style={[styles.message, { textAlign: textAlign || 'center' }]}>{message}</Text>
                    ) : (
                        message
                    )}

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {buttons.length > 0 ? (
                            buttons.map((button, index) => (
                                button.style === 'cancel' ? (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.button,
                                            styles.cancelButton,
                                            buttons.length === 1 && styles.singleButton
                                        ]}
                                        onPress={() => handleButtonPress(button)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.cancelButtonText}>
                                            {button.text}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <LinearGradient
                                        key={index}
                                        colors={config.gradient.colors}
                                        start={config.gradient.start}
                                        end={config.gradient.end}
                                        style={[
                                            styles.button,
                                            buttons.length === 1 && styles.singleButton
                                        ]}
                                    >
                                        <TouchableOpacity
                                            style={styles.gradientButtonInner}
                                            onPress={() => handleButtonPress(button)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.primaryButtonText}>
                                                {button.text}
                                            </Text>
                                        </TouchableOpacity>
                                    </LinearGradient>
                                )
                            ))
                        ) : (
                            <LinearGradient
                                colors={config.gradient.colors}
                                start={config.gradient.start}
                                end={config.gradient.end}
                                style={[styles.button, styles.singleButton]}
                            >
                                <TouchableOpacity
                                    style={styles.gradientButtonInner}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        onClose();
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.primaryButtonText}>OK</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        )}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertContainer: {
        backgroundColor: Colors.neutral.white,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        ...Shadows.large,
        borderWidth: 1,
        borderColor: Colors.neutral.gray200,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        ...Shadows.medium,
    },
    title: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: FontSizes.medium,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 28,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8,
    },
    button: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        ...Shadows.small,
    },
    gradientButtonInner: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    singleButton: {
        flex: 1,
    },
    cancelButton: {
        backgroundColor: Colors.neutral.white,
        borderWidth: 2,
        borderColor: Colors.neutral.gray400,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: Colors.neutral.white,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.bold,
    },
    cancelButtonText: {
        color: Colors.text.secondary,
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
    },
});

