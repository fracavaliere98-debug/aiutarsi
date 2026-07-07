import { View, Text, TouchableOpacity } from "react-native";
import { ReactNode } from "react";
import { colors } from "@/theme";

interface StatCardProps {
    value: string | number;
    label: string;
    icon?: ReactNode;
    /** Color value (e.g. colors.primary), not a Tailwind class. */
    valueColor?: string;
    className?: string;
    onPress?: () => void;
    testID?: string;
    /** Reduces vertical padding and value text size for dense multi-card rows. */
    compact?: boolean;
}

export function StatCard({ value, label, icon, valueColor = colors.primary, className = "", onPress, testID, compact = false }: StatCardProps) {
    const Content = (
        <View className="items-center px-1">
            <View className="flex-row items-center">
                <Text className={`${compact ? "text-xl" : "text-2xl"} font-black mr-1`} style={{ color: valueColor }} numberOfLines={1}>{value}</Text>
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
                className={`bg-white ${compact ? "py-3" : "py-5"} justify-center rounded-[24px] border border-slate-200 shadow-md ${className}`}
                testID={testID}
            >
                {Content}
            </TouchableOpacity>
        );
    }

    return (
        <View className={`bg-white ${compact ? "py-3" : "py-5"} justify-center rounded-[24px] border border-slate-200 shadow-md ${className}`} testID={testID}>
            {Content}
        </View>
    );
}
