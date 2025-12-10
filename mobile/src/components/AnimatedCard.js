/**
 * AnimatedCard Component
 * Card with subtle animations, colored shadows, and glassmorphism support
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, Shadows } from '../theme/colors';

export default function AnimatedCard({
    children,
    style = {},
    delay = 0,
    shadowColor = Colors.shadow.card,
    glassmorphism = false,
    onPress = null,
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                delay: delay,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                delay: delay,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const cardStyle = glassmorphism
        ? [
            styles.glassCard,
            {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            },
            style,
        ]
        : [
            styles.card,
            {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                shadowColor: shadowColor,
            },
            style,
        ];

    return <Animated.View style={cardStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.background.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        ...Shadows.medium,
        borderWidth: 1,
        borderColor: Colors.neutral.gray200,
    },
    glassCard: {
        backgroundColor: Colors.glass.background,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.glass.border,
        backdropFilter: 'blur(10px)', // Note: Limited support on React Native
    },
});
