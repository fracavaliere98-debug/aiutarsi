import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Image, ActivityIndicator, PanResponder, Animated as RNAnimated, Animated } from 'react-native';
import { Search, Edit, Users as UsersIcon, ChevronRight, X, Trash2 } from 'lucide-react-native';
import { ConversationListItem } from '../../components/ConversationListItem';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAvailableChatEntitiesQuery } from '../../hooks/chat/queries';
import { useChatInboxView } from '../../hooks/chat/useChatInboxView';
import { useHideConversationMutation, useStartGroupConversationMutation, useStartPrivateConversationMutation } from '../../hooks/chat/mutations';

import { StandardLayout } from '../../components/StandardLayout';

function areConversationSnapshotsEqual(previous: any[], next: any[]) {
    if (previous.length !== next.length) return false;

    return previous.every((prevConversation: any, index: number) => {
        const nextConversation = next[index];
        if (!nextConversation) return false;

        const prevMeta = prevConversation?.conversations;
        const nextMeta = nextConversation?.conversations;

        return (
            prevConversation?.conversation_id === nextConversation?.conversation_id &&
            prevConversation?.unread_count === nextConversation?.unread_count &&
            prevConversation?.inbox_visible_at === nextConversation?.inbox_visible_at &&
            prevConversation?.inbox_title === nextConversation?.inbox_title &&
            prevConversation?.notifications_muted === nextConversation?.notifications_muted &&
            prevMeta?.last_message_at === nextMeta?.last_message_at &&
            prevMeta?.last_message_content === nextMeta?.last_message_content &&
            prevMeta?.last_message_sender_id === nextMeta?.last_message_sender_id
        );
    });
}

const formatRelativeDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();

    // Normalize to compare just dates
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate.getTime() === yesterday.getTime()) {
        return 'Ieri';
    } else {
        const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            return date.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
        }
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
};

// Swipeable wrapper with smooth right-to-left swipe revealing delete button
function SwipeableConversationItem({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
    const translateX = useRef(new Animated.Value(0)).current;
    const SWIPE_THRESHOLD = 40;
    const MAX_SWIPE = -80;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => {
                // Only capture horizontal swipes starting to the left
                return Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && g.dx < -4;
            },
            onPanResponderGrant: () => {
                // Stop any in-progress animation and capture current value
                (translateX as any).stopAnimation();
            },
            onPanResponderMove: (_, g) => {
                const newVal = Math.max(MAX_SWIPE, Math.min(0, g.dx));
                translateX.setValue(newVal);
            },
            onPanResponderRelease: (_, g) => {
                const vel = g.vx;
                if (g.dx < SWIPE_THRESHOLD || vel < -0.3) {
                    // Snap open
                    Animated.spring(translateX, {
                        toValue: MAX_SWIPE,
                        useNativeDriver: true,
                        bounciness: 0,
                        speed: 30,
                    }).start();
                } else {
                    // Snap closed
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0,
                        speed: 30,
                    }).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
            },
        })
    ).current;

    const handleDelete = () => {
        // Snap back then call delete
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(() => onDelete());
    };

    return (
        <View style={{ overflow: 'hidden' }}>
            {/* Delete button revealed on swipe */}
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }} onPress={handleDelete}>
                    <Trash2 size={22} color="white" />
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 3 }}>Elimina</Text>
                </TouchableOpacity>
            </View>
            <Animated.View style={{ transform: [{ translateX }], backgroundColor: 'white' }} {...panResponder.panHandlers}>
                {children}
            </Animated.View>
        </View>
    );
}

