import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MessageSquare, Bell, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { UserAvatar } from "./UserAvatar";
import { useNotifications } from "../context/NotificationContext";
import { useChat } from "../context/ChatContext";

import { Layout } from "../utils/layout";

export function NPOHeaderActions({ showAddPost }: { showAddPost?: boolean }) {
    const router = useRouter();
    const { unreadCount: notifUnreadCount } = useNotifications();
    const { unreadCount: chatUnreadCount } = useChat();

    const avatarSize = Layout.isTablet ? 52 : 44;
    const iconSize = avatarSize > 44 ? 22 : 20;

    return (
        <View className="flex-row items-center gap-2.5 h-full" style={{ marginTop: 5 }}>
            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 rounded-2xl active:scale-90 relative items-center justify-center"
                style={{ width: avatarSize, height: avatarSize }}
            >
                <MessageSquare color="white" size={iconSize} />
                {chatUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-pink-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{chatUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/notifications" as any)}
                className="relative bg-white/10 rounded-2xl active:scale-90 items-center justify-center"
                style={{ width: avatarSize, height: avatarSize }}
            >
                <Bell color="white" size={iconSize} />
                {notifUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{notifUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {showAddPost ? (
                <TouchableOpacity
                    onPress={() => router.push('/community/create-post' as any)}
                    className="bg-white/20 p-2.5 rounded-2xl border border-white/20 active:scale-90"
                    activeOpacity={0.85}
                >
                    <Plus size={iconSize} color="white" />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    onPress={() => router.push("/(npo)/(tabs)/profile" as any)}
                    className="rounded-full border-2 border-white/20 overflow-hidden active:scale-90"
                    style={{ width: avatarSize, height: avatarSize }}
                >
                    <UserAvatar size={avatarSize} fontSize={avatarSize > 44 ? 18 : 15} useAuthFallback={true} />
                </TouchableOpacity>
            )}
        </View>
    );
}
