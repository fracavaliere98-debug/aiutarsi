import { View, Text, TouchableOpacity } from "react-native";
import { ReactNode } from "react";

interface PageHeaderProps {
    label: string;
    title: string;
    rightElement?: ReactNode;
    subtitle?: string;
    containerStyle?: any;
}

export function PageHeader({ label, title, rightElement, subtitle, containerStyle }: PageHeaderProps) {
    return (
        <View
            className="bg-primary pt-6 pb-4 px-6 rounded-b-[32px] shadow-lg mb-4 justify-center"
            style={[{ height: 104 }, containerStyle]}
        >
            <View className="flex-row justify-between items-center">
                <View className="flex-1">
                    <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{label}</Text>
                    <Text className="text-white text-2xl font-black" numberOfLines={1}>{title}</Text>
                    {subtitle && (
                        <Text className="text-white/60 text-xs font-medium mt-1">{subtitle}</Text>
                    )}
                </View>
                {rightElement && (
                    <View className="flex-row items-center gap-4">
                        {rightElement}
                    </View>
                )}
            </View>
        </View>
    );
}
