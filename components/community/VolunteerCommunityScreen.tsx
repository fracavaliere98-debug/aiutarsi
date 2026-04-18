import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { MapPin, Calendar } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { StoriesRow } from '../StoriesRow';
import { CommunityPostCard } from '../CommunityPostCard';
import { CommunityPost } from '../../types/community';
import { AppActivity } from '../../types';
import { Story } from '../../types/stories';
import { GemmaAvatar } from '../GemmaAvatar';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { useVolunteerApplications } from '../../hooks/applications/selectors';
import { useSmartMatchActivityScoresView } from '../../hooks/smart-match/useSmartMatchView';

interface VolunteerCommunityScreenProps {
    posts: CommunityPost[];
    activities: AppActivity[];
    suggestedActivities: AppActivity[];
    gemmaSummary?: string;
    isLoading: boolean;
    isLoadingMore: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onStoryPress: (stories: Story[], index: number) => void;
}

function getCityLabel(address?: string | null) {
    if (!address) return 'la tua zona';
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    return parts[1] || parts[0] || 'la tua zona';
}

export function VolunteerCommunityScreen({
    posts,
    activities,
    suggestedActivities,
    gemmaSummary,
    isLoading,
    isLoadingMore,
    refreshing,
    onRefresh,
    onLoadMore,
    onStoryPress,
}: VolunteerCommunityScreenProps) {
    const router = useRouter();
    const { user } = useAuth();
    const volunteerApplications = useVolunteerApplications(user, user?.id);
    const { scoreMap: suggestedScoreMap } = useSmartMatchActivityScoresView(user, suggestedActivities);

    const followedNpoIds = useMemo(
        () => (user?.followedNPOs || []).filter(Boolean),
        [user?.followedNPOs]
    );
    const [sharedVolunteerAuthorIds, setSharedVolunteerAuthorIds] = useState<string[]>([]);
    const affiliatedNpoIds = useMemo(
        () =>
            volunteerApplications
                .filter((application) => application.status === 'APPROVED')
                .map((application) => application.npoId)
                .filter(Boolean),
        [volunteerApplications]
    );
    const suggestedNpoIds = useMemo(
        () => Array.from(new Set(suggestedActivities.map((activity) => activity.npoId).filter(Boolean))).slice(0, 12),
        [suggestedActivities]
    );
    const allowedStoryNpoIds = useMemo(
        () => Array.from(new Set([...followedNpoIds, ...affiliatedNpoIds, ...suggestedNpoIds])),
        [followedNpoIds, affiliatedNpoIds, suggestedNpoIds]
    );
    const volunteerPostAuthorIdsKey = useMemo(
        () =>
            Array.from(
                new Set(
                    posts
                        .filter((post) => post.author?.role === 'VOLUNTEER' && post.author_id)
                        .map((post) => post.author_id)
                        .filter(Boolean) as string[]
                )
            )
                .sort()
                .join(','),
        [posts]
    );
    const affiliatedNpoIdsKey = useMemo(
        () => [...affiliatedNpoIds].sort().join(','),
        [affiliatedNpoIds]
    );
    const stableAffiliatedNpoIds = useMemo(
        () => (affiliatedNpoIdsKey ? affiliatedNpoIdsKey.split(',') : []),
        [affiliatedNpoIdsKey]
    );

    useEffect(() => {
        let isMounted = true;

        const loadSharedVolunteerAuthors = async () => {
            const volunteerAuthorIds = volunteerPostAuthorIdsKey ? volunteerPostAuthorIdsKey.split(',') : [];

            if (!stableAffiliatedNpoIds.length || !volunteerAuthorIds.length) {
                if (isMounted) {
                    setSharedVolunteerAuthorIds((prev) => (prev.length === 0 ? prev : []));
                }
                return;
            }

            const { data, error } = await supabase
                .from('applications')
                .select('volunteer_id,npo_id')
                .in('volunteer_id', volunteerAuthorIds)
                .in('npo_id', stableAffiliatedNpoIds)
                .eq('status', 'APPROVED');

            if (error) {
                console.error('VolunteerCommunityScreen shared volunteer lookup error:', error);
                if (isMounted) {
                    setSharedVolunteerAuthorIds((prev) => (prev.length === 0 ? prev : []));
                }
                return;
            }

            if (isMounted) {
                const nextIds = Array.from(new Set((data || []).map((row: any) => row.volunteer_id).filter(Boolean))).sort();
                setSharedVolunteerAuthorIds((prev) => {
                    if (prev.length === nextIds.length && prev.every((value, index) => value === nextIds[index])) {
                        return prev;
                    }
                    return nextIds;
                });
            }
        };

        void loadSharedVolunteerAuthors();
        return () => {
            isMounted = false;
        };
    }, [stableAffiliatedNpoIds, volunteerPostAuthorIdsKey]);
    const prioritizedPosts = useMemo(() => {
        const followedSet = new Set(followedNpoIds);
        const affiliatedSet = new Set(affiliatedNpoIds);
        const sharedVolunteerSet = new Set(sharedVolunteerAuthorIds);
        return [...posts]
            .filter((post) => {
                if (post.author?.role === 'VOLUNTEER') {
                    return !!post.author_id && sharedVolunteerSet.has(post.author_id);
                }
                return true;
            })
            .sort((a, b) => {
            const relationWeight = (post: CommunityPost) => {
                if (post.author?.role === 'VOLUNTEER') return 3;
                if (post.author?.role !== 'NPO' || !post.author_id) return 4;
                if (affiliatedSet.has(post.author_id)) return 0;
                if (followedSet.has(post.author_id)) return 1;
                return 2;
            };
            const diff = relationWeight(a) - relationWeight(b);
            if (diff !== 0) return diff;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
    }, [posts, followedNpoIds, affiliatedNpoIds, sharedVolunteerAuthorIds]);

    const weekendActivity = useMemo(() => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
        const saturday = new Date(now);
        saturday.setDate(now.getDate() + daysToSat);
        saturday.setHours(0, 0, 0, 0);
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        sunday.setHours(23, 59, 59, 999);

        return (
            activities.find((activity) => {
                const date = new Date(activity.dateTime);
                return date >= saturday && date <= sunday && activity.status === 'APERTA';
            }) || null
        );
    }, [activities]);

    const gemmaTarget = suggestedActivities[0];

    const renderPostItem = useCallback(({ item }: { item: CommunityPost }) => (
        <CommunityPostCard
            post={item}
            npoRelation={
                item.author?.role !== 'NPO' || !item.author_id
                    ? null
                    : affiliatedNpoIds.includes(item.author_id)
                        ? 'affiliated'
                        : followedNpoIds.includes(item.author_id)
                            ? 'followed'
                            : null
            }
        />
    ), [affiliatedNpoIds, followedNpoIds]);

    const listHeader = useMemo(() => (
        <View>
            <View
                style={{
                    marginHorizontal: 16,
                    marginTop: 4,
                    marginBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                }}
            >
                <GemmaAvatar size={36} />
                <TouchableOpacity
                    activeOpacity={0.88}
                    disabled={!gemmaTarget && !weekendActivity}
                    testID="community-gemma-cta"
                    onPress={() => {
                        if (gemmaTarget) {
                            router.push(`/activity/${gemmaTarget.id}` as any);
                            return;
                        }
                        if (weekendActivity) {
                            router.push(`/activity/${weekendActivity.id}` as any);
                        }
                    }}
                    style={{
                        flex: 1,
                        backgroundColor: '#f8fafc',
                        borderRadius: 18,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                    }}
                >
                    <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '800', lineHeight: 19 }}>
                        {gemmaTarget ? `Se ti va, possiamo partire da ${gemmaTarget.title}.` : gemmaSummary || 'Se ti va, qui c’è un bel punto da cui partire.'}
                    </Text>
                </TouchableOpacity>
            </View>

            <StoriesRow
                allowAddStory={true}
                onAddStory={() => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any)}
                onStoryPress={onStoryPress}
                allowedAuthorIds={allowedStoryNpoIds}
                followedAuthorIds={followedNpoIds}
                affiliatedAuthorIds={affiliatedNpoIds}
                sharedNpoIds={affiliatedNpoIds}
            />

            {weekendActivity ? (
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push(`/activity/${weekendActivity.id}` as any)}
                    style={{
                        marginHorizontal: 16,
                        marginBottom: 18,
                        backgroundColor: '#f8faff',
                        borderRadius: 26,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: '#dbe4ff',
                    }}
                >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        Questo weekend
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary, marginBottom: 10 }}>
                        {weekendActivity.title}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} color="#6366f1" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#4f46e5' }}>
                                {new Date(weekendActivity.dateTime).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} color="#6366f1" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#4f46e5' }}>
                                {getCityLabel(weekendActivity.location?.address)}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            ) : null}

            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#e2e8f0',
                    paddingTop: 18,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 2 }}>
                            Tutto il feed
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, paddingHorizontal: 2 }}>
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
                            backgroundColor: Colors.primary,
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
    ), [
        affiliatedNpoIds,
        allowedStoryNpoIds,
        followedNpoIds,
        gemmaSummary,
        gemmaTarget,
        onStoryPress,
        router,
        weekendActivity,
    ]);

    const renderSuggestedActivity = useCallback(({ item }: { item: AppActivity }) => {
        const activityScore = Math.round(suggestedScoreMap.get(item.id)?.score ?? 0);

        return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push(`/activity/${item.id}` as any)}
            style={{
                width: 250,
                marginRight: 12,
                backgroundColor: 'white',
                borderRadius: 22,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                overflow: 'hidden',
            }}
        >
            <View style={{ height: 120, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <Text style={{ fontSize: 26 }}>🌿</Text>
                )}
            </View>
            <View style={{ padding: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: Colors.primary }} numberOfLines={2}>
                    {item.title}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#7c3aed', marginTop: 4 }}>
                    {item.npoName}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                    {getCityLabel(item.location?.address)}
                    {' · '}
                    {activityScore}% match
                </Text>
            </View>
        </TouchableOpacity>
        );
    }, [router, suggestedScoreMap]);

    const listFooter = useMemo(() => (
        <View style={{ paddingBottom: 100 }}>
            {suggestedActivities.length > 0 ? (
                <View style={{ marginTop: 10 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Opportunità dalla community
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            Se vuoi partecipare, queste sono quelle che meritano uno sguardo adesso.
                        </Text>
                    </View>
                    <FlashList
                        horizontal
                        data={suggestedActivities}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        renderItem={renderSuggestedActivity}
                    />
                </View>
            ) : null}

            {isLoadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} /> : null}
        </View>
    ), [isLoadingMore, renderSuggestedActivity, suggestedActivities]);

    return (
        <FlashList
            data={prioritizedPosts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={
                isLoading ? (
                    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ fontSize: 14, color: '#94a3b8', fontWeight: '700' }}>Caricamento community...</Text>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                        <Text style={{ fontSize: 40 }}>🌱</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>La tua community sta iniziando a muoversi</Text>
                        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                            Segui alcuni enti e torna qui per vedere storie, attività e aggiornamenti più vicini a te.
                        </Text>
                    </View>
                )
            }
        />
    );
}
