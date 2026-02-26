import { View, TouchableOpacity, ViewStyle } from "react-native";
import Animated from 'react-native-reanimated';
import { ReactNode } from "react";
import { useCardPressAnimation } from "../hooks/useCardAnimation";

interface SoftCardProps {
    children: ReactNode;
    className?: string;
    onPress?: () => void;
    style?: ViewStyle;
}

export function SoftCard({ children, className = "", onPress, style }: SoftCardProps) {
    const baseClasses = "bg-white rounded-[32px] shadow-sm border border-slate-100";
    const combinedClasses = `${baseClasses} ${className}`;
    const { animatedStyle, onPressIn, onPressOut } = useCardPressAnimation();

    if (onPress) {
        return (
            <Animated.View style={animatedStyle}>
                <TouchableOpacity
                    className={combinedClasses}
                    style={style}
                    onPress={onPress}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    activeOpacity={0.9}
                >
                    {children}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return (
        <View className={combinedClasses} style={style}>
            {children}
        </View>
    );
}
