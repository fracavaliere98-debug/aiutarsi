import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, ScrollView, Image, ActivityIndicator, PanResponder, Animated as RNAnimated, RefreshControl } from 'react-native';
import { Search, Edit, ArrowLeft, Users as UsersIcon, ChevronRight, X } from 'lucide-react-native';
import { ConversationListItem } from '../../components/ConversationListItem';
import { useChat } from '../../context/ChatContext';
import { useRouter, Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import ChatService from '../../services/ChatService';

import { StandardLayout } from '../../components/StandardLayout'; // Ensure StandardLayout is imported

export default function MessagesListScreen() {
    const router = useRouter();
    const { conversations, refreshConversations } = useChat();
    const { user, getUserById } = useAuth();
    const [activeTab, setActiveTab] = useState<'Tutti' | 'Gruppi Attività' | 'Privati'>('Tutti');
    const [showNpoPicker, setShowNpoPicker] = useState(false);
    const [myNpos, setMyNpos] = useState<any[]>([]); // For volunteers: NPOs. For NPOs: combined volunteers + groups
    const [loadingNpos, setLoadingNpos] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const panY = React.useRef(new RNAnimated.Value(0)).current;

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
        if (!showNpoPicker) {
            panY.setValue(0);
        }
    }, [showNpoPicker]);

    const fetchMyNpos = async () => {
        setLoadingNpos(true);
        try {
            if (user?.role === 'NPO') {
                const { volunteers, groups } = await ChatService.getAvailableEntitiesForNPO(user.id);
                // Combine them for the list
                const combined = [
                    ...groups.map((g: any) => ({ ...g, isGroup: true })),
                    ...volunteers.map((v: any) => ({ ...v, isGroup: false }))
                ];
                setMyNpos(combined);
            } else {
                // Fetch NPOs where user is a participant or following
                const { data } = await ChatService.getAvailableNpos(user?.id || '');
                if (data) setMyNpos(data.map((n: any) => ({ ...n, isGroup: false })));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingNpos(false);
        }
    };

    const handleStartChat = async (entity: any) => {
        try {
            let convId;
            if (entity.isGroup) {
                convId = await ChatService.startGroupConversation(entity.id, entity.name, user?.id);
            } else {
                convId = await ChatService.startPrivateConversation(user?.id || '', entity.id);
            }
            setShowNpoPicker(false);
            router.push(`/messages/${convId}` as any);
        } catch (error) {
            console.error(error);
        }
    };

    // Filter logic
    const filteredConversations = (conversations || []).filter((c: any) => {
        const conv = c.conversations;
        if (!conv) return false;

        // Search filter
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const groupTitle = conv.activities?.title?.toLowerCase() || '';
            const lastMsgContent = conv.messages?.[0]?.content?.toLowerCase() || '';

            let participantName = '';
            if (conv.type === 'PRIVATE') {
                const other = conv.participants?.find((p: any) => p.user_id !== user?.id);
                participantName = other?.user?.full_name?.toLowerCase() || other?.user?.npo_name?.toLowerCase() || '';
            }

            const isMatch = groupTitle.includes(query) || lastMsgContent.includes(query) || participantName.includes(query);
            if (!isMatch) return false;
        }

        if (activeTab === 'Tutti') return true;
        if (activeTab === 'Gruppi Attività') return conv.type === 'ACTIVITY_GROUP';
        if (activeTab === 'Privati') return conv.type === 'PRIVATE';
        return true;
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
                            fetchMyNpos();
                        }}
                        style={{ backgroundColor: '#D81B60' }} // Pink/Magenta color from photo
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
                            Al momento non è ancora possibile chattare direttamente con altri volontari. Stiamo lavorando per te!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredConversations}
                        keyExtractor={(item) => item.conversation_id}
                        onRefresh={refreshConversations}
                        refreshing={false}
                        renderItem={({ item }) => {
                            const conv = item.conversations;
                            if (!conv) return null;

                            const lastMessage = conv.messages?.[0];
                            const isGroup = conv.type === 'ACTIVITY_GROUP';
                            const isUnread = lastMessage && lastMessage.created_at > item.last_read_at && lastMessage.sender_id !== user?.id;

                            // Determine title and avatar
                            let displayTitle = isGroup ? (conv.activities?.title || 'Gruppo Attività') : 'Chat Diretta';
                            let displayAvatar = undefined;

                            if (!isGroup) {
                                const other = conv.participants?.find((p: any) => p.user_id !== user?.id);
                                if (other?.profiles) {
                                    displayTitle = other.profiles.npo_name || other.profiles.full_name || 'Chat Diretta';
                                    displayAvatar = other.profiles.avatar_url;
                                }
                            }

                            return (
                                <ConversationListItem
                                    title={displayTitle}
                                    avatarUrl={displayAvatar}
                                    lastMessage={lastMessage?.content || ''}
                                    timestamp={lastMessage ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    unreadCount={isUnread ? 1 : 0}
                                    isGroup={isGroup}
                                    lastSenderName={lastMessage?.sender_id === user?.id ? 'Tu' : (isGroup ? (getUserById(lastMessage.sender_id)?.name || 'Utente') : undefined)}
                                    isOwnLastMessage={lastMessage?.sender_id === user?.id}
                                    onPress={() => router.push(`/messages/${item.conversation_id}` as any)}
                                />
                            );
                        }}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center pt-20">
                                <Text className="text-slate-400 font-medium">Nessuna conversazione trovata</Text>
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
                                                                source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name || item.full_name || 'User'}` }}
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
