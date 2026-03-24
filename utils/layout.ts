import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scale value based on screen width
 */
export const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scale value based on screen height
 */
export const verticalScale = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Moderate scaling for text and smaller elements
 */
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Returns a size that is responsive but capped to avoid extreme variations
 */
export const responsiveSize = (size: number) => {
    const scaled = scale(size);
    // Limit growth to 20% on very large screens (tablets) for headers to avoid giant icons
    if (SCREEN_WIDTH > 600) return size * 1.25;
    return scaled;
};

export const Layout = {
    window: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    isSmallDevice: SCREEN_WIDTH < 375,
    isTablet: SCREEN_WIDTH > 600,
    headerHeight: verticalScale(104),
    // Standard font sizes that scale nicely
    fontSize: {
        xs: moderateScale(12),
        sm: moderateScale(14),
        base: moderateScale(16),
        lg: moderateScale(18),
        xl: moderateScale(20),
        '2xl': moderateScale(24),
        '3xl': moderateScale(30),
    },
    // Icon sizes that scale moderately
    iconSize: {
        sm: moderateScale(18),
        md: moderateScale(22),
        lg: moderateScale(26),
    }
};
