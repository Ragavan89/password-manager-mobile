/**
 * Centralized Theme System
 * 
 * Single source of truth for all app styling.
 * To change the entire app's look, modify this file.
 * 
 * Benefits:
 * - Change theme in ONE place
 * - Easy to add dark mode later
 * - Consistent across all screens
 * - No performance impact (static imports)
 */

import { Colors, Gradients, Shadows } from './colors';
import { FontSizes, FontWeights, LineHeights, LetterSpacings } from './typography';

// Light Theme (Current)
const lightTheme = {
    // Colors
    colors: {
        // Primary
        primary: Colors.primary.solid,
        primaryLight: Colors.primary.light,
        primaryDark: Colors.primary.dark,

        // Backgrounds
        background: Colors.background.light,
        surface: Colors.neutral.white,
        surfaceLight: Colors.neutral.gray50,

        // Text
        text: Colors.text.primary,
        textSecondary: Colors.text.secondary,
        textDisabled: Colors.text.disabled,
        textInverse: Colors.text.inverse,

        // Status
        success: Colors.success.solid,
        successLight: Colors.success.light,
        warning: Colors.warning.solid,
        warningLight: Colors.warning.light,
        danger: Colors.danger.solid,
        dangerLight: Colors.danger.light,
        info: Colors.info.solid,
        infoLight: Colors.info.light,

        // Borders
        border: Colors.border.light,
        borderMedium: Colors.border.medium,
        borderDark: Colors.border.dark,

        // Functional
        online: Colors.status.online,
        offline: Colors.status.offline,
        syncing: Colors.status.syncing,
        error: Colors.status.error,
    },

    // Gradients
    gradients: {
        primary: Gradients.primary,
        success: Gradients.success,
        warning: Gradients.warning,
        danger: Gradients.danger,
        info: Gradients.info,
        subtle: Gradients.subtle,
    },

    // Typography
    fonts: {
        sizes: {
            tiny: FontSizes.tiny,
            small: FontSizes.small,
            medium: FontSizes.medium,
            large: FontSizes.large,
            h1: FontSizes.h1,
            h2: FontSizes.h2,
            h3: FontSizes.h3,
        },
        weights: {
            light: FontWeights.light,
            regular: FontWeights.regular,
            medium: FontWeights.medium,
            semibold: FontWeights.semibold,
            bold: FontWeights.bold,
            black: FontWeights.black,
        },
        lineHeights: LineHeights,
        letterSpacings: LetterSpacings,
    },

    // Shadows
    shadows: {
        small: Shadows.small,
        medium: Shadows.medium,
        large: Shadows.large,
    },

    // Spacing (8px grid system)
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // Border Radius
    radius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        full: 9999,
    },
};

// Dark Theme (Placeholder for future)
const darkTheme = {
    ...lightTheme,
    colors: {
        ...lightTheme.colors,
        // When implementing dark mode, override colors here:
        background: '#1a1a2e',
        surface: '#16213e',
        text: '#ffffff',
        textSecondary: '#adb5bd',
        // ... etc
    },
};

// Active Theme - CHANGE HERE TO SWITCH ENTIRE APP THEME!
export const theme = lightTheme;

// Export individual themes for future use
export { lightTheme, darkTheme };

// Re-export for backwards compatibility during migration
export { Colors, Gradients, Shadows, FontSizes, FontWeights };
