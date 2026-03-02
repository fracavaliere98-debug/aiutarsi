import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, Image, Modal, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, MoreVertical, Plus, Send, Bell, BellOff, Users, X, Paperclip, PhoneOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components/ChatBubble';
import { Colors } from '../../constants/Colors';
import ChatService from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [conversation, setConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Helper: format date to Italian day label
    const formatDayLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Oggi';
        if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    // Inject day dividers between messages (list is DESC, inverted FlatList shows newest at bottom)
    const messagesWithDividers = React.useMemo(() => {
        if (!messages.length) return [];
        const result: any[] = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const nextMsg = messages[i + 1];

            result.push(msg);

            const currentDay = new Date(msg.created_at).toDateString();
            const nextDay = nextMsg ? new Date(nextMsg.created_at).toDateString() : null;

            if (currentDay !== nextDay) {
                // Day changed after this message (messages are DESC, so this is the oldest of the day)
                // In inverted list, higher index = higher visually. So push divider AFTER messages.
                result.push({ __divider: true, id: `divider-${currentDay}`, label: formatDayLabel(msg.created_at) });
            }
        }
        return result;
    }, [messages]);

    // Determine the other participant (for private chats)
    const otherParticipant = React.useMemo(() => {
        if (!conversation || conversation.type !== 'PRIVATE') return null;
        return conversation.participants?.find((p: any) => p.user_id !== user?.id);
    }, [conversation, user]);

    // Online status: online if lastSeenAt < 5 mins ago
    const isOnline = React.useMemo(() => {
        const lastSeen = otherParticipant?.profiles?.last_seen_at;
        if (!lastSeen) return false;
        return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
    }, [otherParticipant]);

    // Can we call this person?
    const otherAllowsCalls = otherParticipant?.profiles?.allow_calls !== false;
    const otherPhone = otherParticipant?.profiles?.phone;

    const handleCall = () => {
        if (!otherPhone || !otherAllowsCalls) return;
        Linking.openURL(`tel:${otherPhone}`);
    };

    const handleAttachFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.[0]) {
                const file = result.assets[0];
                // Send the filename as a message (future: upload to Supabase Storage)
                await ChatService.sendMessage(id as string, user!.id, `📎 ${file.name}`);
            }
        } catch (e) {
            console.error('File pick error', e);
        }
    };

    useEffect(() => {
        if (!user || !id) return;

        const loadChat = async () => {
            try {
                const data = await ChatService.getConversationDetails(id as string);
                setConversation(data);

                const me = data.participants?.find((p: any) => p.user_id === user.id);
                setIsMuted(!!me?.notifications_muted);

                const sortedMessages = [...(data.messages || [])].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setMessages(sortedMessages);

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
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const toggleMute = async () => {
        if (!user || !id) return;
        try {
            const nextStatus = !isMuted;
            await ChatService.toggleNotifications(id as string, user.id, nextStatus);
            setIsMuted(nextStatus);
            setShowMenu(false);
        } catch (error) {
            console.error("Failed to toggle notifications", error);
        }
    };

    const volunteers = (conversation?.participants || []).filter((p: any) => p.profiles?.role === 'VOLUNTEER');
    const npos = (conversation?.participants || []).filter((p: any) => p.profiles?.role === 'NPO');

    // Chat title and subtitle
    const chatTitle = conversation?.type === 'ACTIVITY_GROUP'
        ? (conversation?.activities?.title || 'Gruppo Attività')
        : (otherParticipant?.profiles?.npo_name || otherParticipant?.profiles?.full_name || 'Chat Privata');

    const chatSubtitle = conversation?.type === 'ACTIVITY_GROUP'
        ? (conversation?.activities?.npo?.npo_name || 'Organizzazione')
        : (isOnline ? 'Online' : 'Offline');

    const subtitleColor = conversation?.type === 'PRIVATE' ? (isOnline ? '#22c55e' : '#94a3b8') : '#94a3b8';

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
            {/* Custom Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-50">
                <View className="flex-row items-center gap-3 flex-1">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <ArrowLeft size={28} color={Colors.primary} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-primary font-black text-lg" numberOfLines={1}>
                            {chatTitle}
                        </Text>
                        <Text style={{ color: subtitleColor }} className="text-xs font-semibold">
                            {chatSubtitle}
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center gap-1">
                    {/* Phone call button — disabled if callee has disabled calls or has no phone number */}
                    <TouchableOpacity
                        onPress={handleCall}
                        disabled={!otherPhone || !otherAllowsCalls}
                        className="p-2"
                    >
                        {otherPhone && otherAllowsCalls
                            ? <Phone size={24} color={Colors.primary} />
                            : <PhoneOff size={24} color="#cbd5e1" />
                        }
                    </TouchableOpacity>
                    <TouchableOpacity className="p-2" onPress={() => setShowMenu(!showMenu)}>
                        <MoreVertical size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Dropdown Menu */}
                {showMenu && (
                    <View
                        className="absolute right-4 top-14 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-56 z-[100]"
                        style={{ elevation: 5 }}
                    >
                        <TouchableOpacity
                            onPress={toggleMute}
                            className="flex-row items-center px-4 py-3 border-b border-gray-50"
                        >
                            {isMuted ? <Bell size={22} color={Colors.primary} /> : <BellOff size={22} color="#64748b" />}
                            <Text className={`ml-3 font-semibold ${isMuted ? 'text-primary' : 'text-slate-600'}`}>
                                {isMuted ? 'Abilita notifiche' : 'Disabilita notifiche'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setShowParticipants(true); setShowMenu(false); }}
                            className="flex-row items-center px-4 py-3"
                        >
                            <Users size={22} color="#64748b" />
                            <Text className="ml-3 font-semibold text-slate-600">Partecipanti</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Participants Modal */}
            <Modal
                visible={showParticipants}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowParticipants(false)}
            >
                <View className="flex-1 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-[32px] h-[70%] px-6 pt-6 pb-10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black text-primary">Partecipanti</Text>
                            <TouchableOpacity onPress={() => setShowParticipants(false)} className="bg-slate-100 p-2 rounded-full">
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {npos.map((p: any) => (
                                <View key={p.user_id} className="flex-row items-center mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <Image
                                        source={{ uri: p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.npo_name || 'N'}` }}
                                        className="w-12 h-12 rounded-full border-2 border-primary/20"
                                    />
                                    <View className="ml-4">
                                        <Text className="text-lg font-bold text-slate-800">{p.profiles?.npo_name}</Text>
                                        <Text className="text-primary font-bold text-xs">Organizzatore</Text>
                                    </View>
                                </View>
                            ))}

                            <View className="h-[1px] bg-slate-100 my-4" />
                            <Text className="text-slate-400 font-bold mb-4 uppercase tracking-widest text-xs">Volontari ({volunteers.length})</Text>

                            {volunteers.map((p: any) => (
                                <View key={p.user_id} className="flex-row items-center mb-4">
                                    <Image
                                        source={{ uri: p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.full_name || 'V'}` }}
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <View className="ml-4">
                                        <Text className="text-base font-bold text-slate-700">{p.profiles?.full_name}</Text>
                                        <Text className="text-slate-400 text-xs">Volontario</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Chat List */}
            <FlatList
                ref={flatListRef}
                data={messagesWithDividers}
                keyExtractor={(item) => item.id}
                inverted
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 10 }}
                renderItem={({ item }) => {
                    // Day divider
                    if (item.__divider) {
                        return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginHorizontal: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'capitalize' }}>{item.label}</Text>
                                </View>
                                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                            </View>
                        );
                    }
                    // Regular message
                    const isOwn = item.sender_id === user?.id;
                    const timestamp = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const sender = conversation?.participants?.find((p: any) => p.user_id === item.sender_id);
                    const senderName = isOwn ? 'Tu' : (sender?.profiles?.npo_name || sender?.profiles?.full_name || 'Utente');
                    const avatarUrl = isOwn ? user?.avatar : sender?.profiles?.avatar_url;

                    return (
                        <ChatBubble
                            message={item.content}
                            isOwn={isOwn}
                            timestamp={timestamp}
                            senderName={senderName}
                            avatarUrl={avatarUrl}
                            isRead={true}
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
                        {/* Attachment button */}
                        <TouchableOpacity className="mr-3" onPress={handleAttachFile}>
                            <Paperclip size={22} color="#64748b" />
                        </TouchableOpacity>

                        <TextInput
                            className="flex-1 text-base max-h-24 min-h-[40px] text-slate-800"
                            placeholder="Scrivi un messaggio..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={inputText}
                            onChangeText={setInputText}
                        />
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
