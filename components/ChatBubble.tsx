import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { UserAvatar } from './UserAvatar';

interface ChatBubbleProps {
    message: string;
    isOwn: boolean;
    timestamp: string;
    senderName?: string;
    avatarUrl?: string;
    isRead?: boolean;
}

export function ChatBubble({ message, isOwn, timestamp, senderName, avatarUrl, isRead }: ChatBubbleProps) {
    return (
        <View className={`flex-row w-full mb-6 relative px-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!isOwn && (
                <View className="mr-2 justify-end pb-4">
                    <UserAvatar name={senderName || "OldUser"} size={32} fontSize={12} avatarUrl={avatarUrl} />
                </View>
            )}

            <View style={{ maxWidth: '75%' }}>
                {!isOwn && senderName && (
                    <Text className="text-xs text-gray-400 mb-1 ml-1">{senderName}</Text>
                )}
                <View
                    className={`p-4 rounded-2xl ${isOwn
                        ? 'bg-primary rounded-br-sm'
                        : 'bg-[#F4F4F6] rounded-bl-sm'
                        }`}
                >
                    <Text className={`text-[15px] leading-5 ${isOwn ? 'text-white' : 'text-[#333333]'}`}>
                        {message}
                    </Text>
                </View>

                <View className={`mt-1 flex-row items-center ${isOwn ? 'justify-end' : 'justify-start ml-1'}`}>
                    <Text className="text-[11px] text-gray-400 font-medium">
                        {timestamp}
                    </Text>
                    {isOwn && (
                        <Text className={`ml-1 text-[11px] font-bold ${isRead ? 'text-accent' : 'text-gray-400'}`}>
                            {isRead ? '✓✓' : '✓'}
                        </Text>
                    )}
                </View>
            </View>

            {isOwn && (
                <View className="ml-2 justify-end pb-4">
                    <UserAvatar name={"Tu"} size={32} fontSize={12} avatarUrl={avatarUrl} />
                </View>
            )}
        </View>
    );
}
