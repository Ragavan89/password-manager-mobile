/**
 * Modern Typography System for CredVault
 * Clean, readable font hierarchy optimized for mobile
 */

export const FontFamilies = {
    // System fonts optimized for each platform
    heading: 'System',    // Can be replaced with 'Inter-Bold' or 'Poppins-Bold'
    body: 'System',       // Can be replaced with 'Inter-Regular' or 'Poppins-Regular'
    mono: 'Courier',      // Monospace for passwords and codes
};

export const FontSizes = {
    // Display (Extra Large) - Hero text
    display: {
        large: 48,
        medium: 40,
        small: 32,
    },

    // Headings - Section titles
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    h5: 16,
    h6: 14,

    // Body - Main content
    xlarge: 20,
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
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
};

export const LetterSpacings = {
    tighter: -1,
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
};

// Predefined text styles for consistency
export const TextStyles = {
    // Display styles - Hero/Marketing text
    displayLarge: {
        fontSize: FontSizes.display.large,
        fontWeight: FontWeights.black,
        lineHeight: FontSizes.display.large * LineHeights.tight,
        letterSpacing: LetterSpacings.tight,
    },
    displayMedium: {
        fontSize: FontSizes.display.medium,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.display.medium * LineHeights.tight,
        letterSpacing: LetterSpacings.tight,
    },
    displaySmall: {
        fontSize: FontSizes.display.small,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.display.small * LineHeights.snug,
    },

    // Heading styles - Section titles
    h1: {
        fontSize: FontSizes.h1,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.h1 * LineHeights.snug,
        letterSpacing: LetterSpacings.tight,
    },
    h2: {
        fontSize: FontSizes.h2,
        fontWeight: FontWeights.bold,
        lineHeight: FontSizes.h2 * LineHeights.snug,
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
    h5: {
        fontSize: FontSizes.h5,
        fontWeight: FontWeights.semibold,
        lineHeight: FontSizes.h5 * LineHeights.normal,
    },
    h6: {
        fontSize: FontSizes.h6,
        fontWeight: FontWeights.semibold,
        lineHeight: FontSizes.h6 * LineHeights.normal,
    },

    // Body styles - Main content
    bodyXLarge: {
        fontSize: FontSizes.xlarge,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.xlarge * LineHeights.relaxed,
    },
    bodyLarge: {
        fontSize: FontSizes.large,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.large * LineHeights.relaxed,
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

    // Label styles - Forms and metadata
    label: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold,
        letterSpacing: LetterSpacings.wide,
        textTransform: 'uppercase',
    },
    labelMedium: {
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.semibold,
        letterSpacing: LetterSpacings.wider,
        textTransform: 'uppercase',
    },
    caption: {
        fontSize: FontSizes.tiny,
        fontWeight: FontWeights.regular,
        lineHeight: FontSizes.tiny * LineHeights.normal,
    },

    // Button styles - Interactive elements
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
    buttonSmall: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold,
        letterSpacing: LetterSpacings.normal,
    },

    // Link styles
    link: {
        fontSize: FontSizes.medium,
        fontWeight: FontWeights.medium,
        textDecorationLine: 'underline',
    },

    // Code/Monospace styles - For passwords and technical text
    code: {
        fontSize: FontSizes.small,
        fontFamily: FontFamilies.mono,
        lineHeight: FontSizes.small * LineHeights.normal,
    },
};
