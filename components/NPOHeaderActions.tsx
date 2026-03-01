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
        <View className="flex-row items-center gap-2.5 h-full">
            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 p-2 rounded-2xl active:scale-90"
            >
                <MessageSquare color="white" size={22} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/notifications" as any)}
                className="relative bg-white/10 p-2 rounded-2xl active:scale-90"
            >
                <Bell color="white" size={22} />
                {unreadCount > 0 && (
                    <View className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border border-white" />
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/(tabs)/profile" as any)}
                className="w-11 h-11 rounded-full border-2 border-white/20 overflow-hidden active:scale-90"
            >
                <UserAvatar size={44} fontSize={15} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );
}
