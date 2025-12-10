/**
 * Minimal & Eye-Friendly Color Theme
 * Soft, neutral colors designed for comfortable viewing
 */

export const Colors = {
    // Primary - Soft Blue (professional, calming)
    primary: {
        start: '#5b9bd5',      // Soft blue
        end: '#4a8cc7',        // Slightly deeper
        light: '#7eb3e3',
        dark: '#3a7db8',
        solid: '#5b9bd5',
        opacity: (alpha) => `rgba(91, 155, 213, ${alpha})`,
    },

    // Accent - Subtle Teal (minimal accent)
    accent: {
        start: '#6ba3b8',
        end: '#5a94a8',
        solid: '#6ba3b8',
    },

    // Success - Natural Green
    success: {
        start: '#77b87d',
        end: '#69a86f',
        solid: '#77b87d',
        light: '#e8f5e9',
        dark: '#5a9860',
    },

    // Warning - Warm Orange
    warning: {
        start: '#e09145',
        end: '#d88538',
        solid: '#e09145',
        light: '#fff4e6',
        dark: '#c97a32',
    },

    // Error/Danger - Gentle Red
    danger: {
        start: '#e57373',
        end: '#d86565',
        solid: '#e57373',
        light: '#ffebee',
        dark: '#c96262',
    },

    // Info - Soft Blue
    info: {
        start: '#64b5f6',
        end: '#54a5e6',
        solid: '#64b5f6',
        light: '#e3f2fd',
        dark: '#4a95d6',
    },

    // Neutral Colors (main UI colors)
    neutral: {
        white: '#ffffff',
        black: '#000000',
        gray50: '#fafbfc',
        gray100: '#f5f7fa',
        gray200: '#e4e7eb',
        gray300: '#d1d5db',
        gray400: '#9ca3af',
        gray500: '#6b7280',
        gray600: '#4b5563',
        gray700: '#374151',
        gray800: '#1f2937',
        gray900: '#111827',
    },

    // Background & Surface (very light and clean)
    background: {
        light: '#fafbfc',
        dark: '#1a1a2e',
        card: '#ffffff',
        cardDark: '#16213e',
    },

    // Text Colors (readable, not harsh)
    text: {
        primary: '#2c3e50',      // Soft dark gray instead of pure black
        secondary: '#6b7280',    // Medium gray
        disabled: '#9ca3af',     // Light gray
        inverse: '#ffffff',
        primaryDark: '#ffffff',
        secondaryDark: '#adb5bd',
    },

    // Status Colors
    status: {
        online: '#77b87d',
        offline: '#9ca3af',
        syncing: '#5b9bd5',
        error: '#e57373',
    },

    // Shadows (very subtle)
    shadow: {
        primary: 'rgba(91, 155, 213, 0.15)',
        success: 'rgba(119, 184, 125, 0.15)',
        danger: 'rgba(229, 115, 115, 0.15)',
        card: 'rgba(0, 0, 0, 0.08)',
    },

    // Minimal borders
    border: {
        light: '#e4e7eb',
        medium: '#d1d5db',
        dark: '#9ca3af',
    },
};

// Simplified Gradients (very subtle)
export const Gradients = {
    primary: {
        colors: [Colors.primary.start, Colors.primary.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    accent: {
        colors: [Colors.accent.start, Colors.accent.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    success: {
        colors: [Colors.success.start, Colors.success.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    warning: {
        colors: [Colors.warning.start, Colors.warning.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    danger: {
        colors: [Colors.danger.start, Colors.danger.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    info: {
        colors: [Colors.info.start, Colors.info.end],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
    },
    subtle: {
        colors: ['#ffffff', '#f8f9fa'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
    },
};

// Softer Shadow presets
export const Shadows = {
    small: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    medium: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    large: {
        shadowColor: Colors.shadow.card,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    colored: (color) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    }),
};
