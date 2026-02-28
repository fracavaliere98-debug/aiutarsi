import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, MoreVertical, Plus, Smile, Send } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components/ChatBubble';
import { Colors } from '../../constants/Colors';
import ChatService from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [conversation, setConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!user || !id) return;

        const loadChat = async () => {
            try {
                const data = await ChatService.getConversationDetails(id as string);
                setConversation(data);
                // Reverse for FlatList inverted
                const sortedMessages = [...(data.messages || [])].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setMessages(sortedMessages);

                // Mark as read
                await ChatService.markAsRead(id as string, user.id);
            } catch (error) {
                console.error("Failed to load conversation", error);
            }
        };

        loadChat();

        const channel = supabase.channel(`public:messages:conv_${id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
                (payload) => {
                    const newMsg = payload.new;
                    setMessages(prev => [newMsg, ...prev]);
                    if (newMsg.sender_id !== user.id) {
                        ChatService.markAsRead(id as string, user.id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user]);

    const handleSend = async () => {
        if (!inputText.trim() || !user || !id) return;

        const textToSent = inputText.trim();
        setInputText('');

        try {
            await ChatService.sendMessage(id as string, user.id, textToSent);
            // Optimistic update isn't strictly necessary with realtime if it's very fast, 
            // but for good UX we let the realtime listener catch it.
        } catch (error) {
            console.error("Failed to send message", error);
            // Revert or show error...
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
            {/* Custom Header matching the Mockup */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <ArrowLeft size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <View>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-primary font-black text-lg">
                                {conversation?.type === 'ACTIVITY_GROUP'
                                    ? (conversation?.activities?.title || 'Gruppo Attività')
                                    : (conversation?.participants?.find((p: any) => p.user_id !== user?.id)?.profiles?.npo_name ||
                                        conversation?.participants?.find((p: any) => p.user_id !== user?.id)?.profiles?.full_name ||
                                        'Chat Privata')}
                            </Text>
                            {conversation?.type === 'ACTIVITY_GROUP' && (
                                <View className="flex-row items-center ml-1">
                                    {(conversation?.participants || [])
                                        .filter((p: any) => p.profiles?.role === 'VOLUNTEER')
                                        .slice(0, 4)
                                        .map((p: any, idx: number) => (
                                            <Image
                                                key={p.user_id}
                                                source={{ uri: p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.full_name || 'V'}` }}
                                                className="w-6 h-6 rounded-full border-2 border-white"
                                                style={{ marginLeft: idx > 0 ? -10 : 0, zIndex: 10 - idx }}
                                            />
                                        ))}
                                    {(conversation?.participants || []).filter((p: any) => p.profiles?.role === 'VOLUNTEER').length > 4 && (
                                        <View
                                            className="w-6 h-6 rounded-full bg-slate-100 items-center justify-center border-2 border-white"
                                            style={{ marginLeft: -10, zIndex: 0 }}
                                        >
                                            <Text className="text-[8px] font-bold text-slate-500">
                                                +{(conversation?.participants || []).filter((p: any) => p.profiles?.role === 'VOLUNTEER').length - 4}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                        {conversation?.type === 'ACTIVITY_GROUP' && (
                            <Text className="text-slate-500 text-sm font-medium">
                                {conversation?.activities?.npo?.npo_name || 'Organizzazione'}
                            </Text>
                        )}
                    </View>
                </View>

                <View className="flex-row items-center gap-2">
                    <TouchableOpacity className="p-2">
                        <Phone size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity className="p-2">
                        <MoreVertical size={20} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Date Separator (Mock) */}
            <View className="items-center py-4">
                <View className="bg-slate-100 px-3 py-1 rounded-full">
                    <Text className="text-slate-500 text-xs font-bold tracking-widest">OGGI</Text>
                </View>
            </View>

            {/* Chat List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                inverted
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                    const isOwn = item.sender_id === user?.id;
                    const timestamp = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                        <ChatBubble
                            message={item.content}
                            isOwn={isOwn}
                            timestamp={timestamp}
                            senderName={isOwn ? 'Tu' : 'Utente'} // Real app: join profiles table
                            isRead={true} // Mock read ticks 
                        />
                    );
                }}
            />

            {/* Input Bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View className="px-4 py-3 border-t border-gray-100 bg-white flex-row items-center">
                    <View className="flex-1 flex-row items-center bg-slate-50 rounded-full px-4 py-2 mr-3 border border-slate-100">
                        <TouchableOpacity className="mr-3">
                            <Plus size={24} color="#64748b" />
                        </TouchableOpacity>

                        <TextInput
                            className="flex-1 text-base max-h-24 min-h-[40px] text-slate-800"
                            placeholder="Scrivi un messaggio..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={inputText}
                            onChangeText={setInputText}
                        />

                        <TouchableOpacity className="ml-2">
                            <Smile size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                        className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                        <Send size={20} color="white" style={{ marginLeft: inputText.trim() ? 4 : 0 }} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
