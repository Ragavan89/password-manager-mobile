/**
 * Typography System
 * Modern font hierarchy with responsive sizing
 */

export const FontFamilies = {
    // Since we're using Expo, we'll use the best available system fonts
    // For custom fonts, we'd need to load them with expo-font
    heading: 'System', // Can be replaced with 'Inter-Bold' after loading
    body: 'System', // Can be replaced with 'Inter-Regular' after loading
    mono: 'Courier', // Monospace for passwords
};

export const FontSizes = {
    // Display (Extra Large)
    display: {
        large: 48,
        medium: 40,
        small: 36,
    },

    // Headings
    h1: 32,
    h2: 28,
    h3: 24,
    h4: 20,
    h5: 18,
    h6: 16,

    // Body
    large: 18,
    medium: 16,
    regular: 15,
    small: 14,
    tiny: 12,
    micro: 10,
};

export const FontWeights = {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
};

export const LineHeights = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
};

export const LetterSpacings = {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
};

// Text styles presets
export const TextStyles = {
    // Display styles
    displayLarge: {
        fontSize: FontSizes.display.large,
        fontWeight: FontWeights.black,
        lineHeight: FontSizes.display.large * LineHeights.tight,
    },
    displayMedium: {
        fontSize: FontSizes.display.medium,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.display.medium * LineHeights.tight,
    },

    // Heading styles
    h1: {
        fontSize: FontSizes.h1,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.h1 * LineHeights.tight,
    },
    h2: {
        fontSize: FontSizes.h2,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.h2 * LineHeights.normal,
    },
    h3: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.semibold,
        lineHeight: FontSizes.h3 * LineHeights.normal,
    },
    h4: {
        fontSize: FontSizes.h4,
        fontWeight: FontWeights.semibold,
        lineHeight: FontSizes.h4 * LineHeights.normal,
    },

    // Body styles
    bodyLarge: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.large * LineHeights.normal,
    },
    body: {
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.medium * LineHeights.normal,
    },
    bodySmall: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.small * LineHeights.normal,
    },

    // Label styles
    label: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold,
        letterSpacing: LetterSpacings.wide,
    },
    caption: {
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.tiny * LineHeights.normal,
    },

    // Button styles
    button: {
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.semibold,
        letterSpacing: LetterSpacings.wide,
    },
    buttonLarge: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.bold,
        letterSpacing: LetterSpacings.wide,
    },
};
