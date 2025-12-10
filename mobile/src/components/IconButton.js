/**
 * IconButton Component
 * Modern icon button with gradient background and haptic feedback
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Gradients, Shadows } from '../theme/colors';

export default function IconButton({
    icon,
    onPress,
    variant = 'primary', // primary, success, danger, warning, secondary
    size = 40,
    iconSize = 20,
    style = {},
    disabled = false,
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!disabled) {
            Animated.spring(scaleAnim, {
                toValue: 0.9,
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
        if (!disabled) {
            onPress?.();
        }
    };

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
            case 'secondary':
                return Gradients.subtle;
            default:
                return Gradients.primary;
        }
    };

    const gradient = getGradient();
    const iconColor = variant === 'secondary' ? Colors.primary.start : Colors.neutral.white;

    return (
        <Animated.View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    transform: [{ scale: scaleAnim }],
                    opacity: disabled ? 0.5 : 1,
                },
                Shadows.medium,
                style,
            ]}
        >
            <LinearGradient
                colors={gradient.colors}
                start={gradient.start}
                end={gradient.end}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <TouchableOpacity
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={handlePress}
                    disabled={disabled}
                    style={styles.touchable}
                >
                    <Ionicons name={icon} size={iconSize} color={iconColor} />
                </TouchableOpacity>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    touchable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
