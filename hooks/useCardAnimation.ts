import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

/**
 * Custom hook for card press animation
 * Provides scale animation on press with spring physics
 */
export const useCardPressAnimation = () => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const onPressIn = () => {
        scale.value = withSpring(0.95, {
            damping: 15,
            stiffness: 150,
        });
    };

    const onPressOut = () => {
        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 150,
        });
    };

    return { animatedStyle, onPressIn, onPressOut };
};
