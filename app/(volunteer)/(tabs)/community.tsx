import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
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

    const isNPO = user?.role === 'NPO';

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchFeed(), fetchStories(), refreshActivities()]);
        setRefreshing(false);
    }, [fetchFeed, fetchStories, refreshActivities]);

    const onLoadMore = useCallback(async () => {
        if (isLoadingMore || posts.length === 0) return;
        setIsLoadingMore(true);
        const oldestPost = posts[posts.length - 1];
        await fetchFeed(oldestPost.created_at || undefined);
        setIsLoadingMore(false);
    }, [isLoadingMore, posts, fetchFeed]);

    const rightElement = isNPO ? <NPOHeaderActions showAddPost={true} /> : <VolunteerHeaderActions />;

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
