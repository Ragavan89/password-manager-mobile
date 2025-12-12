/**
 * Forest Emerald Theme for CredVault
 * Nature-inspired, secure color palette with greens and teals
 */

export const Colors = {
    // Primary - Forest Green (secure, natural, growth)
    primary: {
        start: '#00b894',      // Rich forest green
        end: '#00cec9',        // Vibrant teal
        light: '#a7f3d0',
        dark: '#059669',
        solid: '#00b894',
        opacity: (alpha) => `rgba(0, 184, 148, ${alpha})`,
    },

    // Secondary - Deep Teal (depth, trust)
    secondary: {
        start: '#0984e3',      // Deep blue
        end: '#74b9ff',        // Sky blue
        solid: '#0ea5e9',
        light: '#bae6fd',
    },

    // Accent - Lime Green (energy, freshness)
    accent: {
        start: '#55efc4',      // Bright mint
        end: '#a7f3d0',        // Light mint
        solid: '#10b981',
        light: '#d1fae5',
    },

    // Success - Emerald Green
    success: {
        start: '#10b981',
        end: '#34d399',
        solid: '#10b981',
        light: '#d1fae5',
        dark: '#047857',
    },

    // Warning - Amber
    warning: {
        start: '#f59e0b',
        end: '#fbbf24',
        solid: '#f59e0b',
        light: '#fef3c7',
        dark: '#d97706',
    },

    // Error/Danger - Coral Red
    danger: {
        start: '#ef4444',
        end: '#f87171',
        solid: '#ef4444',
        light: '#fee2e2',
        dark: '#dc2626',
    },

    // Info - Sky Blue
    info: {
        start: '#0ea5e9',
        end: '#38bdf8',
        solid: '#0ea5e9',
        light: '#e0f2fe',
        dark: '#0284c7',
    },

    // Neutral Colors (warm grays with slight green tint)
    neutral: {
        white: '#ffffff',
        black: '#000000',
        gray50: '#f9fafb',
        gray100: '#f3f4f6',
        gray200: '#e5e7eb',
        gray300: '#d1d5db',
        gray400: '#9ca3af',
        gray500: '#6b7280',
        gray600: '#4b5563',
        gray700: '#374151',
        gray800: '#1f2937',
        gray900: '#111827',
    },

    // Background & Surface (clean, natural)
    background: {
        light: '#f9fafb',       // Very light warm gray
        primary: '#ffffff',     // Pure white
        secondary: '#f3f4f6',   // Light gray
        dark: '#111827',        // Deep dark
        darker: '#030712',      // Almost black
        card: '#ffffff',
        cardDark: '#1f2937',
    },

    // Text Colors (high contrast, readable)
    text: {
        primary: '#111827',        // Almost black
        secondary: '#374151',      // Dark gray
        tertiary: '#6b7280',       // Medium gray
        disabled: '#9ca3af',       // Light gray
        inverse: '#ffffff',
        link: '#00b894',           // Primary green for links
        accent: '#10b981',         // Accent green
        primaryDark: '#ffffff',
        secondaryDark: '#d1d5db',
    },

    // Status Colors
    status: {
        online: '#10b981',
        offline: '#6b7280',
        syncing: '#0ea5e9',
        error: '#ef4444',
        pending: '#f59e0b',
    },

    // Natural Shadows (subtle, organic)
    shadow: {
        primary: 'rgba(0, 184, 148, 0.2)',
        secondary: 'rgba(14, 165, 233, 0.2)',
        accent: 'rgba(16, 185, 129, 0.2)',
        success: 'rgba(16, 185, 129, 0.2)',
        danger: 'rgba(239, 68, 68, 0.2)',
        card: 'rgba(0, 0, 0, 0.1)',
        soft: 'rgba(0, 0, 0, 0.05)',
        dark: 'rgba(0, 0, 0, 0.25)',
    },

    // Borders (subtle, natural)
    border: {
        light: '#e5e7eb',
        medium: '#d1d5db',
        dark: '#9ca3af',
        primary: '#00b894',
        accent: '#10b981',
    },

    // Special use cases
    overlay: {
        light: 'rgba(255, 255, 255, 0.95)',
        medium: 'rgba(255, 255, 255, 0.85)',
        dark: 'rgba(0, 0, 0, 0.7)',
        darker: 'rgba(0, 0, 0, 0.85)',
        blur: 'rgba(255, 255, 255, 0.9)',
        glass: 'rgba(249, 250, 251, 0.75)',
    },

    // Premium effects
    premium: {
        gold: '#d97706',
        silver: '#94a3b8',
        bronze: '#c2410c',
        emerald: '#059669',
    },
};

// Forest Emerald Gradients (natural, fresh)
export const Gradients = {
    primary: {
        colors: ['#00b894', '#00cec9'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    secondary: {
        colors: ['#0984e3', '#74b9ff'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    accent: {
        colors: ['#55efc4', '#a7f3d0'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    success: {
        colors: ['#10b981', '#34d399'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    warning: {
        colors: ['#f59e0b', '#fbbf24'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    danger: {
        colors: ['#ef4444', '#f87171'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    info: {
        colors: ['#0ea5e9', '#38bdf8'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    // Special Forest Emerald gradients
    forest: {
        colors: ['#059669', '#10b981', '#34d399'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    ocean: {
        colors: ['#0ea5e9', '#14b8a6'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    mint: {
        colors: ['#10b981', '#6ee7b7'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    nature: {
        colors: ['#84cc16', '#22c55e', '#14b8a6'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    sunrise: {
        colors: ['#f59e0b', '#fbbf24', '#fde047'],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    subtle: {
        colors: ['#ffffff', '#f9fafb'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },
    glass: {
        colors: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },
};

// Natural Shadow presets
export const Shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    small: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    medium: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    large: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
        elevation: 8,
    },
    xlarge: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
    },
    colored: (color) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    }),
    glow: (color) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    }),
};

// Spacing system (for consistent margins/paddings)
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
};

// Border Radius (modern rounded corners)
export const BorderRadius = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    xxxl: 32,
    round: 9999,
};
