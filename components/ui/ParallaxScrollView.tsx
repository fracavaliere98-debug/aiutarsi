
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedRef,
    useAnimatedStyle,
    useScrollViewOffset,
} from 'react-native-reanimated';

const HEADER_HEIGHT = 300;

interface ParallaxScrollViewProps {
    children: React.ReactNode;
    headerImage: React.ReactElement;
    headerBackgroundColor: { dark: string; light: string };
}

export default function ParallaxScrollView({
    children,
    headerImage,
    headerBackgroundColor,
}: ParallaxScrollViewProps) {
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffset = useScrollViewOffset(scrollRef);

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollOffset.value,
                        [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
                        [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
                    ),
                },
                {
                    scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
                },
            ],
        };
    });

    return (
        <View style={styles.container}>
            <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
                <Animated.View
                    style={[
                        styles.header,
                        { backgroundColor: headerBackgroundColor.light },
                        headerAnimatedStyle,
                    ]}>
                    {headerImage}
                </Animated.View>
                <View style={styles.content}>{children}</View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff', // White background
    },
    header: {
        height: HEADER_HEIGHT,
        overflow: 'hidden',
        position: 'absolute', // Fixed position for parallax? No, absolute in ScrollView context?
        // Actually, traditionally Parallax puts the image at top with negative margin or absolute at top of container
        // But this component logic puts it INSIDE scroll view but translates it.
        // Let's stick to standard reanimated pattern: 
        // If it is absolute, it doesn't push content. 
        // So content needs top margin.
        width: '100%',
        top: 0,
        left: 0,
        zIndex: 0, // Behind content
    },
    content: {
        flex: 1,
        paddingTop: HEADER_HEIGHT - 30, // Overlap slightly
        backgroundColor: 'transparent',
    },
});
