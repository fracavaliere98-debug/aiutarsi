import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, Image, Modal, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, MoreVertical, Send, Bell, BellOff, Users, X, Paperclip, PhoneOff, AlertCircle, ShieldOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../../components/ChatBubble';
import { Colors } from '../../constants/Colors';
import ChatService, { ChatFilterError } from '../../services/ChatService';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { supabase } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { useToast } from '../../context/ToastContext';
import ReportModal from '../../components/ReportModal';

export default function ChatDetailScreen() {
    const { id, targetUserId, targetName, targetRole, targetAvatar } = useLocalSearchParams<{
        id: string;
        targetUserId?: string;
        targetName?: string;
        targetRole?: string;
        targetAvatar?: string;
    }>();
    const router = useRouter();
    const { user } = useAuth();
    const { markAsRead, updateConversationPreview } = useChat();
    const { showToast } = useToast();

    const [conversation, setConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<any>(null);
    const presenceChannelRef = useRef<any>(null);
    const flatListRef = useRef<FlatList>(null);
    const messagesRef = useRef<any[]>([]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

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

    const fallbackPrivateProfile = React.useMemo(() => {
        if (!targetUserId) return null;
        return {
            id: String(targetUserId),
            name: targetRole === 'NPO' ? undefined : (targetName || 'Volontario'),
            npo_name: targetRole === 'NPO' ? (targetName || 'Ente') : undefined,
            avatar: targetAvatar || undefined,
            role: targetRole || undefined,
        };
    }, [targetAvatar, targetName, targetRole, targetUserId]);

    // For group chats, pick the NPO participant to show as header (if exists)
    const headerProfile = React.useMemo(() => {
        if (fallbackPrivateProfile && (!conversation || conversation.type === 'PRIVATE')) {
            return otherParticipant?.profiles || fallbackPrivateProfile;
        }
        if (!conversation) return null;
        if (conversation.type === 'PRIVATE') return otherParticipant?.profiles || null;
        // For groups, no single profile - show activity title
        return null;
    }, [conversation, fallbackPrivateProfile, otherParticipant]);

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

    // Merge without duplicates, sorted newest-first (FlatList is inverted)
    const mergeMessages = (prev: any[], incoming: any[]): any[] => {
        const map = new Map<string, any>();
        for (const m of prev) map.set(m.id, m);
        for (const m of incoming) map.set(m.id, m); // incoming wins (fresher profile data)
        return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    };

    const handleSend = async () => {
        if (!inputText.trim() || isSending) return;
        const text = inputText.trim();
        setInputText('');
        setIsSending(true);

        // Create optimistic message (pending state)
        const tempId = `pending-${Date.now()}`;
        const pendingMsg = {
            id: tempId,
            content: text,
            sender_id: user!.id,
            conversation_id: id,
            created_at: new Date().toISOString(),
            __pending: true,
            __failed: false,
        };
        setMessages(prev => [pendingMsg, ...prev]);

        let watchdogTriggered = false;
        const watchdogId = setTimeout(() => {
            watchdogTriggered = true;
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, __pending: false, __failed: true } : m));
            setIsSending(false);
            showToast('error', 'Invio lento o bloccato. Premi ↺ per riprovare.');
        }, 12000);

        try {
            const newMsg = await ChatService.sendMessage(id as string, user!.id, text);
            clearTimeout(watchdogId);
            // Replace pending message with real message from DB
            setMessages(prev => {
                const hasPending = prev.some(m => m.id === tempId);
                if (!hasPending) {
                    return mergeMessages(prev, [newMsg]);
                }
                return prev.map(m => m.id === tempId ? { ...newMsg } : m);
            });
            // Optimistically update the conversation list preview immediately
            updateConversationPreview(id as string, text, user!.id);
        } catch (e) {
            clearTimeout(watchdogId);
            if (e instanceof ChatFilterError) {
                // Remove pending, restore input
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setInputText(text);
                showToast('warning', e.message);
            } else {
                // Mark as failed with retry option
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, __failed: true } : m));
                if (!watchdogTriggered) {
                    showToast('error', 'Invio fallito. Premi ↺ per riprovare.');
                }
            }
        } finally {
            if (!watchdogTriggered) {
                setIsSending(false);
            }
        }
    };

    const handleRetry = async (failedMsg: any) => {
        // Mark as pending again
        setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, __failed: false, __pending: true } : m));
        try {
            const newMsg = await ChatService.sendMessage(id as string, user!.id, failedMsg.content);
            setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
            setMessages(prev => mergeMessages(prev, [newMsg]));
        } catch {
            setMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, __failed: true, __pending: false } : m));
        }
    };

    // Broadcast typing presence
    const handleTyping = (text: string) => {
        setInputText(text);
        if (presenceChannelRef.current && user?.id) {
            // Instantly broadcast that we are typing (Presence handles throttling internally to some extent,
            // but we ensure we set it to true immediately on first keystroke)
            presenceChannelRef.current.track({ typing: true, user_id: user.id });

            // Reset the timeout that will set typing to false
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                presenceChannelRef.current?.track({ typing: false, user_id: user.id });
            }, 2000);
        }
    };

    const loadData = useCallback(async (isInitial = true) => {
        if (!id) return;
        if (isInitial) setIsRefreshing(true);
        else setIsLoadingMore(true);

        try {
            if (isInitial) {
                const conv = await ChatService.getConversationDetails(id as string);
                if (targetUserId && user?.id && conv?.type !== 'PRIVATE') {
                    const privateConvId = await ChatService.startPrivateConversation(user.id, String(targetUserId));
                    if (privateConvId && privateConvId !== id) {
                        router.replace({
                            pathname: `/messages/${privateConvId}` as any,
                            params: {
                                targetUserId,
                                targetName,
                                targetRole,
                                targetAvatar,
                            }
                        } as any);
                        return;
                    }
                }
                setConversation(conv);
            }

            const currentMessages = messagesRef.current;
            const oldestTimestamp = !isInitial && currentMessages.length > 0
                ? currentMessages[currentMessages.length - 1].created_at
                : undefined;

            const newMsgs = await ChatService.getMessages(id as string, oldestTimestamp);

            if (newMsgs.length < 20) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            setMessages(prev => mergeMessages(prev, newMsgs));

            if (isInitial && user?.id) {
                markAsRead(id as string).catch(() => { });
            }
        } catch (error) {
            console.error('Error loading chat data:', error);
        } finally {
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, [id, markAsRead, router, targetAvatar, targetName, targetRole, targetUserId, user?.id]);

    const handleLoadMore = () => {
        if (!hasMore || isLoadingMore || isRefreshing) return;
        loadData(false);
    };

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
                supabase
                    .from('messages')
                    .select('*, profiles:sender_id (name:full_name, avatar:avatar_url)')
                    .eq('id', payload.new.id)
                    .single()
                    .then(({ data }) => {
                        if (data) setMessages(prev => mergeMessages(prev, [data]));
                    });
            })
            .subscribe();

        // Supabase Presence: typing indicators (zero DB writes)
        const presenceChannel = supabase.channel(`presence_chat_${id}`, {
            config: { presence: { key: user?.id || 'anon' } }
        });
        presenceChannelRef.current = presenceChannel;
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const typingUsers = Object.values(state)
                    .flat()
                    .filter((s: any) => s.typing && s.user_id !== user?.id);
                setIsOtherTyping(typingUsers.length > 0);
            })
            .subscribe();

        // Poll online status every 30s (does NOT re-fetch messages to avoid duplicates)
        const timer = setInterval(() => {
            // Only refresh conversation metadata (online status, etc.), not messages
            if (id) {
                ChatService.getConversationMetadata(id as string)
                    .then(conv => setConversation(conv))
                    .catch(() => { });
            }
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(presenceChannel);
            clearInterval(timer);
            clearTimeout(typingTimeoutRef.current);
        };
    }, [id, loadData, user?.id]);

    const handleReportUser = async () => {
        if (!otherParticipant?.user_id) return;
        setShowMenu(false);
        setShowReportModal(true);
    };

    const handleBlockUser = async () => {
        if (!otherParticipant?.user_id || !user?.id) return;
        const targetId = otherParticipant.user_id;
        Alert.alert(
            'Blocca Utente',
            `Bloccando questo utente non potrete più scrivervi e non vedrete i vostri post reciproci nella community.\n\nPuoi sbloccare l'utente in qualsiasi momento dal suo profilo.`,
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Blocca',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ChatService.blockUser(user.id, targetId);
                            setShowMenu(false);
                            showToast(
                                'info',
                                'Utente bloccato',
                                8000,
                                {
                                    label: 'Annulla',
                                    onPress: async () => {
                                        await ChatService.unblockUser(user.id, targetId);
                                        showToast('success', 'Utente sbloccato');
                                    }
                                }
                            );
                        } catch {
                            showToast('error', 'Errore durante il blocco. Riprova.');
                        }
                    }
                }
            ]
        );
    };


    // Header display name
    const displayTitle = headerProfile
        ? (headerProfile.npo_name || headerProfile.name || 'Chat')
        : (fallbackPrivateProfile?.npo_name || fallbackPrivateProfile?.name || conversation?.activities?.title || conversation?.name || 'Gruppo');

    const displayAvatar = headerProfile?.avatar || fallbackPrivateProfile?.avatar;
    const otherUserId = otherParticipant?.user_id || (targetUserId ? String(targetUserId) : undefined);

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
                        const isOwn = item.sender_id === user?.id;
                        const isRead = isOwn
                            ? conversation?.participants?.some((p: any) => p.user_id !== user?.id && p.last_read_at && new Date(p.last_read_at) >= new Date(item.created_at))
                            : true;

                        const canDelete = isOwn && (Date.now() - new Date(item.created_at).getTime()) < 2 * 60 * 1000;

                        // Pending (optimistic) or failed message
                        if (item.__pending || item.__failed) {
                            return (
                                <View className="flex-row justify-end items-end mb-4 px-4">
                                    <View style={{ maxWidth: '75%' }}>
                                        <View className={`p-4 rounded-2xl rounded-br-sm ${item.__failed ? 'bg-red-50 border border-red-200' : 'bg-primary/60'}`}>
                                            <Text className={`text-[15px] leading-5 ${item.__failed ? 'text-red-600' : 'text-white'}`}>{item.content}</Text>
                                        </View>
                                        <View className="flex-row items-center justify-end mt-1 gap-1">
                                            {item.__failed ? (
                                                <TouchableOpacity onPress={() => handleRetry(item)} className="flex-row items-center gap-1">
                                                    <AlertCircle size={13} color="#ef4444" />
                                                    <Text className="text-[11px] text-red-500 font-bold">Riprova</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <Text className="text-[11px] text-slate-400">Invio...</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        }

                        const handleLongPress = () => {
                            // Always show copy. Show delete only within 2-min window for own messages.
                            const buttons: any[] = [
                                {
                                    text: 'Copia',
                                    onPress: () => Clipboard.setStringAsync(item.content || ''),
                                },
                            ];

                            if (canDelete) {
                                buttons.push({
                                    text: 'Elimina',
                                    style: 'destructive',
                                    onPress: () => {
                                        // Optimistic: hide message immediately
                                        setMessages(prev => prev.filter(m => m.id !== item.id));

                                        // Update conversation preview optimistically to previous message
                                        const prevMsg = messages.find(m => m.id !== item.id && !m.__pending && !m.__failed);
                                        if (prevMsg) {
                                            updateConversationPreview(id as string, prevMsg.content, prevMsg.sender_id);
                                        } else {
                                            updateConversationPreview(id as string, '', '');
                                        }

                                        let cancelled = false;
                                        const deleteTimeout = setTimeout(async () => {
                                            if (cancelled) return;
                                            try {
                                                await ChatService.deleteMessage(item.id, user!.id);
                                            } catch (e: any) {
                                                // Restore message on failure
                                                // Restore message on failure using mergeMessages to avoid duplicates
                                                setMessages(prev => mergeMessages(prev, [item]));
                                                showToast('error', e.message || 'Errore durante l\'eliminazione');
                                            }
                                        }, 5000);

                                        showToast(
                                            'error',
                                            'Messaggio eliminato',
                                            5000,
                                            {
                                                label: 'Annulla',
                                                onPress: () => {
                                                    cancelled = true;
                                                    clearTimeout(deleteTimeout);
                                                    // Restore message to local state safely
                                                    setMessages(prev => mergeMessages(prev, [item]));
                                                }
                                            }
                                        );
                                    }
                                });
                            }

                            buttons.push({ text: 'Annulla', style: 'cancel' });

                            Alert.alert(
                                canDelete ? 'Messaggio' : 'Copia',
                                canDelete ? 'Cosa vuoi fare con questo messaggio?' : '',
                                buttons,
                                { cancelable: true }
                            );
                        };

                        return (
                            <TouchableOpacity
                                activeOpacity={canDelete ? 0.85 : 1}
                                onLongPress={handleLongPress}
                                delayLongPress={400}
                            >
                                <ChatBubble
                                    message={item.content}
                                    isOwn={isOwn}
                                    senderName={isOwn ? 'Tu' : (item.profiles?.name || 'Utente')}
                                    avatarUrl={item.profiles?.avatar}
                                    timestamp={new Date(item.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    isRead={isRead}
                                />
                            </TouchableOpacity>
                        );
                    }}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={isLoadingMore ? (
                        <View className="py-4 items-center">
                            <Text className="text-slate-400 text-xs">Caricamento messaggi precedenti...</Text>
                        </View>
                    ) : null}
                />

                {/* Typing Indicator */}
                {isOtherTyping && (
                    <View className="px-6 pb-1">
                        <View className="flex-row items-center gap-2">
                            <View className="bg-slate-100 px-4 py-2 rounded-2xl rounded-bl-sm">
                                <Text className="text-slate-400 text-sm">sta scrivendo...</Text>
                            </View>
                        </View>
                    </View>
                )}

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
                            onChangeText={handleTyping}
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
                        {conversation?.type === 'PRIVATE' && otherParticipant?.user_id && (
                            <>
                                <TouchableOpacity
                                    className="flex-row items-center px-4 py-3 border-t border-gray-100 active:bg-red-50"
                                    onPress={handleReportUser}
                                >
                                    <AlertCircle size={20} color="#ef4444" />
                                    <Text className="ml-3 text-red-500 font-medium">Segnala utente</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-row items-center px-4 py-3 border-t border-gray-100 active:bg-red-50"
                                    onPress={handleBlockUser}
                                >
                                    <ShieldOff size={20} color="#dc2626" />
                                    <Text className="ml-3 text-red-600 font-medium">Blocca utente</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Participants Modal */}
            <Modal visible={showParticipants} animationType="slide" onRequestClose={() => setShowParticipants(false)} statusBarTranslucent={true}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
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
                </SafeAreaView>
            </Modal>

            {/* Modal Avanzato di Segnalazione */}
            {otherUserId && (
                <ReportModal
                    visible={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    reportedUser={{ id: otherUserId, name: displayTitle } as any}
                    contentType="message"
                    contentId={id as string}
                    evidenceSnapshot={messages.slice(0, 10).map(m => ({
                        content: m.content,
                        sender_id: m.sender_id,
                        created_at: m.created_at
                    }))}
                />
            )}
        </SafeAreaView>
    );
}
