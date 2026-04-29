import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { BellOff, Check } from 'lucide-react-native';

interface ConversationListItemProps {
    title: string;
    lastMessage: string;
    timestamp: string;
    unreadCount?: number;
    avatarUrl?: string;
    isGroup?: boolean;
    lastSenderName?: string;
    isOwnLastMessage?: boolean;
    isMuted?: boolean;
    onPress: () => void;
}

export function ConversationListItem({
    title,
    lastMessage,
    timestamp,
    unreadCount = 0,
    avatarUrl,
    isGroup,
    lastSenderName,
    isOwnLastMessage,
    isMuted,
    onPress
}: ConversationListItemProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={`flex-row items-center py-4 px-5 border-b border-gray-100 ${unreadCount > 0 ? 'bg-primary/5' : 'bg-white'}`}
        >
            <View className="relative mr-4">
                <View className={`rounded-full p-0.5 ${unreadCount > 0 ? 'border-2 border-primary/20' : 'border border-transparent'}`}>
                    <UserAvatar name={title} size={54} fontSize={20} avatarUrl={avatarUrl} />
                </View>
                {isGroup && (
                    <View className="absolute -bottom-1 -right-1 bg-pink-600 px-1.5 py-0.5 rounded-full border border-white">
                        <Text className="text-[9px] font-black text-white">ACT</Text>
                    </View>
                )}
            </View>

            <View className="flex-1 justify-center">
                <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-[16px] font-bold text-slate-800" numberOfLines={1}>
                        {title}
                    </Text>
                    <View className="flex-row items-center ml-3">
                        {isMuted ? (
                            <BellOff size={13} color="#94a3b8" style={{ marginRight: 4 }} />
                        ) : null}
                        <Text className={`text-[12px] font-medium ${unreadCount > 0 ? 'text-primary' : 'text-slate-400'}`}>
                            {timestamp}
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center pr-4">
                    {isOwnLastMessage && !unreadCount && (
                        <Check size={14} color="#94a3b8" className="mr-1" />
                    )}
                    <Text
                        className={`text-[14px] flex-1 ${unreadCount > 0 ? 'font-bold text-slate-700' : 'text-slate-500'}`}
                        numberOfLines={1}
                    >
                        {isGroup && lastSenderName && !isOwnLastMessage && (
                            <Text className="font-bold text-primary">{lastSenderName}: </Text>
                        )}
                        {lastMessage || "Nessun messaggio"}
                    </Text>
                </View>
                {unreadCount > 0 ? (
                    <Text className="mt-1 text-[11px] font-black uppercase tracking-[1.4px] text-primary">
                        Nuovi messaggi
                    </Text>
                ) : null}
            </View>

            {unreadCount > 0 && (
                <View className="absolute right-5 bottom-4 bg-[#e11d48] min-w-[22px] h-[22px] px-1.5 rounded-full items-center justify-center">
                    <Text className="text-white text-[11px] font-black">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
