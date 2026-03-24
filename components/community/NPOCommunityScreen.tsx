import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Plus, Camera, Link2, Sparkles, CalendarDays } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { StoriesRow } from '../StoriesRow';
import { CommunityPostCard } from '../CommunityPostCard';
import { CommunityPost } from '../../types/community';
import { AppActivity } from '../../types';
import { Story } from '../../types/stories';
import { gemmaService } from '../../services/GemmaService';

interface NPOCommunityScreenProps {
    posts: CommunityPost[];
    activities: AppActivity[];
    isLoading: boolean;
    isLoadingMore: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onStoryPress: (stories: Story[], index: number) => void;
}

export function NPOCommunityScreen({
    posts,
    activities,
    isLoading,
    isLoadingMore,
    refreshing,
    onRefresh,
    onLoadMore,
    onStoryPress,
}: NPOCommunityScreenProps) {
    const router = useRouter();
    const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null);

    const myOpenActivities = useMemo(
        () =>
            activities
                .filter((activity) => activity.status === 'APERTA')
                .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                .slice(0, 3),
        [activities]
    );

    const latestLinkedPost = useMemo(
        () => posts.find((post) => post.linked_activity_id) || posts[0] || null,
        [posts]
    );

    const recentCompletedActivity = useMemo(() => {
        const now = Date.now();
        return activities
            .filter((activity) => {
                if (activity.status !== 'COMPLETATA') return false;
                const diffDays = (now - new Date(activity.dateTime).getTime()) / (1000 * 60 * 60 * 24);
                return diffDays >= 0 && diffDays <= 14;
            })
            .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())[0] || null;
    }, [activities]);

    const handleDraftFromGemma = async (params: {
        id: string;
        purpose: 'activity_promo' | 'recent_recap' | 'community_update';
        label: string;
        activity?: AppActivity | null;
    }) => {
        setDraftLoadingId(params.id);
        try {
            const draft = await gemmaService.getCommunityPostDraft({
                purpose: params.purpose,
                activity: params.activity ? {
                    id: params.activity.id,
                    title: params.activity.title,
                    description: params.activity.description,
                    dateTime: params.activity.dateTime,
                    location: params.activity.location?.address,
                    npoName: params.activity.npoName,
                } : undefined,
            });

            router.push({
                pathname: '/community/create-post',
                params: {
                    mode: draft.suggestedMode,
                    prefillCaption: draft.caption,
                    prefillLinkedActivityId: params.activity?.id,
                    draftLabel: params.label,
                },
            } as any);
        } catch {
            router.push({
                pathname: '/community/create-post',
                params: {
                    prefillCaption: params.activity?.title
                        ? `Stiamo preparando ${params.activity.title}. Se vuoi saperne di più o partecipare, trovi tutti i dettagli nell'attività collegata.`
                        : 'Oggi vogliamo condividere un aggiornamento semplice ma importante con chi ci segue.',
                    prefillLinkedActivityId: params.activity?.id,
                    draftLabel: params.label,
                },
            } as any);
        } finally {
            setDraftLoadingId(null);
        }
    };

    const quickActions = [
        {
            key: 'post',
            label: 'Nuovo post',
            icon: Plus,
            onPress: () => router.push('/community/create-post' as any),
        },
        {
            key: 'story',
            label: 'Nuova storia',
            icon: Camera,
            onPress: () => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any),
        },
        {
            key: 'link',
            label: 'Collega attività',
            icon: Link2,
            onPress: () => router.push('/community/create-post' as any),
        },
    ];

    const listHeader = (
        <View>
            <StoriesRow isNPO={true} onAddStory={() => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any)} onStoryPress={onStoryPress} />

            <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                <View
                    style={{
                        backgroundColor: '#eef2ff',
                        borderRadius: 24,
                        padding: 18,
                        borderWidth: 1,
                        borderColor: '#c7d2fe',
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            <Sparkles size={18} color={Colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 0.5, color: Colors.accent, textTransform: 'uppercase' }}>
                                Gemma per la community
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary, marginTop: 2 }}>
                                Pubblica meno, ma meglio
                            </Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: '#4338ca' }}>
                        Gemma ti prepara spunti rapidi da trasformare in post o storie.
                    </Text>
                </View>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                    Azioni rapide
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <TouchableOpacity
                                key={action.key}
                                activeOpacity={0.88}
                                onPress={action.onPress}
                                style={{
                                    flex: 1,
                                    backgroundColor: 'white',
                                    borderRadius: 20,
                                    paddingVertical: 16,
                                    paddingHorizontal: 12,
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={18} color={Colors.primary} />
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, textAlign: 'center' }}>{action.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 18,
                    backgroundColor: 'white',
                    borderRadius: 24,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                }}
            >
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Cosa pubblicare oggi
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary, marginBottom: 6 }}>
                    {recentCompletedActivity ? 'Condividi un momento con i volontari' : 'Fatti vedere dalla community'}
                </Text>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                    {recentCompletedActivity
                        ? 'Foto, ringraziamenti o un dietro le quinte: basta poco per restare presenti.'
                        : 'Un aggiornamento breve o una storia sono spesso meglio di un post lungo.'}
                </Text>
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() =>
                        handleDraftFromGemma({
                            id: 'today_prompt',
                            purpose: recentCompletedActivity ? 'recent_recap' : 'community_update',
                            label: recentCompletedActivity ? 'Bozza per condividere foto o ringraziamenti' : 'Bozza rapida per aggiornare la community',
                            activity: recentCompletedActivity,
                        })
                    }
                    style={{
                        marginTop: 12,
                        alignSelf: 'flex-start',
                        backgroundColor: '#ede9fe',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 16,
                    }}
                >
                    {draftLoadingId === 'today_prompt' ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary }}>Apri bozza Gemma</Text>
                    )}
                </TouchableOpacity>
            </View>

            {myOpenActivities.length > 0 ? (
                <View style={{ marginBottom: 18 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Attività da valorizzare
                        </Text>
                    </View>
                    <FlashList
                        horizontal
                        data={myOpenActivities}
                        keyExtractor={(item) => item.id}
                        estimatedItemSize={220}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                activeOpacity={0.88}
                                onPress={() => router.push(`/activity/${item.id}` as any)}
                                onLongPress={() =>
                                    handleDraftFromGemma({
                                        id: item.id,
                                        purpose: 'activity_promo',
                                        label: `Bozza per promuovere ${item.title}`,
                                        activity: item,
                                    })
                                }
                                style={{
                                    width: 248,
                                    marginRight: 12,
                                    backgroundColor: '#fff7ed',
                                    borderRadius: 22,
                                    borderWidth: 1,
                                    borderColor: '#fed7aa',
                                    padding: 16,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <CalendarDays size={16} color="#ea580c" />
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#c2410c', marginLeft: 8 }}>
                                        {new Date(item.dateTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.primary }} numberOfLines={2}>
                                    {item.title}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#7c2d12', marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                                    Tocca per aprire l’attività. Tieni premuto per creare una bozza Gemma.
                                </Text>
                                <TouchableOpacity
                                    activeOpacity={0.88}
                                    onPress={() =>
                                        handleDraftFromGemma({
                                            id: item.id,
                                            purpose: 'activity_promo',
                                            label: `Bozza per promuovere ${item.title}`,
                                            activity: item,
                                        })
                                    }
                                    style={{
                                        marginTop: 12,
                                        alignSelf: 'flex-start',
                                        backgroundColor: '#ffffff',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                    }}
                                >
                                    {draftLoadingId === item.id ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary }}>Crea bozza</Text>
                                    )}
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            ) : null}

            {latestLinkedPost ? (
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Feed community
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 20 }}>
                        Guarda come altri enti raccontano risultati e momenti utili da condividere.
                    </Text>
                </View>
            ) : null}
        </View>
    );

    if (isLoading && posts.length === 0) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: '#94a3b8', fontWeight: '600' }}>Caricamento community...</Text>
            </View>
        );
    }

    return (
        <FlashList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CommunityPostCard post={item} />}
            estimatedItemSize={320}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListHeaderComponent={listHeader}
            ListFooterComponent={isLoadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} /> : null}
            ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                    <Text style={{ fontSize: 40 }}>📣</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>La tua voce può aprire la community</Text>
                    <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                        Pubblica il primo aggiornamento, collega una tua attività e rendi più chiaro perché vale la pena partecipare.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/community/create-post' as any)}
                        style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                        <Plus size={16} color="white" />
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>Pubblica il primo post</Text>
                    </TouchableOpacity>
                </View>
            }
        />
    );
}
