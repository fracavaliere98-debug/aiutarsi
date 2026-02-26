import { ScrollView, View, TouchableOpacity, Text } from "react-native";
import { ReactNode } from "react";
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
}

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
    refreshControl
}: StandardLayoutProps) {
    const { user } = useAuth();
    const Content = noScroll ? View : ScrollView;

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
                style={{ height: 104 }}
            >
                <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center flex-1 gap-4">
                        {onBack && (
                            <TouchableOpacity onPress={onBack} className="bg-white/10 p-2 rounded-full">
                                <ArrowLeft size={20} color="white" />
                            </TouchableOpacity>
                        )}
                        <View className="flex-1">
                            <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{label}</Text>
                            <Text className="text-white text-2xl font-black" numberOfLines={1}>{title}</Text>
                            {subtitle && (
                                <Text className="text-white/60 text-xs font-medium mt-1">{subtitle}</Text>
                            )}
                        </View>
                    </View>
                    {rightElement && (
                        <View className="flex-row items-center gap-4 ml-4">
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
