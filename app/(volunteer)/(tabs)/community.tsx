import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ChevronRight } from 'lucide-react-native';
import { useCommunity } from '../../../context/CommunityContext';
import { useAuth } from '../../../context/AuthContext';
import { useActivities } from '../../../context/ActivityContext';
import { useStories } from '../../../context/StoriesContext';
import { Story } from '../../../types/stories';
import { StandardLayout } from '../../../components/StandardLayout';
import { NPOHeaderActions } from '../../../components/NPOHeaderActions';
import { VolunteerHeaderActions } from '../../../components/VolunteerHeaderActions';
import { VolunteerCommunityScreen } from '../../../components/community/VolunteerCommunityScreen';
import { NPOCommunityScreen } from '../../../components/community/NPOCommunityScreen';
import { CommunityStoryViewer } from '../../../components/community/CommunityStoryViewer';
import { GemmaAvatar } from '../../../components/GemmaAvatar';
import { gemmaService } from '../../../services/GemmaService';

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
    const { user } = useAuth();
    const { posts, isLoading, fetchFeed } = useCommunity();
    const { activities, loadData: refreshActivities } = useActivities();
    const { fetchStories } = useStories();
    const [refreshing, setRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [storyViewer, setStoryViewer] = useState<{ stories: Story[], index: number } | null>(null);
    const refreshLockRef = React.useRef(false);

    const isNPO = user?.role === 'NPO';
    const [gemmaSummary, setGemmaSummary] = useState('');

    const suggestedActivities = useMemo(
        () =>
            activities
                .filter((activity) => !user?.id || !activity.iscritti.includes(user.id))
                .filter((activity) => activity.status === 'APERTA')
                .sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0))
                .slice(0, 5),
        [activities, user?.id]
    );

    useEffect(() => {
        if (isNPO) return;

        let cancelled = false;
        const topMatches = suggestedActivities
            .filter((activity) => (activity.matchPercentage || 0) > 0)
            .slice(0, 3)
            .map((activity) => ({
                activity,
                score: activity.matchPercentage || 0,
                reasons: [],
            }));

        if (topMatches.length === 0) {
            setGemmaSummary('');
            return;
        }

        gemmaService.getSmartMatchReasons(topMatches as any).then((result) => {
            if (!cancelled) {
                setGemmaSummary(result.summary || '');
            }
        }).catch(() => {
            if (!cancelled) {
                setGemmaSummary('');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isNPO, suggestedActivities]);

    const onRefresh = useCallback(async () => {
        if (refreshLockRef.current) return;
        refreshLockRef.current = true;
        try {
            const startedAt = Date.now();
            setRefreshing(true);
            await fetchFeed();
            await fetchStories();
            await refreshActivities();
            const elapsed = Date.now() - startedAt;
            if (elapsed < 650) {
                await new Promise((resolve) => setTimeout(resolve, 650 - elapsed));
            }
        } finally {
            setRefreshing(false);
            refreshLockRef.current = false;
        }
    }, [fetchFeed, fetchStories, refreshActivities]);

    const onLoadMore = useCallback(async () => {
        if (isLoadingMore || posts.length === 0) return;
        setIsLoadingMore(true);
        const oldestPost = posts[posts.length - 1];
        await fetchFeed(oldestPost.created_at || undefined);
        setIsLoadingMore(false);
    }, [isLoadingMore, posts, fetchFeed]);

    const rightElement = isNPO ? <NPOHeaderActions showAddPost={true} /> : <VolunteerHeaderActions showAddPost={true} />;
    const gemmaHeaderTarget = suggestedActivities[0];
    const volunteerHeader = (
        <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                        <GemmaAvatar size={46} bordered />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                            {user?.name ? `Gemma per ${user.name.split(' ')[0]}` : 'Gemma'}
                        </Text>
                        <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', lineHeight: 28 }}>
                            {gemmaSummary || 'Da qui partirei oggi.'}
                        </Text>
                    </View>
                </View>
                {rightElement}
            </View>

            <TouchableOpacity
                activeOpacity={0.88}
                disabled={!gemmaHeaderTarget}
                testID="community-gemma-cta"
                onPress={() => {
                    if (gemmaHeaderTarget) {
                        router.push(`/activity/${gemmaHeaderTarget.id}` as any);
                    }
                }}
                style={{
                    borderRadius: 22,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                        Prossimo passo
                    </Text>
                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                        {gemmaHeaderTarget ? gemmaHeaderTarget.title : 'Esplora la community e trova una causa vicina'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '900' }}>
                        {gemmaHeaderTarget ? 'Apri attività' : 'Continua'}
                    </Text>
                    <ChevronRight size={16} color="white" />
                </View>
            </TouchableOpacity>
        </View>
    );

    return (
        <StandardLayout
            label={isNPO ? 'Storie di impatto' : ''}
            title={isNPO ? 'Community' : ''}
            bg="bg-slate-50"
            noScroll={true}
            noPadding={true}
            rightElement={isNPO ? rightElement : undefined}
            headerContent={isNPO ? undefined : volunteerHeader}
            hideBack={true}
        >
            {user?.deletionRequestedAt && <DeletionBanner />}

            {isNPO ? (
                <NPOCommunityScreen
                    posts={posts}
                    activities={activities.filter((activity) => activity.npoId === user?.id)}
                    isLoading={isLoading}
                    isLoadingMore={isLoadingMore}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    onLoadMore={onLoadMore}
                    onStoryPress={(stories, index) => setStoryViewer({ stories, index })}
                />
            ) : (
                <VolunteerCommunityScreen
                    posts={posts}
                    activities={activities}
                    suggestedActivities={suggestedActivities}
                    isLoading={isLoading}
                    isLoadingMore={isLoadingMore}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    onLoadMore={onLoadMore}
                    onStoryPress={(stories, index) => setStoryViewer({ stories, index })}
                />
            )}

            <CommunityStoryViewer
                viewer={storyViewer}
                onClose={() => setStoryViewer(null)}
                onChange={setStoryViewer}
            />
        </StandardLayout>
    );
}
