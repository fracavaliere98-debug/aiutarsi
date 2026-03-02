import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MessageSquare, Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { UserAvatar } from "./UserAvatar";
import { useNotifications } from "../context/NotificationContext";
import { useChat } from "../context/ChatContext";

export function NPOHeaderActions() {
    const router = useRouter();
    const { unreadCount } = useNotifications();
    const { conversations } = useChat();

    // Unread chat badge: count conversations with unread messages
    const chatUnreadCount = React.useMemo(() => {
        return conversations.reduce((acc, c) => {
            const lastMsg = c.conversations?.messages?.[0];
            if (!lastMsg) return acc;
            const isUnread = lastMsg.created_at > c.last_read_at;
            return isUnread ? acc + 1 : acc;
        }, 0);
    }, [conversations]);

    return (
        <View className="flex-row items-center gap-2.5 h-full">
            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 p-2 rounded-2xl active:scale-90 relative"
            >
                <MessageSquare color="white" size={22} />
                {chatUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-pink-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{chatUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(npo)/notifications" as any)}
                className="relative bg-white/10 p-2 rounded-2xl active:scale-90"
            >
                <Bell color="white" size={22} />
                {unreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{unreadCount}</Text>
                    </View>
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
