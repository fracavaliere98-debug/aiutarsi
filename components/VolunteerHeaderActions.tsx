import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Bell, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { UserAvatar } from './UserAvatar';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useChatInboxView } from '../hooks/chat/useChatInboxView';
import { Layout } from '../utils/layout';

export const VolunteerHeaderActions = ({ showAddPost }: { showAddPost?: boolean }) => {
    const router = useRouter();
    const { user } = useAuth();
    const { unreadCount: chatUnreadCount } = useChatInboxView(user?.id);
    const { unreadCount: notificationsUnreadCount } = useNotifications();

    const avatarSize = Layout.isTablet ? 52 : 44;
    const iconSize = avatarSize > 44 ? 22 : 20;

    return (
        <View className="flex-row items-center gap-2" style={{ marginTop: 5 }}>
            <TouchableOpacity
                onPress={() => router.push("/(volunteer)/notifications" as any)}
                className="bg-white/10 rounded-2xl border border-white/20 relative items-center justify-center"
                style={{ width: avatarSize, height: avatarSize }}
            >
                <Bell size={iconSize} color="white" />
                {notificationsUnreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{notificationsUnreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/messages" as any)}
                className="bg-white/10 rounded-2xl border border-white/20 relative mr-1 items-center justify-center"
                style={{ width: avatarSize, height: avatarSize }}
            >
                <MessageCircle size={iconSize} color="white" />
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
                <UserAvatar size={avatarSize} fontSize={avatarSize > 44 ? 18 : 15} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );
};
