import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, Image, Modal, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, MoreVertical, Send, Bell, BellOff, Users, X, Paperclip, PhoneOff, AlertCircle, ShieldOff } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../utils/supabase';
import { ChatBubble } from '../../components/ChatBubble';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ReportModal from '../../components/ReportModal';
import {
  ChatFilterError,
  useBlockUserMutation,
  useDeleteMessageMutation,
  useMarkConversationReadMutation,
  useSendMessageMutation,
  useStartPrivateConversationMutation,
  useToggleConversationNotificationsMutation,
  useUnblockUserMutation,
} from '../../hooks/chat/mutations';
import { useConversationView } from '../../hooks/chat/useConversationView';
import { colors } from "@/theme";

type PendingMessage = {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  __pending?: boolean;
  __failed?: boolean;
};

export default function ChatDetailScreen() {
  const { id, targetUserId, targetName, targetRole, targetAvatar } = useLocalSearchParams<{
    id: string;
    targetUserId?: string;
    targetName?: string;
    targetRole?: string;
    targetAvatar?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();

  const conversationId = typeof id === 'string' ? id : undefined;
  const {
    conversation,
    participants,
    messages: canonicalMessages,
    isLoadingConversation,
    isLoadingMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    refreshMetadata,
  } = useConversationView(conversationId, user?.id);

  const markAsReadMutation = useMarkConversationReadMutation(user?.id);
  const sendMessageMutation = useSendMessageMutation(user?.id, conversationId);
  const deleteMessageMutation = useDeleteMessageMutation(user?.id, conversationId);
  const toggleNotificationsMutation = useToggleConversationNotificationsMutation(user?.id);
  const startPrivateConversationMutation = useStartPrivateConversationMutation(user?.id);
  const blockUserMutation = useBlockUserMutation(user?.id);
  const unblockUserMutation = useUnblockUserMutation(user?.id);

  const [inputText, setInputText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const deleteTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flatListRef = useRef<FlatList>(null);

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Oggi';
    if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    const activeDeleteTimeouts = deleteTimeoutsRef.current;
    return () => {
      Object.values(activeDeleteTimeouts).forEach(clearTimeout);
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!conversationId || !targetUserId || !user?.id) return;
    if (!conversation || conversation.type === 'PRIVATE') return;

    void startPrivateConversationMutation.mutateAsync(String(targetUserId))
      .then((privateConvId) => {
        if (privateConvId && privateConvId !== conversationId) {
          router.replace({
            pathname: `/messages/${privateConvId}` as any,
            params: {
              targetUserId,
              targetName,
              targetRole,
              targetAvatar,
            },
          } as any);
        }
      })
      .catch((error) => {
        console.error('Error redirecting private conversation:', error);
      });
  }, [conversation, conversationId, router, startPrivateConversationMutation, targetAvatar, targetName, targetRole, targetUserId, user?.id]);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const latestMessage = canonicalMessages[0];
    const ownParticipant = participants.find((participant: any) => participant.user_id === user.id);
    if (!latestMessage || latestMessage.sender_id === user.id) return;

    const lastReadAt = ownParticipant?.last_read_at ? new Date(ownParticipant.last_read_at).getTime() : 0;
    const latestMessageAt = new Date(latestMessage.created_at).getTime();
    const alreadyRead = lastReadAt >= latestMessageAt;
    const alreadyAttempted = lastReadMessageIdRef.current === latestMessage.id;

    if (alreadyRead) {
      lastReadMessageIdRef.current = latestMessage.id;
      return;
    }

    if (alreadyAttempted || markAsReadMutation.isPending) return;

    lastReadMessageIdRef.current = latestMessage.id;
    markAsReadMutation.mutate(conversationId, {
      onError: () => {
        lastReadMessageIdRef.current = null;
      },
    });
  }, [canonicalMessages, conversationId, markAsReadMutation, participants, user?.id]);

  useEffect(() => {
    if (!conversationId) return;

    const presenceChannel = supabase.channel(`presence_chat_${conversationId}`, {
      config: { presence: { key: user?.id || 'anon' } },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typingUsers = Object.values(state)
          .flat()
          .filter((entry: any) => entry.typing && entry.user_id !== user?.id);
        setIsOtherTyping(typingUsers.length > 0);
      })
      .subscribe();

    const timer = setInterval(() => {
      void refreshMetadata();
    }, 30_000);

    return () => {
      supabase.removeChannel(presenceChannel);
      clearInterval(timer);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, refreshMetadata, user?.id]);

  const otherParticipant = useMemo(() => {
    if (!conversation || conversation.type !== 'PRIVATE') return null;
    return participants.find((participant: any) => participant.user_id !== user?.id) ?? null;
  }, [conversation, participants, user?.id]);

  const fallbackPrivateProfile = useMemo(() => {
    if (!targetUserId) return null;
    return {
      id: String(targetUserId),
      name: targetRole === 'NPO' ? undefined : (targetName || 'Volontario'),
      npo_name: targetRole === 'NPO' ? (targetName || 'Ente') : undefined,
      avatar: targetAvatar || undefined,
      role: targetRole || undefined,
    };
  }, [targetAvatar, targetName, targetRole, targetUserId]);

  const headerProfile = useMemo(() => {
    if (fallbackPrivateProfile && (!conversation || conversation.type === 'PRIVATE')) {
      return otherParticipant?.profiles || fallbackPrivateProfile;
    }
    if (!conversation) return null;
    if (conversation.type === 'PRIVATE') return otherParticipant?.profiles || null;
    return null;
  }, [conversation, fallbackPrivateProfile, otherParticipant]);

  const isOnline = useMemo(() => {
    const lastSeen = headerProfile?.last_seen_at;
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  }, [headerProfile]);

  const otherAllowsCalls = headerProfile?.allow_calls !== false;
  const otherPhone = headerProfile?.phone;
  const otherUserId = otherParticipant?.user_id || (targetUserId ? String(targetUserId) : undefined);
  const currentUserParticipant = participants.find((participant: any) => participant.user_id === user?.id);
  const isMuted = currentUserParticipant?.notifications_muted === true;
  const composerDisabledReason = useMemo(() => {
    if (!conversationId || !user?.id) return 'Chat non disponibile in questo momento.';
    if (sendMessageMutation.isPending) return 'Invio del messaggio in corso...';
    if (startPrivateConversationMutation.isPending) return 'Sto aprendo la conversazione...';
    return null;
  }, [conversationId, sendMessageMutation.isPending, startPrivateConversationMutation.isPending, user?.id]);
  const isComposerDisabled = Boolean(composerDisabledReason);

  const visibleMessages = useMemo(() => {
    const filteredCanonical = canonicalMessages.filter((message: any) => !hiddenMessageIds.includes(message.id));
    return [...pendingMessages, ...filteredCanonical].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [canonicalMessages, hiddenMessageIds, pendingMessages]);

  const messagesWithDividers = useMemo(() => {
    if (!visibleMessages.length) return [];
    const result: any[] = [];
    for (let i = 0; i < visibleMessages.length; i++) {
      const message = visibleMessages[i];
      const nextMessage = visibleMessages[i + 1];
      result.push(message);
      const currentDay = new Date(message.created_at).toDateString();
      const nextDay = nextMessage ? new Date(nextMessage.created_at).toDateString() : null;
      if (currentDay !== nextDay) {
        result.push({ __divider: true, id: `divider-${currentDay}`, label: formatDayLabel(message.created_at) });
      }
    }
    return result;
  }, [visibleMessages]);

  const displayTitle = headerProfile
    ? (headerProfile.npo_name || headerProfile.name || 'Chat')
    : (fallbackPrivateProfile?.npo_name || fallbackPrivateProfile?.name || conversation?.activities?.title || conversation?.name || 'Gruppo');
  const displayAvatar = headerProfile?.avatar || fallbackPrivateProfile?.avatar;

  const handleCall = () => {
    if (!otherPhone) {
      Alert.alert('Nessun numero', 'Questo utente non ha inserito un numero di telefono.');
      return;
    }
    if (!otherAllowsCalls) {
      Alert.alert('Chiamate disabilitate', 'Questo utente ha disabilitato le chiamate nelle impostazioni di privacy.');
      return;
    }
    void Linking.openURL(`tel:${otherPhone}`);
  };

  const navigateToProfile = (userId: string) => {
    if (!userId) return;
    router.push(`/user-profile/${userId}` as any);
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (presenceChannelRef.current && user?.id) {
      presenceChannelRef.current.track({ typing: true, user_id: user.id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        presenceChannelRef.current?.track({ typing: false, user_id: user.id });
      }, 2000);
    }
  };

  const handleAttachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        await handleSend(`📎 ${file.name}`);
      }
    } catch (error) {
      console.error('File pick error', error);
    }
  };

  const handleSend = async (overrideText?: string) => {
    if (!conversationId || !user?.id || isComposerDisabled) return;

    const text = (overrideText ?? inputText).trim();
    if (!text) return;

    if (!overrideText) {
      setInputText('');
    }

    const pendingId = `pending-${Date.now()}`;
    const pendingMessage: PendingMessage = {
      id: pendingId,
      content: text,
      sender_id: user.id,
      conversation_id: conversationId,
      created_at: new Date().toISOString(),
      __pending: true,
      __failed: false,
    };

    setPendingMessages((previous) => [pendingMessage, ...previous]);

    try {
      await sendMessageMutation.mutateAsync({ content: text });
      setPendingMessages((previous) => previous.filter((message) => message.id !== pendingId));
    } catch (error) {
      if (error instanceof ChatFilterError) {
        setPendingMessages((previous) => previous.filter((message) => message.id !== pendingId));
        if (!overrideText) {
          setInputText(text);
        }
        showToast('warning', error.message);
        return;
      }

      setPendingMessages((previous) => previous.map((message) => (
        message.id === pendingId
          ? { ...message, __pending: false, __failed: true }
          : message
      )));
      showToast('error', 'Invio fallito. Premi ↺ per riprovare.');
    }
  };

  const handleRetry = async (failedMessage: PendingMessage) => {
    setPendingMessages((previous) => previous.map((message) => (
      message.id === failedMessage.id
        ? { ...message, __failed: false, __pending: true }
        : message
    )));

    try {
      await sendMessageMutation.mutateAsync({ content: failedMessage.content });
      setPendingMessages((previous) => previous.filter((message) => message.id !== failedMessage.id));
    } catch (error) {
      if (error instanceof ChatFilterError) {
        setPendingMessages((previous) => previous.filter((message) => message.id !== failedMessage.id));
        showToast('warning', error.message);
        return;
      }

      setPendingMessages((previous) => previous.map((message) => (
        message.id === failedMessage.id
          ? { ...message, __failed: true, __pending: false }
          : message
      )));
    }
  };

  const handleDeleteMessage = (message: any) => {
    setHiddenMessageIds((previous) => [...previous, message.id]);

    deleteTimeoutsRef.current[message.id] = setTimeout(async () => {
      try {
        await deleteMessageMutation.mutateAsync(message.id);
      } catch (error: any) {
        setHiddenMessageIds((previous) => previous.filter((id) => id !== message.id));
        showToast('error', error?.message || 'Errore durante l\'eliminazione');
      } finally {
        delete deleteTimeoutsRef.current[message.id];
      }
    }, 5000);

    showToast(
      'error',
      'Messaggio eliminato',
      5000,
      {
        label: 'Annulla',
        onPress: () => {
          const timeout = deleteTimeoutsRef.current[message.id];
          if (timeout) clearTimeout(timeout);
          delete deleteTimeoutsRef.current[message.id];
          setHiddenMessageIds((previous) => previous.filter((id) => id !== message.id));
        },
      }
    );
  };

  const handleReportUser = () => {
    if (!otherParticipant?.user_id) return;
    setShowMenu(false);
    setShowReportModal(true);
  };

  const handleBlockUser = async () => {
    if (!otherParticipant?.user_id || !user?.id) return;
    const targetId = otherParticipant.user_id;

    Alert.alert(
      'Blocca Utente',
      'Bloccando questo utente non potrete più scrivervi e non vedrete i vostri post reciproci nella community.\n\nPuoi sbloccare l\'utente in qualsiasi momento dal suo profilo.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Blocca',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUserMutation.mutateAsync(targetId);
              setShowMenu(false);
              showToast('info', 'Utente bloccato', 8000, {
                label: 'Annulla',
                onPress: async () => {
                  await unblockUserMutation.mutateAsync(targetId);
                  showToast('success', 'Utente sbloccato');
                },
              });
            } catch (error) {
              const { data: blockedRows, error: blockedRowsError } = await supabase
                .from('blocked_users')
                .select('blocked_id')
                .eq('blocker_id', user.id)
                .eq('blocked_id', targetId);

              if (!blockedRowsError && (blockedRows || []).some((row: any) => row.blocked_id === targetId)) {
                setShowMenu(false);
                showToast('info', 'Utente bloccato', 8000, {
                  label: 'Annulla',
                  onPress: async () => {
                    await unblockUserMutation.mutateAsync(targetId);
                    showToast('success', 'Utente sbloccato');
                  },
                });
                return;
              }

              console.error('Error blocking user:', error);
              showToast('error', 'Errore durante il blocco. Riprova.');
            }
          },
        },
      ]
    );
  };

  const handleToggleMute = async () => {
    if (!conversationId) return;
    try {
      await toggleNotificationsMutation.mutateAsync({ conversationId, muted: !isMuted });
      setShowMenu(false);
    } catch {
      showToast('error', 'Errore nel salvataggio delle notifiche');
    }
  };

  if (isLoadingConversation && isLoadingMessages && !conversation) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-slate-400">Caricamento chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center px-4 py-2 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={24} color={colors.primary} />
        </TouchableOpacity>

        <View className="flex-row items-center flex-1 ml-1">
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
              <Text className="text-secondary text-xs">{participants.length} partecipanti · tocca per elenco</Text>
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
                <PhoneOff size={22} color={colors.textSecondary} />
                <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: -2 }}>No Num</Text>
              </View>
            ) : !otherAllowsCalls ? (
              <View className="items-center">
                <PhoneOff size={22} color={colors.textSecondary} />
                <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: -2 }}>Privacy</Text>
              </View>
            ) : (
              <Phone size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity className="p-2" onPress={() => setShowMenu(!showMenu)}>
            <MoreVertical size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
              ? participants.some((participant: any) => participant.user_id !== user?.id && participant.last_read_at && new Date(participant.last_read_at) >= new Date(item.created_at))
              : true;
            const canDelete = isOwn && !item.__pending && !item.__failed && (Date.now() - new Date(item.created_at).getTime()) < 2 * 60 * 1000;

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
                  onPress: () => handleDeleteMessage(item),
                });
              }

              buttons.push({ text: 'Annulla', style: 'cancel' });
              Alert.alert(canDelete ? 'Messaggio' : 'Copia', canDelete ? 'Cosa vuoi fare con questo messaggio?' : '', buttons, { cancelable: true });
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
          onEndReached={() => {
            if (!hasMoreMessages) return;
            void loadMoreMessages();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingMoreMessages ? (
            <View className="py-4 items-center">
              <Text className="text-slate-400 text-xs">Caricamento messaggi precedenti...</Text>
            </View>
          ) : null}
        />

        {isOtherTyping && (
          <View className="px-6 pb-1">
            <View className="flex-row items-center gap-2">
              <View className="bg-slate-100 px-4 py-2 rounded-2xl rounded-bl-sm">
                <Text className="text-slate-400 text-sm">sta scrivendo...</Text>
              </View>
            </View>
          </View>
        )}

        <View className="p-4 bg-white border-t border-gray-100">
          {composerDisabledReason ? (
            <View className="mb-2 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2">
              <Text className="text-xs font-semibold text-slate-500">{composerDisabledReason}</Text>
            </View>
          ) : null}
          <View className={`flex-row items-center rounded-3xl px-4 py-2 border ${isComposerDisabled ? 'bg-slate-100 border-slate-100 opacity-70' : 'bg-gray-50 border-gray-100'}`}>
            <TouchableOpacity onPress={handleAttachFile} disabled={isComposerDisabled} className="p-1">
              <Paperclip size={22} color={isComposerDisabled ? '#cbd5e1' : colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              className="flex-1 min-h-[40px] max-h-[100px] px-3 text-primary text-base"
              placeholder={isComposerDisabled ? 'Attendi un momento...' : 'Scrivi un messaggio...'}
              placeholderTextColor="#94a3b8"
              multiline
              value={inputText}
              onChangeText={handleTyping}
              editable={!isComposerDisabled}
            />
            <TouchableOpacity
              onPress={() => void handleSend()}
              disabled={!inputText.trim() || isComposerDisabled}
              className={`p-2 rounded-full ${inputText.trim() && !isComposerDisabled ? 'bg-accent shadow-sm' : 'bg-transparent'}`}
            >
              <Send size={22} color={inputText.trim() && !isComposerDisabled ? 'white' : '#cbd5e1'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal transparent visible={showMenu} animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity className="flex-1 bg-black/20" activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View className="absolute top-20 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 w-52 overflow-hidden">
            <TouchableOpacity
              className="flex-row items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
              onPress={() => void handleToggleMute()}
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
                  onPress={() => void handleBlockUser()}
                >
                  <ShieldOff size={20} color="#dc2626" />
                  <Text className="ml-3 text-red-600 font-medium">Blocca utente</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showParticipants} animationType="slide" onRequestClose={() => setShowParticipants(false)} statusBarTranslucent={true}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            className="flex-1 bg-white"
            style={{ paddingTop: Math.max(insets.top, 16), paddingHorizontal: 24, paddingBottom: 24 }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-black text-primary">Partecipanti</Text>
              <TouchableOpacity onPress={() => setShowParticipants(false)} className="bg-slate-100 p-2 rounded-full">
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={participants}
              keyExtractor={(item) => item.user_id}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
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
                  <ArrowLeft size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {otherUserId && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUser={{ id: otherUserId, name: displayTitle } as any}
          contentType="message"
          contentId={conversationId as string}
          evidenceSnapshot={canonicalMessages.slice(0, 10).map((message: any) => ({
            content: message.content,
            sender_id: message.sender_id,
            created_at: message.created_at,
          }))}
        />
      )}
    </SafeAreaView>
  );
}
