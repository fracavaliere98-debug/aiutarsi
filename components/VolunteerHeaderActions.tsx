import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Bell, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { UserAvatar } from './UserAvatar';
import { useChat } from '../context/ChatContext';
import { useNotifications } from '../context/NotificationContext';
import { Colors } from '../constants/Colors';

export const VolunteerHeaderActions = () => {
    const router = useRouter();
    const { unreadCount: chatUnreadCount } = useChat();
    const { unreadCount: notificationsUnreadCount } = useNotifications();

    return (
        <View className="flex-row items-center gap-2">
            <TouchableOpacity
                onPress={() => router.push("/(volunteer)/notifications" as any)}
                className="bg-white/10 p-2.5 rounded-2xl border border-white/20 relative"
            >
                <Bell size={22} color="white" />
                {notificationsUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{notificationsUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 p-2.5 rounded-2xl border border-white/20 relative mr-1"
            >
                <MessageCircle size={22} color="white" />
                {chatUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-pink-600 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{chatUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(volunteer)/profile" as any)}
                className="ml-0.5"
            >
                <UserAvatar size={44} fontSize={15} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );
};
