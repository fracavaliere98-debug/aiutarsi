import { View, Text } from "react-native";
import { ReactNode } from "react";

interface BadgePillProps {
    label: string;
    icon?: ReactNode;
    bgColor?: string;
    textColor?: string;
    className?: string;
}

export function BadgePill({
    label,
    icon,
    bgColor = "bg-accent/10",
    textColor = "text-accent",
    className = ""
}: BadgePillProps) {
    return (
        <View className={`${bgColor} px-3 py-1.5 rounded-full flex-row items-center gap-1.5 ${className}`}>
            {icon}
            <Text className={`${textColor} text-xs font-bold`}>{label}</Text>
        </View>
    );
}
