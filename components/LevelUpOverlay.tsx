import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Share } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    withDelay,
    runOnJS
} from 'react-native-reanimated';
import { Award, Star, Share2, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useGamificationLevelUp } from '../hooks/gamification/useGamificationLevelUp';
import { colors } from "@/theme";

export const LevelUpOverlay = () => {
    const { user } = useAuth();
    const { levelUpData, dismissLevelUp } = useGamificationLevelUp(user);

    // Animation Values
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const starScale = useSharedValue(0);
    const badgeRotate = useSharedValue(0);

    useEffect(() => {
        if (levelUpData) {
            // Reset values
            scale.value = 0;
            opacity.value = 0;
            starScale.value = 0;
            badgeRotate.value = 0;

            // Start Sequence
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1, { damping: 20, stiffness: 90 });

            // Stars pop in after card
            starScale.value = withDelay(400, withSpring(1, { damping: 15 }));

            // Badge gentle rotation
            badgeRotate.value = withDelay(300,
                withSequence(
                    withTiming(-10, { duration: 100 }),
                    withTiming(10, { duration: 100 }),
                    withTiming(-5, { duration: 100 }),
                    withTiming(5, { duration: 100 }),
                    withTiming(0, { duration: 100 })
                )
            );
        }
    }, [badgeRotate, levelUpData, opacity, scale, starScale]);

    const handleDismiss = () => {
        opacity.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(dismissLevelUp)();
        });
    };

    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }]
    }));

    const animatedStarStyle = useAnimatedStyle(() => ({
        transform: [{ scale: starScale.value }]
    }));

    const animatedBadgeStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${badgeRotate.value}deg` }]
    }));

    if (!levelUpData) return null;

    return (
        <Modal transparent visible={!!levelUpData} animationType="none">
            <View className="flex-1 bg-black/60 items-center justify-center px-6">

                {/* Main Card */}
                <Animated.View
                    className="bg-white w-full rounded-3xl p-8 items-center shadow-2xl border-4 border-accent relative overflow-hidden"
                    style={animatedContainerStyle}
                >
                    {/* Background decoration */}
                    <View className="absolute top-0 left-0 right-0 h-32 bg-indigo-50 rounded-t-2xl -z-10" />

                    {/* Close Button */}
                    <TouchableOpacity
                        onPress={handleDismiss}
                        className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"
                    >
                        <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Stars Decoration */}
                    <Animated.View className="absolute -top-6 -left-6" style={animatedStarStyle}>
                        <Star size={60} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.2 }} />
                    </Animated.View>
                    <Animated.View className="absolute top-10 right-10" style={animatedStarStyle}>
                        <Star size={30} color="#fbbf24" fill="#fbbf24" style={{ opacity: 0.3 }} />
                    </Animated.View>

                    {/* Icon */}
                    <Animated.View
                        className="bg-accent rounded-full p-6 mb-4 border-4 border-white shadow-lg"
                        style={animatedBadgeStyle}
                    >
                        <Award size={64} color="white" />
                        <TouchableOpacity
                            className="absolute -bottom-2 -right-2 bg-white/20 p-4 rounded-full"
                            onPress={async () => {
                                try {
                                    await Share.share({
                                        message: `🎉 Ho appena raggiunto il livello ${levelUpData.level} su AiutarSì!\n\nScarica l'app e unisciti a me:\n🌐 https://aiutarsi.app/`,
                                    });
                                } catch (error) {
                                    console.error("Error sharing level up:", error);
                                }
                            }}
                        >
                            <Share2 size={24} color="white" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Text Content */}
                    <Text className="text-3xl font-black text-primary mb-1 text-center uppercase tracking-wider">
                        Level Up!
                    </Text>
                    <Text className="text-gray-500 font-medium text-center mb-6">
                        Hai raggiunto un nuovo traguardo
                    </Text>

                    {/* Level Number */}
                    <View className="items-center mb-8">
                        <Text className="text-6xl font-black text-accent drop-shadow-md">
                            {levelUpData.level}
                        </Text>
                        <Text className="text-xs font-bold text-gray-400 uppercase tracking-[4px]">
                            Livello Attuale
                        </Text>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                        onPress={handleDismiss}
                        className="bg-primary w-full py-4 rounded-xl shadow-lg active:scale-95 transition-transform"
                    >
                        <Text className="text-white text-center font-bold text-lg">
                            Continua così! 🚀
                        </Text>
                    </TouchableOpacity>

                </Animated.View>
            </View>
        </Modal>
    );
};
