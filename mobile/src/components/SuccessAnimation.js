/**
 * SuccessAnimation Component
 * Animated success checkmark with confetti-like particles
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';

export default function SuccessAnimation({ visible = false, onComplete }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animate checkmark
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 40,
                        friction: 3,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rotateAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.delay(800),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                onComplete?.();
            });
        } else {
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-45deg', '0deg'],
    });

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <Animated.View
                style={[
                    styles.container,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }, { rotate: rotation }],
                    },
                ]}
            >
                <View style={styles.circle}>
                    <Ionicons name="checkmark" size={60} color={Colors.neutral.white} />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 9999,
    },
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    circle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.success.solid,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.shadow.success,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
});
