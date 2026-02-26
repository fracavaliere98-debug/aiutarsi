import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';

/**
 * Custom hook for list item stagger animation
 * Items fade in and slide up with a delay based on their index
 * @param index - Position of the item in the list
 * @param delay - Delay between each item animation (default: 50ms)
 */
export const useListItemAnimation = (index: number, delay: number = 50) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        opacity.value = withDelay(
            index * delay,
            withTiming(1, { duration: 300 })
        );
        translateY.value = withDelay(
            index * delay,
            withTiming(0, { duration: 300 })
        );
    }, [index, delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return animatedStyle;
};
