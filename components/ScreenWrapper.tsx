import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View, KeyboardAvoidingView, Platform } from "react-native";

interface ScreenWrapperProps {
    children: React.ReactNode;
    className?: string;
    bg?: string;
    withPadding?: boolean;
    edges?: Edge[];
}

export function ScreenWrapper({
    children,
    className,
    bg = "bg-background-light",
    withPadding = true,
    edges
}: ScreenWrapperProps) {
    return (
        <SafeAreaView edges={edges} className={`flex-1 ${bg}`}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
                style={{ flex: 1 }}
            >
                <View className={`flex-1 ${withPadding ? "px-4" : ""} ${className}`}>{children}</View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
