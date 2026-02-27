import React from "react";
import { View, TouchableOpacity } from "react-native";
import { MessageSquare, Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { UserAvatar } from "./UserAvatar";
import { useNotifications } from "../context/NotificationContext";

export function NPOHeaderActions() {
    const router = useRouter();
    const { unreadCount } = useNotifications();

    return (
        <View className="flex-row items-center gap-3 h-full">
            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 p-2 rounded-2xl active:scale-90"
            >
                <MessageSquare color="white" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/notifications" as any)}
                className="relative bg-white/10 p-2 rounded-2xl active:scale-90"
            >
                <Bell color="white" size={20} />
                {unreadCount > 0 && (
                    <View className="absolute top-2.5 right-2.5 w-2 h-2 bg-secondary rounded-full border border-white" />
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/(tabs)/profile" as any)}
                className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden active:scale-90"
            >
                <UserAvatar size={40} fontSize={14} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );
}
