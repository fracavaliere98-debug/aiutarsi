import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { StoriesRow } from '../StoriesRow';
import { CommunityPostCard } from '../CommunityPostCard';
import { CommunityPost } from '../../types/community';
import { AppActivity } from '../../types';
import { CommunityPostDraftResult, gemmaService } from '../../services/GemmaService';
import { useAuth } from '../../context/AuthContext';
import { CommunityHero } from './CommunityHero';
import { CommunityCompactPostCard } from './CommunityCompactPostCard';
import { useNPOApplications } from '../../hooks/applications/selectors';
import { StoryAuthorGroup } from '../../hooks/stories/types';
import { colors, palette, spacing } from "@/theme";

interface NPOCommunityScreenProps {
    posts: CommunityPost[];
    activities: AppActivity[];
    storyGroups: StoryAuthorGroup[];
    storiesLoading?: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onStoryPress: (groupIndex: number) => void;
}

export function NPOCommunityScreen({
    posts,
    activities,
    storyGroups,
    storiesLoading,
    isLoading,
    isLoadingMore,
    refreshing,
    onRefresh,
    onLoadMore,
    onStoryPress,
}: NPOCommunityScreenProps) {
    const router = useRouter();
    const { user, getNPOFollowers } = useAuth();
    const applications = useNPOApplications(user, user?.id);
    const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null);
    const [showHero, setShowHero] = useState(true);

    const npoVoices = useMemo(
        () => posts.filter((post) => post.author?.role === 'NPO' && post.author_id !== user?.id).slice(0, 2),
        [posts, user?.id]
    );

    const myOpenActivities = useMemo(
        () =>
            activities
                .filter((activity) => activity.status === 'APERTA')
                .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                .slice(0, 3),
        [activities]
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

    const metrics = useMemo(() => {
        const totalDonatedHours = activities
            .filter((activity) => activity.status === 'COMPLETATA')
            .reduce((acc, activity) => {
                const start = new Date(activity.dateTime).getTime();
                const end = new Date(activity.endDateTime).getTime();
                const durationHours = Math.max(0, (end - start) / (1000 * 60 * 60));
                return acc + (durationHours * activity.iscritti.length);
            }, 0);

        return {
            npoName: user?.npoName || user?.name || 'Ente',
            followerCount: user ? getNPOFollowers(user.id).length : 0,
            openActivitiesCount: myOpenActivities.length,
            pendingApplicationsCount: applications.filter((application) => application.npoId === user?.id && application.status === 'PENDING').length,
            totalImpactHours: Math.floor(totalDonatedHours),
        };
    }, [activities, applications, getNPOFollowers, myOpenActivities.length, user]);

    const openDraftScreen = (draft: CommunityPostDraftResult, params: {
        label: string;
        activity?: AppActivity | null;
    }) => {
        router.push({
            pathname: '/community/create-post',
            params: {
                mode: draft.suggestedMode,
                prefillCaption: draft.caption,
                prefillLinkedActivityId: params.activity?.id,
                draftLabel: params.label,
            },
        } as any);
    };

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
                metrics,
            });
            openDraftScreen(draft, params);
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

    const listHeader = (
        <View>
            {showHero ? (
                <CommunityHero
                    eyebrow="Condividi"
                    title="Ti suggeriamo un post!"
                    subtitle={
                        recentCompletedActivity
                            ? 'Hai già qualcosa da raccontare.'
                            : 'Post veri, volontari veri, NPO affini.'
                    }
                    accent={palette.purple800}
                    accentSoft="rgba(255,255,255,0.12)"
                    accentText={palette.purple800}
                    ctaLabel={draftLoadingId === 'today_prompt' ? '...' : 'Apri bozza'}
                    onPress={() =>
                        handleDraftFromGemma({
                            id: 'today_prompt',
                            purpose: recentCompletedActivity ? 'recent_recap' : 'community_update',
                            label: recentCompletedActivity ? 'Bozza recap' : 'Bozza community',
                            activity: recentCompletedActivity,
                        })
                    }
                    onClose={() => setShowHero(false)}
                />
            ) : null}

            <StoriesRow
                allowAddStory={true}
                onAddStory={() => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any)}
                onStoryPress={onStoryPress}
                authorGroups={storyGroups}
                isLoading={storiesLoading}
            />

            {npoVoices.length > 0 ? (
                <View
                    style={{
                        marginHorizontal: 16,
                        marginBottom: 16,
                        borderRadius: 28,
                        backgroundColor: palette.purple50,
                        borderWidth: 1,
                        borderColor: palette.purple100,
                        paddingVertical: spacing.lg,
                    }}
                >
                    <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Altre NPO da osservare
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                            Realtà simili alla tua.
                        </Text>
                    </View>
                    {npoVoices.map((post) => (
                        <CommunityCompactPostCard key={`npo_peer_voice_${post.id}`} post={post} />
                    ))}
                </View>
            ) : null}

            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 18,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 2 }}>
                            Tutto il feed
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, paddingHorizontal: 2 }}>
                            Tutti i post.
                        </Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push('/community/create-post' as any)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 999,
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', lineHeight: 18 }}>+</Text>
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Pubblica
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const listFooter = (
        <View style={{ paddingBottom: 100 }}>
            {myOpenActivities.length > 0 ? (
                <View style={{ marginTop: 10, marginBottom: 10 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Attività da valorizzare
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 20 }}>
                            Gemma puo trasformare una tua attivita aperta in un post pronto da rifinire.
                        </Text>
                    </View>
                    <FlashList
                        horizontal
                        data={myOpenActivities}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        renderItem={({ item }) => (
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
                                    width: 248,
                                    marginRight: 12,
                                    backgroundColor: palette.amber75,
                                    borderRadius: 26,
                                    borderWidth: 1,
                                    borderColor: palette.amber200,
                                    padding: spacing.lg,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <CalendarDays size={16} color={palette.orange600} />
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.orange700, marginLeft: 8 }}>
                                        {new Date(item.dateTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: '900', color: colors.primary }} numberOfLines={2}>
                                    {item.title}
                                </Text>
                                <Text style={{ fontSize: 13, color: palette.amber900, marginTop: 8, lineHeight: 19 }} numberOfLines={2}>
                                    Questa attivita ha gia il potenziale per un buon post.
                                </Text>
                                <View style={{
                                    marginTop: 12,
                                    alignSelf: 'flex-start',
                                    backgroundColor: colors.white,
                                    borderRadius: 999,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                }}>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>Apri la bozza di Gemma</Text>
                                </View>
                                {draftLoadingId === item.id ? (
                                    <View style={{ position: 'absolute', top: 12, right: 12 }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        )}
                    />
                </View>
            ) : null}

            {isLoadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} /> : null}
        </View>
    );

    return (
        <FlashList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CommunityPostCard post={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={
                isLoading ? (
                    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ fontSize: 14, color: colors.textSubtle, fontWeight: '700' }}>Caricamento community...</Text>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                        <Text style={{ fontSize: 40 }}>📣</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary }}>La tua voce può aprire la community</Text>
                        <Text style={{ fontSize: 14, color: colors.textSubtle, textAlign: 'center', lineHeight: 22 }}>
                            Pubblica il primo aggiornamento, collega una tua attività e rendi più chiaro perché vale la pena partecipare.
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push('/community/create-post' as any)}
                            style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>Pubblica il primo post</Text>
                        </TouchableOpacity>
                    </View>
                )
            }
        />
    );
}
