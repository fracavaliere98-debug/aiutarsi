import React, { useCallback, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, RefreshControl,
    ActivityIndicator, Modal, Image, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Bell } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { useCommunity } from '../../../context/CommunityContext';
import { useAuth } from '../../../context/AuthContext';
import { useActivities } from '../../../context/ActivityContext';
import { StoriesRow } from '../../../components/StoriesRow';
import { CommunityPostCard } from '../../../components/CommunityPostCard';
import { CommunityPost } from '../../../types/community';
import { Story } from '../../../types/stories';
import { Activity } from '../../../types';

const SCREEN_W = Dimensions.get('window').width;

// ── Weekend Events Banner ──────────────────────────────────────────────────────
function WeekendEventsBanner({ activities }: { activities: Activity[] }) {
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
}

// ── Suggested Activity Card (feed inline) ─────────────────────────────────────
function SuggestedActivityInFeed({ activity }: { activity: Activity }) {
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
}

// ── Main Community Screen ─────────────────────────────────────────────────────
export default function CommunityScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { posts, isLoading, fetchFeed } = useCommunity();
    const { activities } = useActivities();
    const [refreshing, setRefreshing] = useState(false);
    const [storyPost, setStoryPost] = useState<Story | null>(null);

    const isNPO = user?.role === 'NPO';

    // Build hybrid feed items: 2 posts → 1 suggested activity → repeat
    // Weekend banner always appended at the end (or after 4 items if feed is long)
    const suggestedActivities = activities
        .filter(a => a.status === 'APERTA')
        .sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0))
        .slice(0, 10);

    type FeedItem =
        | { type: 'post'; data: CommunityPost; key: string }
        | { type: 'activity'; data: Activity; key: string }
        | { type: 'weekend'; key: string };

    const feedItems: FeedItem[] = [];
    let actIdx = 0;
    let weekendInserted = false;

    for (let i = 0; i < posts.length; i++) {
        feedItems.push({ type: 'post', data: posts[i], key: `post_${posts[i].id}` });
        // Every 2 posts, inject a suggested activity
        if ((i + 1) % 2 === 0 && actIdx < suggestedActivities.length) {
            feedItems.push({ type: 'activity', data: suggestedActivities[actIdx], key: `act_${suggestedActivities[actIdx].id}` });
            actIdx++;
        }
        // Insert weekend banner inline once the feed reaches 4 items
        if (!weekendInserted && feedItems.length >= 4) {
            feedItems.push({ type: 'weekend', key: 'weekend_banner' });
            weekendInserted = true;
        }
    }

    // Always ensure the weekend banner appears (even with 0–3 posts)
    if (!weekendInserted) {
        feedItems.push({ type: 'weekend', key: 'weekend_banner' });
    }

    // Always show at least 3 suggested activities after the posts / banner
    const remainingActs = suggestedActivities.slice(actIdx, actIdx + Math.max(3, suggestedActivities.length - actIdx));
    remainingActs.forEach(a => {
        feedItems.push({ type: 'activity', data: a, key: `act_${a.id}` });
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchFeed();
        setRefreshing(false);
    }, [fetchFeed]);

    const renderItem = ({ item }: { item: FeedItem }) => {
        if (item.type === 'post') return <CommunityPostCard post={item.data} />;
        if (item.type === 'activity') return <SuggestedActivityInFeed activity={item.data} />;
        if (item.type === 'weekend') return <WeekendEventsBanner activities={activities} />;
        return null;
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <SafeAreaView edges={['top']}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 26, fontWeight: '900', color: Colors.primary }}>Community</Text>
                        <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '600' }}>Storie di impatto condivise</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {isNPO && (
                            <TouchableOpacity
                                onPress={() => router.push('/community/create-post' as any)}
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                                activeOpacity={0.85}
                            >
                                <Plus size={20} color="white" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <Bell size={18} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {isLoading && posts.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ marginTop: 12, color: '#94a3b8', fontWeight: '600' }}>Caricamento Community...</Text>
                </View>
            ) : (
                <FlatList
                    data={feedItems}
                    keyExtractor={item => item.key}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListHeaderComponent={<StoriesRow isNPO={isNPO} onAddStory={() => router.push({ pathname: '/community/create-post', params: { mode: 'story' } } as any)} onStoryPress={setStoryPost} />}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                            <Text style={{ fontSize: 40 }}>🌱</Text>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>La community sta crescendo</Text>
                            <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                                {isNPO
                                    ? 'Pubblica il primo post per far sapere a tutti cosa sta succedendo!'
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
            )}

            {/* Story viewer modal */}
            <Modal visible={!!storyPost} animationType="fade" transparent onRequestClose={() => setStoryPost(null)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setStoryPost(null)} activeOpacity={1}>
                    {storyPost?.image_url && (
                        <Image
                            source={{ uri: storyPost.image_url }}
                            style={{ width: SCREEN_W, height: SCREEN_W * 1.4 }}
                            resizeMode="contain"
                        />
                    )}
                    {storyPost?.caption && (
                        <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 24 }}>{storyPost.caption}</Text>
                        </View>
                    )}
                    {storyPost?.expires_at && (
                        <View style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                                Scade tra {Math.max(0, Math.floor((new Date(storyPost.expires_at).getTime() - Date.now()) / 3600000))}h
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
