/**
 * SkeletonLoader Component
 * Shimmer loading effect for content placeholders
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';

export default function SkeletonLoader({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style = {},
}) {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: false,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false,
                }),
            ])
        ).start();
    }, []);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-300, 300],
    });

    return (
        <View
            style={[
                styles.container,
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: Colors.neutral.gray200,
                },
                style,
            ]}
        >
            <Animated.View
                style={[
                    styles.shimmer,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <LinearGradient
                    colors={[
                        Colors.neutral.gray200,
                        Colors.neutral.gray300,
                        Colors.neutral.gray200,
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                />
            </Animated.View>
        </View>
    );
}

// Preset components for common use cases
export function SkeletonCard() {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <SkeletonLoader width={50} height={50} borderRadius={25} />
                <View style={styles.cardContent}>
                    <SkeletonLoader width="70%" height={18} />
                    <View style={{ height: 8 }} />
                    <SkeletonLoader width="50%" height={14} />
                </View>
            </View>
        </View>
    );
}

export function SkeletonList({ count = 3 }) {
    return (
        <View>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    shimmer: {
        width: '300%',
        height: '100%',
    },
    gradient: {
        flex: 1,
    },
    card: {
        backgroundColor: Colors.neutral.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.neutral.gray200,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    cardContent: {
        flex: 1,
    },
});
