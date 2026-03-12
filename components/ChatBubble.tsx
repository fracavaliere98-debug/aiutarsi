import React from 'react';
import { View, Text, Image } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { Check, CheckCheck } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { MessageRichPreview } from './MessageRichPreview';

interface ChatBubbleProps {
    message: string;
    isOwn: boolean;
    timestamp: string;
    senderName?: string;
    avatarUrl?: string;
    isRead?: boolean;
}

const isImageUrl = (text: string) =>
    text.startsWith('https://') &&
    (text.includes('/storage/v1/object/public/') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(text));

export function ChatBubble({ message, isOwn, timestamp, senderName, avatarUrl, isRead }: ChatBubbleProps) {
    return (
        <View className={`flex-row w-full mb-6 relative px-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!isOwn && (
                <View className="mr-2 justify-end pb-4">
                    <UserAvatar name={senderName || 'Utente'} size={32} fontSize={12} avatarUrl={avatarUrl} />
                </View>
            )}

            <View style={{ maxWidth: '75%' }}>
                {!isOwn && senderName && (
                    <Text className="text-xs text-gray-400 mb-1 ml-1">{senderName}</Text>
                )}

                <View className={`p-4 rounded-2xl ${isOwn ? 'bg-primary rounded-br-sm' : 'bg-[#F4F4F6] rounded-bl-sm'}`}>
                    {isImageUrl(message) ? (
                        <Image
                            source={{ uri: message }}
                            style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 4 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className={`text-[15px] leading-5 ${isOwn ? 'text-white' : 'text-[#333333]'}`}>
                            {message}
                        </Text>
                    )}
                </View>

                {/* Rich preview below the bubble (links, maps, PDFs) */}
                {!isImageUrl(message) && (
                    <MessageRichPreview text={message} />
                )}

                <View className={`mt-1 flex-row items-center ${isOwn ? 'justify-end' : 'justify-start ml-1'}`}>
                    <Text className="text-[11px] text-gray-400 font-medium">{timestamp}</Text>
                    {isOwn && (
                        <View className="ml-1">
                            {isRead ? (
                                <CheckCheck size={14} color="#3b82f6" />
                            ) : (
                                <Check size={14} color="#94a3b8" />
                            )}
                        </View>
                    )}
                </View>
            </View>

            {isOwn && (
                <View className="ml-2 justify-end pb-4">
                    <UserAvatar name="Tu" size={32} fontSize={12} avatarUrl={avatarUrl} />
                </View>
            )}
        </View>
    );
}
