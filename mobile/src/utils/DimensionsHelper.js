import { useWindowDimensions, Platform } from 'react-native';
import { Dimensions as RNDimensions } from 'react-native';

/**
 * Modern responsive dimensions helper using React hooks
 * Uses useWindowDimensions hook (React Native 0.62+) - preferred over Dimensions API
 * Compatible with React 19 and Expo SDK 54
 */

// Base design dimensions (iPhone X standard)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Hook to get responsive scaling functions
 * Returns scaling utilities that react to screen size changes
 * 
 * @returns {Object} Scaling utilities and device info
 */
export const useResponsiveDimensions = () => {
  const { width, height } = useWindowDimensions();

  /**
   * Scale factor based on screen width
   */
  const scale = (size) => {
    return (width / BASE_WIDTH) * size;
  };

  /**
   * Vertical scale (for heights)
   */
  const verticalScale = (size) => {
    return (height / BASE_HEIGHT) * size;
  };

  /**
   * Moderate scale (less aggressive scaling)
   * Factor 0.3 = moderate, 0.5 = balanced, 1.0 = full scale
   */
  const moderateScale = (size, factor = 0.3) => {
    return size + (scale(size) - size) * factor;
  };

  /**
   * Check if device is tablet (width >= 768px)
   */
  const isTablet = width >= 768;

  /**
   * Check if device is small phone (width < 360px)
   */
  const isSmallPhone = width < 360;

  /**
   * Responsive font size with device-specific adjustments
   */
  const responsiveFontSize = (size, scaleFactor = 0.3) => {
    const scaled = moderateScale(size, scaleFactor);
    
    // Tablet: 20% larger for better readability
    if (isTablet) {
      return scaled * 1.2;
    }
    
    // Small phone: 10% smaller to fit content
    if (isSmallPhone) {
      return scaled * 0.9;
    }
    
    return scaled;
  };

  return {
    width,
    height,
    scale,
    verticalScale,
    moderateScale,
    isTablet,
    isSmallPhone,
    responsiveFontSize,
  };
};

/**
 * Predefined font sizes following a scale system
 * Use these constants for consistency across the app
 */
export const useFontSizes = () => {
  const { responsiveFontSize } = useResponsiveDimensions();

  return {
    xs: responsiveFontSize(10),
    sm: responsiveFontSize(12),
    base: responsiveFontSize(14),
    md: responsiveFontSize(16),
    lg: responsiveFontSize(18),
    xl: responsiveFontSize(20),
    '2xl': responsiveFontSize(24),
    '3xl': responsiveFontSize(28),
    '4xl': responsiveFontSize(32),
    '5xl': responsiveFontSize(40),
    '6xl': responsiveFontSize(48),
    '7xl': responsiveFontSize(60),
  };
};

/**
 * Standalone utility functions (for use outside React components)
 * Falls back to Dimensions API for class components or utilities
 */
export const getScreenDimensions = () => {
  // Try to get from window if available (for hooks)
  // Fall back to Dimensions API for non-hook usage
  try {
    const { width, height } = RNDimensions.get('window');
    return {
      width,
      height,
      isTablet: width >= 768,
      isSmallPhone: width < 360,
    };
  } catch (error) {
    // Fallback
    return {
      width: 375,
      height: 812,
      isTablet: false,
      isSmallPhone: false,
    };
  }
};
