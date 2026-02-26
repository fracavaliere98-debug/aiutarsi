import { View, Text, TouchableOpacity } from "react-native";
import { ReactNode } from "react";

interface StatCardProps {
    value: string | number;
    label: string;
    icon?: ReactNode;
    valueColor?: string;
    className?: string;
    onPress?: () => void;
}

export function StatCard({ value, label, icon, valueColor = "text-primary", className = "", onPress }: StatCardProps) {
    const Content = (
        <View className="items-center px-1">
            <View className="flex-row items-center">
                <Text className={`text-2xl font-black ${valueColor} mr-1`} numberOfLines={1}>{value}</Text>
                {icon}
            </View>
            <Text
                className="text-[10px] uppercase font-black text-secondary mt-1 tracking-tight text-center"
                numberOfLines={1}
            >
                {label}
            </Text>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                className={`bg-white py-5 justify-center rounded-[24px] border border-slate-200 shadow-md ${className}`}
            >
                {Content}
            </TouchableOpacity>
        );
    }

    return (
        <View className={`bg-white py-5 justify-center rounded-[24px] border border-slate-200 shadow-md ${className}`}>
            {Content}
        </View>
    );
}
