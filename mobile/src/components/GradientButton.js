/**
 * GradientButton Component
 * Premium button with gradient background, animations, and haptic feedback
 */

import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, View } from 'react-native';
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
    iconPosition = 'left', // left, right
    style = {},
    textStyle = {},
    glowEffect = false, // Enable glow when button is active
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(disabled ? 0.5 : 1)).current;

    // Animate opacity when disabled state changes
    useEffect(() => {
        Animated.timing(opacityAnim, {
            toValue: disabled ? 0.5 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [disabled]);

    // Subtle glow pulse animation when enabled and glowEffect is true
    useEffect(() => {
        if (!disabled && glowEffect) {
            const pulseAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                ])
            );
            pulseAnimation.start();
            return () => pulseAnimation.stop();
        } else {
            glowAnim.setValue(0);
        }
    }, [disabled, glowEffect]);

    const handlePressIn = () => {
        if (!disabled && !loading) {
            Animated.spring(scaleAnim, {
                toValue: 0.96,
                useNativeDriver: true,
                speed: 50,
                bounciness: 4,
            }).start();
        }
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 8,
        }).start();
    };

    const handlePress = () => {
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

    // Interpolate glow for shadow
    const glowShadowRadius = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 24],
    });

    const glowShadowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 0.6],
    });

    const buttonContent = (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                    width: fullWidth ? '100%' : 'auto',
                },
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
                        shadowStyle,
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.primary.start} />
                    ) : (
                        <View style={styles.contentRow}>
                            {icon && iconPosition === 'left' && (
                                <View style={styles.iconLeft}>{icon}</View>
                            )}
                            <Text style={[styles.secondaryText, { fontSize: config.fontSize }, textStyle]}>
                                {children}
                            </Text>
                            {icon && iconPosition === 'right' && (
                                <View style={styles.iconRight}>{icon}</View>
                            )}
                        </View>
                    )}
                </TouchableOpacity>
            ) : gradient ? (
                <Animated.View
                    style={[
                        {
                            borderRadius: config.borderRadius,
                            shadowColor: getShadowColor(),
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: glowEffect && !disabled ? glowShadowOpacity : (disabled ? 0.1 : 0.4),
                            shadowRadius: glowEffect && !disabled ? glowShadowRadius : 16,
                            elevation: disabled ? 2 : 8,
                        },
                    ]}
                >
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
                                <View style={styles.contentRow}>
                                    {icon && iconPosition === 'left' && (
                                        <View style={styles.iconLeft}>{icon}</View>
                                    )}
                                    <Text style={[styles.text, { fontSize: config.fontSize }, textStyle]}>
                                        {children}
                                    </Text>
                                    {icon && iconPosition === 'right' && (
                                        <View style={styles.iconRight}>{icon}</View>
                                    )}
                                </View>
                            )}
                        </TouchableOpacity>
                    </LinearGradient>
                </Animated.View>
            ) : null}
        </Animated.View>
    );

    return buttonContent;
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'flex-start',
        backgroundColor: 'transparent', // Transparent to avoid white box
    },
    gradient: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden', // Ensure gradient doesn't bleed
    },
    touchable: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconLeft: {
        marginRight: 10,
    },
    iconRight: {
        marginLeft: 10,
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
