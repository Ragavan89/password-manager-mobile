/**
 * GradientButton Component
 * Premium button with gradient background, animations, and haptic feedback
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients, Shadows } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

export default function GradientButton({
    onPress,
    children,
    variant = 'primary', // primary, success, danger, secondary
    size = 'medium', // small, medium, large
    loading = false,
    disabled = false,
    fullWidth = false,
    icon = null,
    style = {},
    textStyle = {},
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!disabled && !loading) {
            Animated.spring(scaleAnim, {
                toValue: 0.95,
                useNativeDriver: true,
                speed: 50,
            }).start();
        }
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
        }).start();
    };

    const handlePress = () => {
        if (!disabled && !loading) {
            onPress?.();
        }
    };

    // Gradient colors based on variant
    const getGradient = () => {
        switch (variant) {
            case 'primary':
                return Gradients.primary;
            case 'success':
                return Gradients.success;
            case 'danger':
                return Gradients.danger;
            case 'warning':
                return Gradients.warning;
            case 'info':
                return Gradients.info;
            case 'secondary':
                return null; // Will use solid color
            default:
                return Gradients.primary;
        }
    };

    // Size configurations
    const sizeConfig = {
        small: {
            paddingVertical: 12,
            paddingHorizontal: 20,
            fontSize: FontSizes.small,
            borderRadius: 10,
        },
        medium: {
            paddingVertical: 16,
            paddingHorizontal: 24,
            fontSize: FontSizes.medium,
            borderRadius: 12,
        },
        large: {
            paddingVertical: 20,
            paddingHorizontal: 32,
            fontSize: FontSizes.large,
            borderRadius: 16,
        },
    };

    const config = sizeConfig[size];
    const gradient = getGradient();
    const isSecondary = variant === 'secondary';

    // Shadow color based on variant
    const getShadowColor = () => {
        switch (variant) {
            case 'primary':
                return Colors.shadow.primary;
            case 'success':
                return Colors.shadow.success;
            case 'danger':
                return Colors.shadow.danger;
            default:
                return Colors.shadow.card;
        }
    };

    const shadowStyle = {
        shadowColor: getShadowColor(),
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: disabled ? 0.1 : 0.4,
        shadowRadius: 16,
        elevation: disabled ? 2 : 8,
    };

    const buttonContent = (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    paddingVertical: config.paddingVertical,
                    paddingHorizontal: config.paddingHorizontal,
                    borderRadius: config.borderRadius,
                    opacity: disabled ? 0.5 : 1,
                    width: fullWidth ? '100%' : 'auto',
                },
                shadowStyle,
                style,
            ]}
        >
            {isSecondary ? (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handlePress}
                    disabled={disabled || loading}
                    style={[
                        styles.secondaryButton,
                        {
                            paddingVertical: config.paddingVertical,
                            paddingHorizontal: config.paddingHorizontal,
                            borderRadius: config.borderRadius,
                        },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.primary.start} />
                    ) : (
                        <Text style={[styles.secondaryText, { fontSize: config.fontSize }, textStyle]}>
                            {children}
                        </Text>
                    )}
                </TouchableOpacity>
            ) : gradient ? (
                <LinearGradient
                    colors={gradient.colors}
                    start={gradient.start}
                    end={gradient.end}
                    style={[
                        styles.gradient,
                        {
                            paddingVertical: config.paddingVertical,
                            paddingHorizontal: config.paddingHorizontal,
                            borderRadius: config.borderRadius,
                        },
                    ]}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPressIn={handlePressIn}
                        onPressOut={handlePressOut}
                        onPress={handlePress}
                        disabled={disabled || loading}
                        style={styles.touchable}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={[styles.text, { fontSize: config.fontSize }, textStyle]}>{children}</Text>
                        )}
                    </TouchableOpacity>
                </LinearGradient>
            ) : null}
        </Animated.View>
    );

    return buttonContent;
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
    },
    gradient: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    touchable: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: Colors.neutral.white,
        fontWeight: FontWeights.bold,
        textAlign: 'center',
    },
    secondaryButton: {
        backgroundColor: Colors.neutral.white,
        borderWidth: 2,
        borderColor: Colors.primary.start,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryText: {
        color: Colors.primary.start,
        fontWeight: FontWeights.semibold,
        textAlign: 'center',
    },
});
