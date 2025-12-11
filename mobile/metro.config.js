const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration for React Native
 * 
 * Optimizations:
 * - Enhanced minification for production builds
 * - Tree shaking for dead code elimination
 * - Improved compression settings
 * 
 * Note: Icon font optimization removed as it conflicts with Expo's bundling.
 * Hermes + ProGuard will handle most size reduction instead.
 * 
 * @see https://facebook.github.io/metro/docs/configuration
 */
const config = getDefaultConfig(__dirname);

// Enhanced minification for production builds
config.transformer.minifierConfig = {
    keep_classnames: true, // Preserve class names for debugging
    keep_fnames: false,     // Remove function names to save space
    mangle: {
        keep_classnames: true,
        keep_fnames: false,
    },
    compress: {
        // Remove console statements (backup to babel plugin)
        drop_console: false, // Handled by babel plugin
        // Remove debugger statements
        drop_debugger: true,
        // Evaluate constant expressions
        evaluate: true,
        // Optimize if-return and if-continue
        if_return: true,
        // Join consecutive var statements
        join_vars: true,
        // Remove unreachable code
        dead_code: true,
        // Remove unused code
        unused: true,
    },
};

module.exports = config;
