import { View, Text } from "react-native";
import { ReactNode } from "react";
import { Layout } from "../utils/layout";

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
            style={[{ height: Layout.headerHeight }, containerStyle]}
        >
            <View className="flex-row justify-between items-center">
                <View className="flex-1">
                    <Text 
                        className="text-white/70 font-bold uppercase tracking-widest mb-1"
                        style={{ fontSize: Layout.fontSize.xs }}
                    >
                        {label}
                    </Text>
                    <Text 
                        className="text-white font-black" 
                        style={{ fontSize: Layout.fontSize['2xl'] }}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.7}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text 
                            className="text-white/60 font-medium mt-1"
                            style={{ fontSize: Layout.fontSize.xs }}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.8}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
                {rightElement && (
                    <View className="flex-row items-center gap-2 ml-2">
                        {rightElement}
                    </View>
                )}
            </View>
        </View>
    );
}
