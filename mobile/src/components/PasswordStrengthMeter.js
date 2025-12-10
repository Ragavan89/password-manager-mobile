/**
 * PasswordStrengthMeter Component
 * Animated password strength indicator with gradient fill
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

export default function PasswordStrengthMeter({ password = '' }) {
    const widthAnim = useRef(new Animated.Value(0)).current;

    // Calculate password strength
    const getPasswordStrength = (pwd) => {
        if (!pwd) return { strength: '', color: Colors.neutral.gray400, percentage: 0, gradient: [] };

        let score = 0;

        // Length criteria
        if (pwd.length >= 8) score += 1;
        if (pwd.length >= 12) score += 1;
        if (pwd.length >= 16) score += 1;

        // Character variety
        if (/[a-z]/.test(pwd)) score += 1;
        if (/[A-Z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd)) score += 1;
        if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

        // Determine strength
        if (score <= 2)
            return {
                strength: 'Weak',
                color: Colors.danger.solid,
                percentage: 25,
                gradient: [Colors.danger.start, Colors.danger.end],
            };
        if (score <= 4)
            return {
                strength: 'Medium',
                color: Colors.warning.solid,
                percentage: 50,
                gradient: [Colors.warning.start, Colors.warning.end],
            };
        if (score <= 5)
            return {
                strength: 'Strong',
                color: Colors.success.start,
                percentage: 75,
                gradient: [Colors.success.start, Colors.success.end],
            };
        return {
            strength: 'Very Strong',
            color: Colors.success.end,
            percentage: 100,
            gradient: [Colors.success.start, Colors.success.end],
        };
    };

    const strengthInfo = getPasswordStrength(password);

    useEffect(() => {
        Animated.spring(widthAnim, {
            toValue: strengthInfo.percentage,
            tension: 50,
            friction: 7,
            useNativeDriver: false,
        }).start();
    }, [strengthInfo.percentage]);

    const animatedWidth = widthAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    if (!password) return null;

    return (
        <View style={styles.container}>
            <View style={styles.barContainer}>
                <Animated.View style={[styles.barFill, { width: animatedWidth }]}>
                    <LinearGradient
                        colors={strengthInfo.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradient}
                    />
                </Animated.View>
            </View>
            <Text style={[styles.label, { color: strengthInfo.color }]}>{strengthInfo.strength}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    barContainer: {
        flex: 1,
        height: 8,
        backgroundColor: Colors.neutral.gray200,
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
    },
    gradient: {
        flex: 1,
        height: '100%',
    },
    label: {
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.bold,
        minWidth: 80,
        textAlign: 'right',
    },
});
