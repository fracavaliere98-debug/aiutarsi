import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, Image, Modal, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, MoreVertical, Send, Bell, BellOff, Users, X, Paperclip, PhoneOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components/ChatBubble';
import { Colors } from '../../constants/Colors';
import ChatService, { ChatFilterError } from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { useToast } from '../../context/ToastContext';

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

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

    // Day dividers injected between messages (list is DESC for inverted FlatList)
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
                result.push({ __divider: true, id: `divider-${currentDay}`, label: formatDayLabel(msg.created_at) });
            }
        }
        return result;
    }, [messages]);

    // Other participant for PRIVATE chats
    const otherParticipant = React.useMemo(() => {
        if (!conversation) return null;
        if (conversation.type !== 'PRIVATE') return null;
        return conversation.participants?.find((p: any) => p.user_id !== user?.id);
    }, [conversation, user]);

    // For group chats, pick the NPO participant to show as header (if exists)
    const headerProfile = React.useMemo(() => {
        if (!conversation) return null;
        if (conversation.type === 'PRIVATE') return otherParticipant?.profiles || null;
        // For groups, no single profile - show activity title
        return null;
    }, [conversation, otherParticipant]);

    // Online/offline – recalculated on every render (conversation refreshes every 30s)
    const isOnline = React.useMemo(() => {
        const lastSeen = headerProfile?.last_seen_at;
        if (!lastSeen) return false;
        return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
    }, [headerProfile]);

    // Call capability
    const otherAllowsCalls = headerProfile?.allow_calls !== false;
    const otherPhone = headerProfile?.phone;

    const handleCall = () => {
        if (!otherPhone) {
            Alert.alert('Nessun numero', 'Questo utente non ha inserito un numero di telefono.');
            return;
        }
        if (!otherAllowsCalls) {
            Alert.alert('Chiamate disabilitate', "Questo utente ha disabilitato le chiamate nelle impostazioni di privacy.");
            return;
        }
        Linking.openURL(`tel:${otherPhone}`);
    };

    // Navigate to a user's profile
    const navigateToProfile = (userId: string) => {
        if (!userId) return;
        router.push(`/user-profile/${userId}` as any);
    };

    const handleAttachFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.[0]) {
                const file = result.assets[0];
                await ChatService.sendMessage(id as string, user!.id, `📎 ${file.name}`);
            }
        } catch (e) {
            console.error('File pick error', e);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        const text = inputText.trim();
        setInputText(''); // Optimistically clear
        try {
            const newMsg = await ChatService.sendMessage(id as string, user!.id, text);
            // Optimistically add to local state
            setMessages(prev => [newMsg, ...prev]);
        } catch (e) {
            if (e instanceof ChatFilterError) {
                // Restore the text so the user can edit rather than lose it
                setInputText(text);
                showToast('warning', e.message);
            } else {
                console.error('Send error', e);
                setInputText(text); // Restore on generic errors too
                showToast('error', 'Errore durante l\'invio del messaggio.');
            }
        }
    };

    const loadData = useCallback(async () => {
        if (!id) return;
        const conv = await ChatService.getConversationDetails(id as string);
        setConversation(conv);
        const msgs = await ChatService.getMessages(id as string);
        setMessages(msgs);
        // Mark as read
        if (user?.id) {
            ChatService.markAsRead(id as string, user.id).catch(() => { });
        }
    }, [id, user?.id]);

    useEffect(() => {
        loadData();

        // Subscribe to new messages in this conversation
        const channel = supabase.channel(`chat_${id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${id}`
            }, (payload) => {
                // Add to top of inverted list, then fetch fresh profile info
                supabase
                    .from('messages')
                    .select('*, profiles:sender_id (name:full_name, avatar:avatar_url)')
                    .eq('id', payload.new.id)
                    .single()
                    .then(({ data }) => {
                        if (data) setMessages(prev => {
                            // avoid duplicates (optimistic insert)
                            if (prev.find(m => m.id === data.id)) return prev;
                            return [data, ...prev];
                        });
                    });
            })
            .subscribe();

        // Poll online status every 30s
        const timer = setInterval(() => {
            loadData();
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(timer);
        };
    }, [id, loadData]);

    // Header display name
    const displayTitle = headerProfile
        ? (headerProfile.npo_name || headerProfile.name || 'Chat')
        : (conversation?.activities?.title || conversation?.name || 'Gruppo');

    const displayAvatar = headerProfile?.avatar;
    const otherUserId = otherParticipant?.user_id;

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-2 border-b border-gray-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color={Colors.primary} />
                </TouchableOpacity>

                <View className="flex-row items-center flex-1 ml-1">
                    {/* Avatar – tap to go to profile (private chats only) */}
                    <TouchableOpacity
                        onPress={() => otherUserId && navigateToProfile(otherUserId)}
                        activeOpacity={otherUserId ? 0.7 : 1}
                        className="relative"
                    >
                        <Image
                            source={{ uri: displayAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayTitle)}&background=random` }}
                            className="w-10 h-10 rounded-full bg-slate-100"
                        />
                        {isOnline && (
                            <View className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="ml-3 flex-1"
                        onPress={() => {
                            if (conversation?.type === 'ACTIVITY_GROUP') setShowParticipants(true);
                            else if (otherUserId) navigateToProfile(otherUserId);
                        }}
                    >
                        <Text className="text-primary font-bold text-base" numberOfLines={1}>{displayTitle}</Text>
                        {conversation?.type === 'PRIVATE' && (
                            <Text className="text-secondary text-xs">{isOnline ? '🟢 Online' : '⚪ Offline'}</Text>
                        )}
                        {conversation?.type === 'ACTIVITY_GROUP' && (
                            <Text className="text-secondary text-xs">{(conversation?.participants?.length || 0)} partecipanti · tocca per elenco</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View className="flex-row items-center">
                    <TouchableOpacity
                        className={`p-2 mr-1 ${(!otherPhone || !otherAllowsCalls) ? 'opacity-40' : ''}`}
                        onPress={handleCall}
                    >
                        {!otherPhone ? (
                            <View className="items-center">
                                <PhoneOff size={22} color={Colors.secondary} />
                                <Text style={{ fontSize: 8, color: Colors.secondary, marginTop: -2 }}>No Num</Text>
                            </View>
                        ) : !otherAllowsCalls ? (
                            <View className="items-center">
                                <PhoneOff size={22} color={Colors.secondary} />
                                <Text style={{ fontSize: 8, color: Colors.secondary, marginTop: -2 }}>Privacy</Text>
                            </View>
                        ) : (
                            <Phone size={24} color={Colors.primary} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity className="p-2" onPress={() => setShowMenu(!showMenu)}>
                        <MoreVertical size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat List */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                className="flex-1"
            >
                <FlatList
                    ref={flatListRef}
                    data={messagesWithDividers}
                    keyExtractor={(item) => item.id}
                    inverted
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
                    renderItem={({ item }) => {
                        if (item.__divider) {
                            return (
                                <View className="items-center my-6">
                                    <View className="bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200/50">
                                        <Text className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                                            {item.label}
                                        </Text>
                                    </View>
                                </View>
                            );
                        }
                        return (
                            <ChatBubble
                                message={item.content}
                                isOwn={item.sender_id === user?.id}
                                senderName={item.sender_id === user?.id ? 'Tu' : (item.profiles?.name || 'Utente')}
                                avatarUrl={item.profiles?.avatar}
                                timestamp={new Date(item.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                isRead={item.is_read}
                            />
                        );
                    }}
                />

                {/* Input Area */}
                <View className="p-4 bg-white border-t border-gray-100">
                    <View className="flex-row items-center bg-gray-50 rounded-3xl px-4 py-2 border border-gray-100">
                        <TouchableOpacity onPress={handleAttachFile} className="p-1">
                            <Paperclip size={22} color={Colors.secondary} />
                        </TouchableOpacity>
                        <TextInput
                            className="flex-1 min-h-[40px] max-h-[100px] px-3 text-primary text-base"
                            placeholder="Scrivi un messaggio..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={inputText}
                            onChangeText={setInputText}
                        />
                        <TouchableOpacity
                            onPress={handleSend}
                            disabled={!inputText.trim()}
                            className={`p-2 rounded-full ${inputText.trim() ? 'bg-accent shadow-sm' : 'bg-transparent'}`}
                        >
                            <Send size={22} color={inputText.trim() ? 'white' : '#cbd5e1'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Menu Modal */}
            <Modal transparent visible={showMenu} animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={() => setShowMenu(false)}>
                    <View className="absolute top-20 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 w-52 overflow-hidden">
                        <TouchableOpacity
                            className="flex-row items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                            onPress={() => { setIsMuted(!isMuted); setShowMenu(false); }}
                        >
                            {isMuted ? <Bell size={20} color="#64748b" /> : <BellOff size={20} color="#64748b" />}
                            <Text className="ml-3 text-primary font-medium">{isMuted ? 'Riattiva notifiche' : 'Silenzia chat'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-row items-center px-4 py-3 active:bg-gray-50"
                            onPress={() => { setShowParticipants(true); setShowMenu(false); }}
                        >
                            <Users size={20} color="#64748b" />
                            <Text className="ml-3 text-primary font-medium">Partecipanti</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Participants Modal */}
            <Modal visible={showParticipants} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowParticipants(false)}>
                <View className="flex-1 bg-white p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-black text-primary">Partecipanti</Text>
                        <TouchableOpacity onPress={() => setShowParticipants(false)} className="bg-slate-100 p-2 rounded-full">
                            <X size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={conversation?.participants || []}
                        keyExtractor={(item) => item.user_id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                className="flex-row items-center mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 active:bg-slate-100"
                                onPress={() => {
                                    setShowParticipants(false);
                                    navigateToProfile(item.user_id);
                                }}
                            >
                                <Image
                                    source={{ uri: item.profiles?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profiles?.npo_name || item.profiles?.name || 'U')}&background=random` }}
                                    className="w-12 h-12 rounded-full bg-slate-200"
                                />
                                <View className="ml-3 flex-1">
                                    <Text className="text-primary font-bold text-base">{item.profiles?.npo_name || item.profiles?.name || 'Utente'}</Text>
                                    <Text className="text-slate-500 text-xs capitalize">{item.profiles?.role?.toLowerCase() || 'aderente'}</Text>
                                </View>
                                <ArrowLeft size={16} color={Colors.secondary} style={{ transform: [{ rotate: '180deg' }] }} />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
}
