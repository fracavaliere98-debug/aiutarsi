import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useStories } from '../../../context/StoriesContext';
import { withLegacyActivityMatchSnapshot } from '../../../utils/smartMatchLegacy';
import { Story } from '../../../types/stories';
import { StandardLayout } from '../../../components/StandardLayout';
import { NPOHeaderActions } from '../../../components/NPOHeaderActions';
import { VolunteerHeaderActions } from '../../../components/VolunteerHeaderActions';
import { VolunteerCommunityScreen } from '../../../components/community/VolunteerCommunityScreen';
import { NPOCommunityScreen } from '../../../components/community/NPOCommunityScreen';
import { CommunityStoryViewer } from '../../../components/community/CommunityStoryViewer';
import { gemmaService } from '../../../services/GemmaService';
import { useActivitiesDomain } from '../../../hooks/activities/selectors';
import { useCommunityFeedView } from '../../../hooks/community/useCommunityFeedView';
import { useCommunityRealtime } from '../../../hooks/community/realtime';
import { useSmartMatchView } from '../../../hooks/smart-match/useSmartMatchView';

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
    const {
        posts,
        isLoading,
        isLoadingMore,
        refreshFeed,
        loadMoreFeed,
    } = useCommunityFeedView(user?.id, !!user);
    const { activities, loadData: refreshActivities } = useActivitiesDomain(user);
    const { allMatches } = useSmartMatchView(user);
    const { fetchStories } = useStories();
    const [refreshing, setRefreshing] = useState(false);
    const [storyViewer, setStoryViewer] = useState<{ stories: Story[], index: number } | null>(null);
    const refreshLockRef = React.useRef(false);

    const isNPO = user?.role === 'NPO';
    const [gemmaSummary, setGemmaSummary] = useState('');

    useCommunityRealtime(!!user);

    // Single source of truth: use SmartMatch scores (already adjusted for preferences)
    // so the % shown here always matches the "Consigliato per te" carousel.
    const suggestedActivities = useMemo(() => {
        const enrolledIds = new Set(user?.id
            ? activities.filter(a => a.iscritti.includes(user.id!)).map(a => a.id)
            : []
        );
        return allMatches
            .filter(m => !enrolledIds.has(m.id))
            .filter(m => m.activity?.status === 'APERTA')
            .slice(0, 5)
            .map(m => withLegacyActivityMatchSnapshot(m.activity!, m.score));
    }, [allMatches, activities, user?.id]);

    useEffect(() => {
        if (isNPO) return;

        let cancelled = false;
        const topMatches = allMatches
            .filter(m => m.score > 0)
            .slice(0, 3);

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
    }, [allMatches, isNPO]);

    const onRefresh = useCallback(async () => {
        if (refreshLockRef.current) return;
        refreshLockRef.current = true;
        try {
            const startedAt = Date.now();
            setRefreshing(true);
            await refreshFeed();
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
    }, [fetchStories, refreshActivities, refreshFeed]);

    const onLoadMore = useCallback(async () => {
        if (isLoadingMore || posts.length === 0) return;
        await loadMoreFeed();
    }, [isLoadingMore, loadMoreFeed, posts.length]);

    const rightElement = isNPO ? <NPOHeaderActions showAddPost={true} /> : <VolunteerHeaderActions showAddPost={true} />;

    return (
        <StandardLayout
            label="Storie di impatto"
            title="Community"
            bg="bg-slate-50"
            noScroll={true}
            noPadding={true}
            rightElement={rightElement}
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
                    gemmaSummary={gemmaSummary}
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
