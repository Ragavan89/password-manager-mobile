import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsiveDimensions } from '../utils/DimensionsHelper';
import { FontSizes, FontWeights } from '../theme/typography';

const CARD_ASPECT_RATIO = 1.586; // Standard credit card aspect ratio

export default function CreditCard({ type = 'visa', holderName = 'YOUR NAME', last4 = '0000', bankName = 'Bank', color1 = '#4c6ef5', color2 = '#15aabf' }) {
    const { width } = Dimensions.get('window');
    const { isTablet, responsiveFontSize } = useResponsiveDimensions();

    // Card width calculation
    // Mobile: 85% of screen width to show part of next card (carousel feel)
    // Tablet: Fixed reasonable width
    const cardWidth = isTablet ? 400 : width * 0.85;
    const cardHeight = cardWidth / CARD_ASPECT_RATIO;

    const getCardLogo = () => {
        // Simple text fallback for logos to avoid external image dependencies for now
        switch (type.toLowerCase()) {
            case 'visa': return 'VISA';
            case 'mastercard': return 'Mastercard';
            case 'amex': return 'AMEX';
            default: return 'CARD';
        }
    };

    return (
        <View style={[styles.container, { width: cardWidth, height: cardHeight }]}>
            <LinearGradient
                colors={[color1, color2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Glassmorphism overlay (simulated with semi-transparent white gradients) */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.3, y: 0.8 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Content */}
                <View style={styles.cardContent}>
                    {/* Top Row: Bank & Chip */}
                    <View style={styles.topRow}>
                        <View style={styles.chip} />
                        <Text style={styles.bankName}>{bankName}</Text>
                    </View>

                    {/* Middle: Number (Masked) */}
                    <View style={styles.numberContainer}>
                        <Text style={styles.numberText}>•••• •••• •••• {last4}</Text>
                    </View>

                    {/* Bottom: Name & Logo */}
                    <View style={styles.bottomRow}>
                        <View>
                            <Text style={styles.label}>CARD HOLDER</Text>
                            <Text style={styles.holderName}>{holderName.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.cardLogo}>{getCardLogo()}</Text>
                    </View>
                </View>

                {/* Decorative Circles for 'Premium' feel */}
                <View style={styles.circle1} />
                <View style={styles.circle2} />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        marginRight: 16, // Spacing between cards
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.30,
        shadowRadius: 10,
        elevation: 10,
    },
    gradient: {
        flex: 1,
        borderRadius: 16,
        padding: 24,
        position: 'relative',
        overflow: 'hidden', // Clip the decorative circles
    },
    cardContent: {
        flex: 1,
        justifyContent: 'space-between',
        zIndex: 2, // Ensure text is above decorative circles
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    chip: {
        width: 45,
        height: 34,
        backgroundColor: '#e9ecef',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ced4da',
        opacity: 0.8,
        // Metallic effect simulation
        shadowColor: "#000",
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    bankName: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: FontSizes.medium,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontStyle: 'italic',
    },
    numberContainer: {
        justifyContent: 'center',
        marginTop: 10,
    },
    numberText: {
        color: '#fff',
        fontSize: 22,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Monospaced for card numbers
        letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    label: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    holderName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    cardLogo: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        fontStyle: 'italic',
    },
    // Decorative background elements
    circle1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
        zIndex: 1,
    },
    circle2: {
        position: 'absolute',
        bottom: -80,
        left: -40,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(0,0,0,0.05)',
        zIndex: 1,
    }
});
