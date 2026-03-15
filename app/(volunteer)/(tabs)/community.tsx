import React, { useCallback, useState, useMemo, memo } from 'react';
import {
    View, Text, TouchableOpacity, RefreshControl,
    ActivityIndicator, Modal, Image, Dimensions
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Bell , AlertCircle } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { useCommunity } from '../../../context/CommunityContext';
import { useAuth } from '../../../context/AuthContext';
import { useActivities } from '../../../context/ActivityContext';
import { StoriesRow } from '../../../components/StoriesRow';
import { CommunityPostCard } from '../../../components/CommunityPostCard';
import { CommunityPost } from '../../../types/community';
import { Story } from '../../../types/stories';
import { AppActivity } from '../../../types';
import { StandardLayout } from '../../../components/StandardLayout';
import { NPOHeaderActions } from '../../../components/NPOHeaderActions';
import { VolunteerHeaderActions } from '../../../components/VolunteerHeaderActions';


const SCREEN_W = Dimensions.get('window').width;

// ── Weekend Events Banner ──────────────────────────────────────────────────────
const WeekendEventsBanner = memo(({ activities }: { activities: AppActivity[] }) => {
    const router = useRouter();
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysToSat);
    saturday.setHours(0, 0, 0, 0);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(23, 59, 59, 999);

    const weekendActs = activities
        .filter(a => {
            const d = new Date(a.dateTime);
            return d >= saturday && d <= sunday && a.status === 'APERTA';
        })
        .slice(0, 4);

    if (weekendActs.length === 0) return null;

    return (
        <View style={{ marginHorizontal: 16, marginBottom: 20, backgroundColor: '#fdf4ff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e9d5ff' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary, marginBottom: 12 }}>🗓️ Eventi del Weekend</Text>
            {weekendActs.map(act => (
                <TouchableOpacity
                    key={act.id}
                    onPress={() => router.push(`/activity/${act.id}` as any)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}
                >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#ede9fe', overflow: 'hidden' }}>
                        {act.imageUrl
                            ? <Image source={{ uri: act.imageUrl }} style={{ width: 44, height: 44 }} />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>🌟</Text></View>
                        }
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 13 }} numberOfLines={1}>{act.title}</Text>
                        <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '600' }}>
                            {new Date(act.dateTime).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {' · '}
                            {new Date(act.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>Vedi</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
});
WeekendEventsBanner.displayName = 'WeekendEventsBanner';

// ── Suggested OldActivity Card (feed inline) ─────────────────────────────────────
const SuggestedActivityInFeed = memo(({ activity }: { activity: AppActivity }) => {
    const router = useRouter();
    return (
        <TouchableOpacity
            onPress={() => router.push(`/activity/${activity.id}` as any)}
            activeOpacity={0.85}
            style={{
                marginHorizontal: 16, marginBottom: 16,
                backgroundColor: 'white', borderRadius: 20,
                overflow: 'hidden', shadowColor: '#000',
                shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
            }}
        >
            {/* Consigliata badge */}
            <View style={{ backgroundColor: '#f5f3ff', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>✨</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary }}>CONSIGLIATA PER TE</Text>
                <View style={{ flex: 1 }} />
                {activity.matchPercentage ? (
                    <View style={{ backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{activity.matchPercentage}% Match</Text>
                    </View>
                ) : null}
            </View>
            <View style={{ padding: 14 }}>
                <Text style={{ fontWeight: '900', color: Colors.primary, fontSize: 15, marginBottom: 4 }} numberOfLines={2}>{activity.title}</Text>
                <Text style={{ fontSize: 12, color: '#7c3aed', fontWeight: '700', marginBottom: 8 }}>{activity.npoName}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>📅 {new Date(activity.dateTime).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>📍 {activity.location?.address?.split(',')[0] ?? 'N/D'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: 14, alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>Dettagli →</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});
SuggestedActivityInFeed.displayName = 'SuggestedActivityInFeed';

// ── Deletion Request Banner ──────────────────────────────────────────────────
function DeletionBanner() {
    const { user } = useAuth();
    const router = useRouter();

    if (!user?.deletionRequestedAt) return null;

    const requestDate = new Date(user.deletionRequestedAt);
    const now = new Date();
    const diffTime = now.getTime() - requestDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - diffDays);

    return (
        <TouchableOpacity
            onPress={() => router.push('/(volunteer)/(tabs)/profile')}
            activeOpacity={0.9}
            style={{
                backgroundColor: '#fee2e2',
                paddingVertical: 10,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderBottomColor: '#fecaca',
                gap: 8
            }}
        >
            <AlertCircle size={14} color="#b91c1c" />
            <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '700' }}>
                Account in eliminazione ({daysRemaining}gg). Per annullare clicca qui
            </Text>
        </TouchableOpacity>
    );
}

// ── Main Community Screen ─────────────────────────────────────────────────────
export default function CommunityScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { posts, isLoading, fetchFeed } = useCommunity();
    const { activities } = useActivities();
    const [refreshing, setRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [storyViewer, setStoryViewer] = useState<{ stories: Story[], index: number } | null>(null);

    const isNPO = user?.role === 'NPO';

    type FeedItem =
        | { type: 'post'; data: CommunityPost; key: string }
        | { type: 'activity'; data: AppActivity; key: string }
        | { type: 'weekend'; key: string };

    // ── Feed Construction (Optimized with useMemo) ───────────────────────────
    const feedItems = useMemo(() => {
        const suggestedActs = activities
            .filter(a => a.status === 'APERTA')
            .sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0))
            .slice(0, 10);

        const items: FeedItem[] = [];
        let actIdx = 0;
        let weekendInserted = false;

        for (let i = 0; i < posts.length; i++) {
            items.push({ type: 'post', data: posts[i], key: `post_${posts[i].id}` });
            // Every 2 posts, inject a suggested activity
            if ((i + 1) % 2 === 0 && actIdx < suggestedActs.length) {
                items.push({ type: 'activity', data: suggestedActs[actIdx], key: `act_${suggestedActs[actIdx].id}` });
                actIdx++;
            }
            // Insert weekend banner inline once the feed reaches 4 items
            if (!weekendInserted && items.length >= 4) {
                items.push({ type: 'weekend', key: 'weekend_banner' });
                weekendInserted = true;
            }
        }

        if (!weekendInserted) {
            items.push({ type: 'weekend', key: 'weekend_banner' });
        }

        const remainingActs = suggestedActs.slice(actIdx, actIdx + Math.max(3, suggestedActs.length - actIdx));
        remainingActs.forEach(a => {
            items.push({ type: 'activity', data: a, key: `act_${a.id}` });
        });

        return items;
    }, [posts, activities]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchFeed();
        setRefreshing(false);
    }, [fetchFeed]);

    const onLoadMore = useCallback(async () => {
        if (isLoadingMore || posts.length === 0) return;
        setIsLoadingMore(true);
        const oldestPost = posts[posts.length - 1];
        await fetchFeed(oldestPost.created_at || undefined);
        setIsLoadingMore(false);
    }, [isLoadingMore, posts, fetchFeed]);

    const renderItem = useCallback(({ item }: { item: FeedItem }) => {
        if (item.type === 'post') return <CommunityPostCard post={item.data} />;
        if (item.type === 'activity') return <SuggestedActivityInFeed activity={item.data} />;
        if (item.type === 'weekend') return <WeekendEventsBanner activities={activities} />;
        return null;
    }, [activities]);

    // Stable header — defined outside JSX to prevent recreation on every render
    const listHeader = useMemo(() => (
        <StoriesRow
            isNPO={isNPO}
            onAddStory={() => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any)}
            onStoryPress={(stories, index) => setStoryViewer({ stories, index })}
        />
    ), [isNPO]);

    const rightElement = isNPO ? <NPOHeaderActions showAddPost={true} /> : <VolunteerHeaderActions />;

    return (
        <StandardLayout
            label="Storie di impatto condivise"
            title="Community"
            bg="bg-slate-50"
            noScroll={true}
            noPadding={true}
            rightElement={rightElement}
        >
            {user?.deletionRequestedAt && <DeletionBanner />}

            {isLoading && posts.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ marginTop: 12, color: '#94a3b8', fontWeight: '600' }}>Caricamento Community...</Text>
                </View>
            ) : (
                <View style={{ flex: 1, height: '100%' }}>
                    <FlashList<any>
                        data={feedItems}
                        keyExtractor={item => item.key}
                        getItemType={(item) => item.type}
                        renderItem={renderItem}
                        // @ts-ignore - Required for performant layout calculation, ignoring TS type mismatch
                        estimatedItemSize={220}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.5}
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        ListFooterComponent={isLoadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} /> : null}
                        ListHeaderComponent={listHeader}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                                <Text style={{ fontSize: 40 }}>🌱</Text>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>La community sta crescendo</Text>
                                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                                    {isNPO
                                        ? "Sii il primo a condividere un momento d'impatto!"
                                        : 'Le NPO che segui non hanno ancora pubblicato nulla. Torna presto!'}
                                </Text>
                                {isNPO && (
                                    <TouchableOpacity
                                        onPress={() => router.push('/community/create-post' as any)}
                                        style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                    >
                                        <Plus size={16} color="white" />
                                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>Pubblica il primo post</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                    />
                </View>
            )}

            {/* Story viewer modal */}
            {storyViewer && (() => {
                const currentStory = storyViewer.stories[storyViewer.index];
                if (!currentStory) return null;
                const authorData = currentStory.author;
                const topName = authorData?.npo_name || authorData?.full_name || 'NPO';

                const advanceStory = () => {
                    if (storyViewer.index < storyViewer.stories.length - 1) {
                        setStoryViewer({ ...storyViewer, index: storyViewer.index + 1 });
                    } else {
                        setStoryViewer(null);
                    }
                };

                const rewindStory = () => {
                    if (storyViewer.index > 0) {
                        setStoryViewer({ ...storyViewer, index: storyViewer.index - 1 });
                    } else {
                        setStoryViewer(null);
                    }
                };

                return (
                    <Modal visible={!!storyViewer} animationType="fade" transparent onRequestClose={() => setStoryViewer(null)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
                            <SafeAreaView style={{ flex: 1 }}>
                                {/* Top Progress Bar & Header */}
                                <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
                                        {storyViewer.stories.map((s, idx) => (
                                            <View key={s.id} style={{ flex: 1, height: 2, backgroundColor: idx <= storyViewer.index ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
                                        ))}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', overflow: 'hidden', marginRight: 10 }}>
                                            {authorData?.avatar_url && <Image source={{ uri: authorData.avatar_url }} style={{ width: 36, height: 36 }} />}
                                        </View>
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13, flex: 1 }}>{topName}</Text>
                                        <TouchableOpacity onPress={() => setStoryViewer(null)} style={{ padding: 10 }}>
                                            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', lineHeight: 24 }}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Media & Tap Zones */}
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    {currentStory.image_url && (
                                        <Image
                                            source={{ uri: currentStory.image_url }}
                                            style={{ width: SCREEN_W, height: SCREEN_W * 1.4 }}
                                            resizeMode="contain"
                                        />
                                    )}

                                    {/* Transparent Tap Zones Overlay */}
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
                                        <TouchableOpacity style={{ flex: 0.3 }} onPress={rewindStory} activeOpacity={1} />
                                        <TouchableOpacity style={{ flex: 0.7 }} onPress={advanceStory} activeOpacity={1} />
                                    </View>

                                    {/* Caption overlay */}
                                    {currentStory.caption && (
                                        <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
                                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 24 }}>{currentStory.caption}</Text>
                                        </View>
                                    )}
                                </View>
                            </SafeAreaView>
                        </View>
                    </Modal>
                );
            })()}
        </StandardLayout>
    );
}
