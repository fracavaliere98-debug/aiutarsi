import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Sparkles, MapPin, Calendar, ArrowRight } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { StoriesRow } from '../StoriesRow';
import { CommunityPostCard } from '../CommunityPostCard';
import { CommunityPost } from '../../types/community';
import { AppActivity } from '../../types';
import { Story } from '../../types/stories';
import { gemmaService } from '../../services/GemmaService';

interface VolunteerCommunityScreenProps {
    posts: CommunityPost[];
    activities: AppActivity[];
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
    isLoading,
    isLoadingMore,
    refreshing,
    onRefresh,
    onLoadMore,
    onStoryPress,
}: VolunteerCommunityScreenProps) {
    const router = useRouter();
    const [gemmaSummary, setGemmaSummary] = useState<string>('');

    const highlightPost = useMemo(
        () => posts.find((post) => post.linked_activity?.status === 'APERTA') || posts[0] || null,
        [posts]
    );

    const suggestedActivities = useMemo(
        () =>
            activities
                .filter((activity) => activity.status === 'APERTA')
                .sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0))
                .slice(0, 5),
        [activities]
    );

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

    useEffect(() => {
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
    }, [suggestedActivities]);

    const listHeader = (
        <View>
            <StoriesRow onStoryPress={onStoryPress} />

            <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                <View
                    style={{
                        backgroundColor: '#fff7ed',
                        borderRadius: 24,
                        padding: 18,
                        borderWidth: 1,
                        borderColor: '#fed7aa',
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            <Sparkles size={18} color="#ea580c" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 0.5, color: '#c2410c', textTransform: 'uppercase' }}>
                                Gemma per te
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary, marginTop: 2 }}>
                                Cosa merita attenzione
                            </Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: '#7c2d12' }}>
                        {gemmaSummary || 'Prima storie utili e attività aperte. Il resto viene dopo.'}
                    </Text>
                </View>
            </View>

            {highlightPost ? (
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                        if (highlightPost.linked_activity?.id) {
                            router.push(`/activity/${highlightPost.linked_activity.id}` as any);
                        } else {
                            router.push(`/npo-profile/${highlightPost.author_id}` as any);
                        }
                    }}
                    style={{
                        marginHorizontal: 16,
                        marginBottom: 18,
                        backgroundColor: 'white',
                        borderRadius: 24,
                        padding: 18,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        shadowColor: '#0f172a',
                        shadowOpacity: 0.06,
                        shadowRadius: 12,
                        elevation: 3,
                    }}
                >
                    <Text style={{ fontSize: 12, fontWeight: '900', color: Colors.accent, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                        Dal tuo feed
                    </Text>
                    <Text style={{ fontSize: 17, fontWeight: '900', color: Colors.primary, marginBottom: 6 }}>
                        {highlightPost.linked_activity?.title || highlightPost.author?.npo_name || 'Aggiornamento dalla community'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }} numberOfLines={2}>
                        {highlightPost.caption || 'Un nuovo aggiornamento dalla community che merita attenzione.'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary }}>
                            {highlightPost.linked_activity ? 'Apri attività' : 'Vai al profilo ente'}
                        </Text>
                        <ArrowRight size={16} color={Colors.primary} style={{ marginLeft: 6 }} />
                    </View>
                </TouchableOpacity>
            ) : null}

            {weekendActivity ? (
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push(`/activity/${weekendActivity.id}` as any)}
                    style={{
                        marginHorizontal: 16,
                        marginBottom: 22,
                        backgroundColor: '#f5f3ff',
                        borderRadius: 24,
                        padding: 18,
                        borderWidth: 1,
                        borderColor: '#ddd6fe',
                    }}
                >
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        Questo weekend
                    </Text>
                    <Text style={{ fontSize: 17, fontWeight: '900', color: Colors.primary, marginBottom: 10 }}>
                        {weekendActivity.title}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} color="#7c3aed" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6d28d9' }}>
                                {new Date(weekendActivity.dateTime).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} color="#7c3aed" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6d28d9' }}>
                                {getCityLabel(weekendActivity.location?.address)}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            ) : null}

            <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Aggiornamenti della community
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 20 }}>
                        Storie e risultati prima. Opportunità dopo.
                    </Text>
                </View>
            </View>
    );

    const listFooter = (
        <View style={{ paddingBottom: 100 }}>
            {suggestedActivities.length > 0 ? (
                <View style={{ marginTop: 10 }}>
                    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Opportunità dalla community
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                            Se vuoi passare all’azione, parti da qui.
                        </Text>
                    </View>
                    <FlashList
                        horizontal
                        data={suggestedActivities}
                        keyExtractor={(item) => item.id}
                        estimatedItemSize={220}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        renderItem={({ item }) => (
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
                                        {item.matchPercentage || 0}% match
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            ) : null}

            {isLoadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} /> : null}
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
            contentContainerStyle={{ paddingBottom: 20 }}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
                    <Text style={{ fontSize: 40 }}>🌱</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>La tua community sta iniziando a muoversi</Text>
                    <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                        Segui alcuni enti e torna qui per vedere storie, attività e aggiornamenti più vicini a te.
                    </Text>
                </View>
            }
        />
    );
}