export default function MessagesListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { conversations, refreshInbox: refreshConversations, isRefreshing } = useChatInboxView(user?.id);
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'Tutti' | 'Gruppi Attività' | 'Privati'>('Tutti');
    const [showNpoPicker, setShowNpoPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [localConversations, setLocalConversations] = useState<any[]>([]);
    const [isPullRefreshing, setIsPullRefreshing] = useState(false);
    const undoTimeoutRef = useRef<any>(null);
    const pendingDeleteRef = useRef<{ convId: string; userId: string } | null>(null);
    const isUndoActiveRef = useRef(false);
    const panY = useRef(new RNAnimated.Value(0)).current;
    const hideConversationMutation = useHideConversationMutation(user?.id);
    const startPrivateConversationMutation = useStartPrivateConversationMutation(user?.id);
    const startGroupConversationMutation = useStartGroupConversationMutation(user?.id);
    const availableEntitiesQuery = useAvailableChatEntitiesQuery(user?.id, user?.role, showNpoPicker);
    const myNpos = availableEntitiesQuery.data ?? [];
    const loadingNpos = availableEntitiesQuery.isLoading || availableEntitiesQuery.isFetching;

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 150 || gestureState.vy > 0.5) {
                    setShowNpoPicker(false);
                    RNAnimated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                } else {
                    RNAnimated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            }
        })
    ).current;

    useEffect(() => {
        // Skip overwrite while undo window is active — otherwise Annulla would immediately
        // be undone by the conversation list refresh that follows refreshConversations().
        if (!isUndoActiveRef.current) {
            const nextConversations = conversations || [];
            setLocalConversations((previous) => (
                areConversationSnapshotsEqual(previous, nextConversations) ? previous : nextConversations
            ));
        }
    }, [conversations]);

    const refreshInboxManually = useCallback(async () => {
        setIsPullRefreshing(true);
        try {
            await refreshConversations();
        } finally {
            setIsPullRefreshing(false);
        }
    }, [refreshConversations]);

    // Delete a conversation with 5s undo window
    const handleDeleteConversation = useCallback((convId: string) => {
        if (!user?.id) return;

        // Optimistically remove from list
        setLocalConversations(prev => prev.filter((c: any) => c.conversation_id !== convId));

        // Store pending delete and lock the sync effect
        pendingDeleteRef.current = { convId, userId: user.id };
        isUndoActiveRef.current = true;
        clearTimeout(undoTimeoutRef.current);

        showToast(
            'error',
            'Conversazione eliminata',
            5000,
            {
                label: 'Annulla',
                onPress: () => {
                    // Cancel the pending delete
                    clearTimeout(undoTimeoutRef.current);
                    pendingDeleteRef.current = null;
                    isUndoActiveRef.current = false;
                    refreshConversations(); // Full restore from DB
                }
            }
        );

        undoTimeoutRef.current = setTimeout(async () => {
            const pending = pendingDeleteRef.current;
            isUndoActiveRef.current = false;
            if (!pending) return;
            try {
                await hideConversationMutation.mutateAsync(pending.convId);
                pendingDeleteRef.current = null;
                refreshConversations();
            } catch (e) {
                console.error('[Delete conv]', e);
                refreshConversations(); // Restore on error
            }
        }, 5000);
    }, [hideConversationMutation, user?.id, showToast, refreshConversations]);

    // Force commit deletion when user leaves the screen
    useFocusEffect(
        useCallback(() => {
            void refreshConversations();
            return undefined;
        }, [refreshConversations])
    );

    useFocusEffect(
        useCallback(() => {
            return () => {
                if (pendingDeleteRef.current) {
                    const pending = pendingDeleteRef.current;
                    hideConversationMutation.mutate(pending.convId);
                    pendingDeleteRef.current = null;
                    isUndoActiveRef.current = false;
                    clearTimeout(undoTimeoutRef.current);
                }
            };
        }, [hideConversationMutation])
    );

    useEffect(() => {
        if (!showNpoPicker) {
            panY.setValue(0);
        }
    }, [panY, showNpoPicker]);

    const handleStartChat = async (entity: any) => {
        try {
            let convId;
            if (entity.isGroup) {
                convId = await startGroupConversationMutation.mutateAsync({ activityId: entity.id, title: entity.name });
            } else {
                convId = await startPrivateConversationMutation.mutateAsync(entity.id);
            }
            setShowNpoPicker(false);
            router.push(`/messages/${convId}` as any);
        } catch (error) {
            console.error(error);
        }
    };

    // Filter logic
    const filteredConversations = (localConversations || []).filter((c: any) => {
        const conv = c.conversations;
        if (!conv) return false;

        // Search filter
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const activityData = conv.activities;
            const activityTitle = (Array.isArray(activityData) ? activityData[0]?.title : activityData?.title) || '';
            const groupTitle = activityTitle.toLowerCase();
            const lastMsgContent = conv.last_message_content?.toLowerCase() || '';

            let participantName = '';
            if (conv.type === 'PRIVATE') {
                const other = conv.participants?.find((p: any) => p.user_id !== user?.id);
                participantName = other?.profiles?.name?.toLowerCase() || other?.profiles?.npo_name?.toLowerCase() || '';
            }

            const isMatch = groupTitle.includes(query) || lastMsgContent.includes(query) || participantName.includes(query);
            if (!isMatch) return false;
        }

        if (activeTab === 'Tutti') return true;
        if (activeTab === 'Gruppi Attività') return conv.type === 'ACTIVITY_GROUP';
        if (activeTab === 'Privati') return conv.type === 'PRIVATE';
        return true;
    }).sort((a: any, b: any) => {
        const aConv = a.conversations;
        const bConv = b.conversations;

        // Pure date-based sorting: most recent first (Standard behavior)
            const aTime = new Date(aConv?.last_message_at || a?.inbox_visible_at || aConv?.created_at || 0).getTime();
            const bTime = new Date(bConv?.last_message_at || b?.inbox_visible_at || bConv?.created_at || 0).getTime();

        return bTime - aTime;
    });

    return (
        <StandardLayout
            label="LE TUE CONVERSAZIONI"
            title="MESSAGGI"
            onBack={() => router.back()}
            bg="bg-white"
            noPadding
            noScroll
        >
            <View className="flex-1">
                {/* Search and Create Chat Row (Moved below header) */}
                <View className="px-5 py-3 flex-row items-center justify-between">
                    {/* Search Bar */}
                    <View className="flex-1 flex-row items-center bg-slate-50 rounded-full px-4 h-12 mr-3 border border-slate-200">
                        <Search size={20} color="#64748b" />
                        <TextInput
                            className="flex-1 ml-3 text-base text-slate-800 h-full"
                            placeholder="Cerca..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {/* Create Chat Icon */}
                    <TouchableOpacity
                        onPress={() => {
                            setShowNpoPicker(true);
                            void availableEntitiesQuery.refetch();
                        }}
                        style={{ backgroundColor: Colors.accent }} // Pink/Magenta color from photo
                        className="w-12 h-12 rounded-full items-center justify-center shadow-sm"
                    >
                        <Edit size={22} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tabs matching the image */}
                <View className="px-5 pt-2">
                    <View className="flex-row border-b border-gray-200">
                        {['Tutti', 'Gruppi Attività', 'Privati'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab as any)}
                                className={`mr-6 py-3 border-b-2 border-solid ${activeTab === tab ? 'border-primary' : 'border-transparent'}`}
                            >
                                <Text className={`font-semibold ${activeTab === tab ? 'text-primary' : 'text-slate-500'}`}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* List */}
                {activeTab === 'Privati' && filteredConversations.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-10 pt-10">
                        <Text className="text-slate-400 font-bold text-center mb-2">Chat Private</Text>
                                        <Text className="text-slate-400 text-sm text-center leading-5">
                                            Nessuna chat privata visibile al momento. Avviane una da un profilo o dal pulsante in alto.
                                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredConversations}
                        keyExtractor={(item) => item.conversation_id}
                        onRefresh={refreshInboxManually}
                        refreshing={isPullRefreshing || isRefreshing}
                        renderItem={({ item }) => {
                            const conv = item.conversations;
                            if (!conv) return null;

                            // Use denormalized fields directly from the parent conversation
                            const isStartedPrivate = conv.type === 'PRIVATE' && !!item.inbox_visible_at && !conv.last_message_at;
                            const lastMessageContent = conv.last_message_content || (isStartedPrivate ? 'Chat avviata' : '');
                            const lastMessageAt = conv.last_message_at || item.inbox_visible_at || conv.created_at;
                            const lastMessageSenderId = conv.last_message_sender_id;

                            const isGroup = conv.type === 'ACTIVITY_GROUP';
                            const currentParticipant = conv.participants?.find((p: any) => p.user_id === user?.id);
                            const isMuted = item.notifications_muted === true || currentParticipant?.notifications_muted === true;
                            // Determine title and avatar
                            const activityData = conv.activities;
                            const activityTitle = Array.isArray(activityData) ? activityData[0]?.title : activityData?.title;
                            let displayTitle = isGroup ? (activityTitle || 'Gruppo Attività') : (item.inbox_title || 'Chat Diretta');
                            let displayAvatar = item.inbox_avatar_url;

                            if (!isGroup) {
                                const other = conv.participants?.find((p: any) => p.user_id !== user?.id);
                                if (other?.profiles) {
                                    displayTitle = item.inbox_title || other.profiles.npo_name || other.profiles.name || 'Chat Diretta';
                                    displayAvatar = item.inbox_avatar_url || other.profiles.avatar;
                                }
                            }

                            return (
                                <SwipeableConversationItem onDelete={() => handleDeleteConversation(item.conversation_id)}>
                                    <ConversationListItem
                                        title={displayTitle}
                                        avatarUrl={displayAvatar}
                                        lastMessage={lastMessageContent}
                                        timestamp={formatRelativeDate(lastMessageAt)}
                                        unreadCount={item.unread_count || 0}
                                        isGroup={isGroup}
                                        lastSenderName={lastMessageSenderId === user?.id ? 'Tu' : (isGroup ? (conv.participants?.find((p: any) => p.user_id === lastMessageSenderId)?.profiles?.name || 'Utente') : undefined)}
                                        isOwnLastMessage={lastMessageSenderId === user?.id}
                                        isMuted={isMuted}
                                        onPress={() => router.push(`/messages/${item.conversation_id}` as any)}
                                    />
                                </SwipeableConversationItem>
                            );
                        }}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center pt-20 px-8">
                                <View className="w-14 h-14 rounded-3xl bg-primary/5 items-center justify-center mb-4">
                                    <UsersIcon size={24} color={Colors.primary} />
                                </View>
                                <Text className="text-slate-700 font-black text-base text-center">Nessuna conversazione trovata</Text>
                                <Text className="text-slate-400 text-sm text-center mt-2 leading-5">
                                    Prova a cambiare filtro o avvia una nuova chat dal pulsante in alto.
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Modal for NPO Picker */}
                <Modal
                    visible={showNpoPicker}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowNpoPicker(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        className="flex-1 bg-black/50 justify-end"
                        onPress={() => setShowNpoPicker(false)}
                    >
                        <RNAnimated.View
                            style={{
                                transform: [{ translateY: panY }],
                                width: '100%'
                            }}
                            {...panResponder.panHandlers}
                        >
                            <TouchableOpacity
                                activeOpacity={1}
                                className="bg-white rounded-t-[40px] h-[80%] pt-2 px-6 pb-10"
                                onPress={(e) => e.stopPropagation()}
                            >
                                {/* Modal Handle */}
                                <View className="items-center mb-6">
                                    <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
                                </View>

                                <View className="flex-row items-center justify-between mb-6">
                                    <View>
                                        <Text className="text-2xl font-black text-primary">Nuova Chat</Text>
                                        <Text className="text-slate-500 font-medium">
                                            {user?.role === 'NPO' ? 'Volontari e gruppi attività' : 'Seleziona un\'organizzazione'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowNpoPicker(false)}
                                        className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center"
                                    >
                                        <X size={24} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                {loadingNpos ? (
                                    <View className="flex-1 items-center justify-center">
                                        <ActivityIndicator color={Colors.primary} size="large" />
                                    </View>
                                ) : myNpos.length === 0 ? (
                                    <View className="flex-1 items-center justify-center py-10">
                                        <View className="bg-slate-50 w-20 h-20 rounded-full items-center justify-center mb-4">
                                            <UsersIcon size={32} color="#94a3b8" />
                                        </View>
                                        <Text className="text-slate-400 font-bold text-lg text-center">Nessun Ente trovato</Text>
                                        <Text className="text-slate-400 text-center mt-2 px-10">
                                            Devi essere parte di almeno un&apos;attività per poter chattare con un&apos;organizzazione.
                                        </Text>
                                    </View>
                                ) : (
                                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                                        <View className="gap-3 pb-10">
                                            {myNpos.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    onPress={() => handleStartChat(item)}
                                                    activeOpacity={0.7}
                                                    className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex-row items-center gap-4"
                                                >
                                                    <View className={`w-14 h-14 rounded-full items-center justify-center border border-slate-100 ${item.isGroup ? 'bg-indigo-50' : 'bg-white'}`}>
                                                        {item.isGroup ? (
                                                            <UsersIcon size={24} color={Colors.primary} />
                                                        ) : (
                                                            <Image
                                                                source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name || item.full_name || 'OldUser'}` }}
                                                                className="w-full h-full rounded-full"
                                                            />
                                                        )}
                                                    </View >
                                                    <View className="flex-1">
                                                        <Text className="text-primary font-black text-lg" numberOfLines={1}>
                                                            {item.name || item.full_name || item.npoName || 'Utente'}
                                                        </Text>
                                                        <Text className="text-slate-500 text-sm font-medium" numberOfLines={1}>
                                                            {item.isGroup ? 'Chat di Gruppo' : (item.publicEmail || item.email || 'Chat Privata')}
                                                        </Text>
                                                    </View>
                                                    <View className="bg-white p-2 rounded-2xl shadow-sm">
                                                        <ChevronRight size={20} color={Colors.primary} />
                                                    </View>
                                                </TouchableOpacity >
                                            ))}
                                        </View >
                                    </ScrollView>
                                )}
                            </TouchableOpacity>
                        </RNAnimated.View>
                    </TouchableOpacity>
                </Modal>
            </View>
        </StandardLayout>
    );
}
