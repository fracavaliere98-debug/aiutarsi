import { ScrollView, View, TouchableOpacity, Text } from "react-native";
import { ReactNode } from "react";
import { useRouter } from "expo-router";
import { ScreenWrapper } from "./ScreenWrapper";
import { ArrowLeft } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";

interface StandardLayoutProps {
    children: ReactNode;
    label: string;
    title: string;
    rightElement?: ReactNode;
    subtitle?: string;
    bg?: string;
    headerBg?: string; // Allow manual override
    noScroll?: boolean;
    noPadding?: boolean;
    headerSlot?: ReactNode;
    onBack?: () => void;
    refreshControl?: ReactNode;
    hideBack?: boolean;
}

import { Layout } from "../utils/layout";

export function StandardLayout({
    children,
    label,
    title,
    rightElement,
    subtitle,
    bg = "bg-gray-50",
    headerBg,
    noScroll = false,
    noPadding = false,
    headerSlot,
    onBack,
    refreshControl,
    hideBack = false
}: StandardLayoutProps) {
    const { user } = useAuth();
    const router = useRouter();
    const Content = noScroll ? View : ScrollView;

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (router.canGoBack()) {
            router.back();
        }
    };

    // Show back button if (onBack is provided OR if we can go back) AND hideBack is false
    const showBackButton = !hideBack && (onBack || router.canGoBack());

    // Determine header color based on role if not provided
    const getHeaderColor = () => {
        if (headerBg) return headerBg;
        if (user?.role === "NPO") return "bg-accent"; // Explicitly match IA button color
        if (user?.role === "CORPORATE") return "bg-corporate";
        return "bg-primary";
    };

    return (
        <ScreenWrapper bg={bg} className="px-0" withPadding={false} edges={["top"]}>
            <View
                className={`${getHeaderColor()} pt-6 pb-4 px-6 rounded-b-[32px] shadow-lg mb-4 justify-center`}
                style={{ height: Layout.headerHeight }}
            >
                <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center flex-1 gap-4">
                        {showBackButton && (
                            <TouchableOpacity onPress={handleBack} className="bg-white/10 p-2 rounded-full">
                                <ArrowLeft size={Layout.iconSize.md} color="white" />
                            </TouchableOpacity>
                        )}
                        <View className="flex-1">
                            <Text 
                                className="text-white/70 font-bold uppercase tracking-widest mb-1" 
                                style={{ fontSize: Layout.fontSize.xs }}
                                numberOfLines={1}
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
                    </View>
                    {rightElement && (
                        <View className="flex-row items-center gap-2 ml-2">
                            {rightElement}
                        </View>
                    )}
                </View>
                {headerSlot && <View className="mt-1">{headerSlot}</View>}
            </View>

            <Content
                className="flex-1"
                contentContainerStyle={!noScroll ? { paddingBottom: 40, paddingHorizontal: noPadding ? 0 : 24 } : undefined}
                style={noScroll ? { flex: 1, paddingHorizontal: noPadding ? 0 : 24 } : { flex: 1 }}
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl as any}
            >
                {children}
            </Content>
        </ScreenWrapper>
    );
}
