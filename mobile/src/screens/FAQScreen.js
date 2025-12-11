/**
 * FAQScreen.js
 * 
 * Frequently Asked Questions screen to help users understand the application better.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { FontSizes, FontWeights } from '../theme/typography';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQItem = ({ question, answer, isOpen, onPress }) => {
    return (
        <View style={styles.faqCard}>
            <TouchableOpacity
                style={styles.questionHeader}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <Text style={styles.questionText}>{question}</Text>
                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={Colors.primary.solid}
                />
            </TouchableOpacity>

            {isOpen && (
                <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{answer}</Text>
                </View>
            )}
        </View>
    );
};

export default function FAQScreen() {
    const [openIndex, setOpenIndex] = useState(null);

    const toggleItem = (index) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenIndex(openIndex === index ? null : index);
    };

    const faqData = [
        {
            question: "What is CredVault?",
            answer: "CredVault is a secure password management application that stores your credentials locally on your device with military-grade encryption. It prioritizes your privacy and security above all else."
        },
        {
            question: "Is my data safe?",
            answer: "Yes, absolutely. Your passwords are encrypted using AES-256 encryption. We do not store your Master Password or PIN on our servers, which means only you have access to your decrypted data."
        },
        {
            question: "What if I forget my Master Password?",
            answer: "Because we do not store your Master Password, we cannot recover it for you. If you forget your Master Password, you will unfortunately lose access to your encrypted data. Please keep your Master Password safe!"
        },
        {
            question: "How does Cloud Sync work?",
            answer: "Cloud Sync is an optional feature that allows you to securely backup your encrypted passwords to the cloud. Even when stored in the cloud, your data remains fully encrypted and can only be unlocked by you on your devices."
        },
        {
            question: "Can I use the app offline?",
            answer: "Yes! CredVault is designed to be offline-first. You can add, edit, and view your passwords without an internet connection. Syncing will occur automatically when you're back online if you have Cloud Sync enabled."
        },
        {
            question: "How do I change my PIN?",
            answer: "You cannot directly change your PIN currently, but you can change your Master Password or reset the app if needed from the Settings menu. (Future updates may include direct PIN change functionality)."
        },
        {
            question: "Is CredVault free?",
            answer: "Yes, CredVault offers a free tier that allows you to store a generous number of passwords. We also offer premium tiers for power users who need more storage."
        }
    ];

    return (
        <View style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
            >
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
                    <Text style={styles.headerSubtitle}>
                        Everything you need to know about using CredVault.
                    </Text>
                </View>

                {faqData.map((item, index) => (
                    <FAQItem
                        key={index}
                        question={item.question}
                        answer={item.answer}
                        isOpen={openIndex === index}
                        onPress={() => toggleItem(index)}
                    />
                ))}

                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>
                        Still have questions? Contact us at support@credvault.com
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background.light,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    headerContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSizes.h2,
        fontWeight: FontWeights.bold,
        color: Colors.text.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: FontSizes.medium,
        color: Colors.text.secondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    faqCard: {
        backgroundColor: Colors.neutral.white,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border.light,
        ...Shadows.small,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.neutral.white,
    },
    questionText: {
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
        color: Colors.text.primary,
        flex: 1,
        marginRight: 10,
    },
    answerContainer: {
        padding: 16,
        paddingTop: 0,
        backgroundColor: Colors.neutral.white,
    },
    answerText: {
        fontSize: FontSizes.small,
        color: Colors.text.secondary,
        lineHeight: 22,
    },
    footerContainer: {
        marginTop: 20,
        alignItems: 'center',
        padding: 10,
    },
    footerText: {
        fontSize: FontSizes.small,
        color: Colors.text.disabled,
        textAlign: 'center',
    },
});
