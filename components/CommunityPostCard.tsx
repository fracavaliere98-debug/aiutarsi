import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert, Animated } from 'react-native';
import { Image } from 'expo-image';
import { MoreHorizontal } from 'lucide-react-native';
import { CommunityPost, REACTION_EMOJI, ReactionType } from '../types/community';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useCommunity } from '../context/CommunityContext';
import { useToast } from '../context/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_W = Dimensions.get('window').width;

interface CommunityPostCardProps {
    post: CommunityPost;
}

export const CommunityPostCard = React.memo(({ post }: CommunityPostCardProps) => {
    const router = useRouter();
    const { user } = useAuth();
    const { toggleReaction, deletePost, reportPost } = useCommunity();
    const { showToast } = useToast();

    const handleMenuPress = () => {
        if (!user) return;
        if (user.id === post.author_id) {
            Alert.alert('Gestisci Post', 'Scegli l\'azione da eseguire:', [
                {
                    text: 'Modifica', onPress: () => {
                        router.push(`/community/create-post?mode=edit&postId=${post.id}` as any);
                    }
                },
                {
                    text: 'Elimina', style: 'destructive', onPress: async () => {
                        try {
                            await deletePost(post.id);
                            showToast('success', 'Post eliminato con successo');
                        } catch {
                            showToast('error', 'Errore durante l\'eliminazione del post');
                        }
                    }
                },
                { text: 'Annulla', style: 'cancel' }
            ]);
        } else {
            const handleReport = async (reason: string) => {
                try {
                    await reportPost(post.id, reason);
                    showToast('success', 'Segnalazione inviata! Grazie per il tuo feedback.');
                } catch {
                    showToast('error', 'Impossibile inviare la segnalazione. Riprova più tardi.');
                }
            };

            Alert.alert('Segnala Post', 'Scegli il motivo della segnalazione:', [
                { text: 'Contenuto offensivo o inappropriato', onPress: () => handleReport('Inappropriato') },
                { text: 'Spam o pubblicità', onPress: () => handleReport('Spam') },
                { text: 'Annulla', style: 'cancel' }
            ]);
        }
    };

    // Count reactions per type
    const reactionCounts: Record<ReactionType, number> = { heart: 0, clap: 0, muscle: 0, tree: 0 };
    const userReactions = new Set<ReactionType>();
    for (const r of (post.reactions || [])) {
        if (r.reaction) {
            const rType = r.reaction as ReactionType;
            if (reactionCounts[rType] !== undefined) {
                reactionCounts[rType]++;
                if (r.user_id === user?.id) userReactions.add(rType);
            }
        }
    }

    const authorName = post.author?.npo_name || post.author?.full_name || 'NPO';
    const authorProfileRoute = post.author?.role === 'VOLUNTEER'
        ? `/user-profile/${post.author_id}`
        : `/npo-profile/${post.author_id}`;
    const timeAgo = (() => {
        if (!post.created_at) return '...';
        const diff = Date.now() - new Date(post.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m fa`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h fa`;
        return `${Math.floor(hrs / 24)}g fa`;
    })();

    const scrollX = useRef(new Animated.Value(0)).current;

    const imageUrls = post.images_urls && post.images_urls.length > 0
        ? post.images_urls
        : (post.image_url ? [post.image_url] : []);

    return (
        <View style={{
            backgroundColor: 'white',
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 24,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
        }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 }}>
                <TouchableOpacity
                    onPress={() => router.push(authorProfileRoute as any)}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ede9fe', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
                >
                    {post.author?.avatar_url
                        ? <Image source={{ uri: post.author.avatar_url }} style={{ width: 40, height: 40 }} />
                        : <Text style={{ fontSize: 18 }}>🏛️</Text>
                    }
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 14 }}>{authorName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>{timeAgo}</Text>
                        {post.linked_activity && (
                            <View style={{ backgroundColor: '#f5f3ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.accent }}>
                                    {post.linked_activity.status === 'IN_CORSO' ? 'LIVE' : 'Attività collegata'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                {user && (
                    <TouchableOpacity onPress={handleMenuPress} style={{ padding: 4 }}>
                        <MoreHorizontal size={20} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Images */}
            {imageUrls.length > 0 && (
                <View style={{ position: 'relative', width: SCREEN_W - 32, maxHeight: 500, overflow: 'hidden' }}>
                    {imageUrls.length === 1 ? (
                        <Image
                            source={{ uri: imageUrls[0] }}
                            style={{ width: SCREEN_W - 32, height: Math.min((SCREEN_W - 32) * 1.1, 500) }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View>
                            <Animated.ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={Animated.event(
                                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                                    { useNativeDriver: false }
                                )}
                                scrollEventThrottle={16}
                            >
                                {imageUrls.map((uri, index) => (
                                    <Image
                                        key={index}
                                        source={{ uri }}
                                        style={{ width: SCREEN_W - 32, height: Math.min((SCREEN_W - 32) * 1.1, 500) }}
                                        resizeMode="cover"
                                    />
                                ))}
                            </Animated.ScrollView>

                            {/* Pagination Dots */}
                            <View style={{ position: 'absolute', bottom: post.linked_activity ? 80 : 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                                {imageUrls.map((_, i) => {
                                    const inputRange = [(i - 1) * (SCREEN_W - 32), i * (SCREEN_W - 32), (i + 1) * (SCREEN_W - 32)];
                                    const opacity = scrollX.interpolate({
                                        inputRange,
                                        outputRange: [0.5, 1, 0.5],
                                        extrapolate: 'clamp'
                                    });
                                    const scale = scrollX.interpolate({
                                        inputRange,
                                        outputRange: [0.8, 1.2, 0.8],
                                        extrapolate: 'clamp'
                                    });
                                    return (
                                        <Animated.View key={`dot_${i}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)', opacity, transform: [{ scale }] }} />
                                    );
                                })}
                            </View>
                        </View>
                    )}
                    {/* OldActivity anchor banner */}
                    {post.linked_activity && (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push(`/activity/${post.linked_activity!.id}` as any)}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
                        >
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.75)']}
                                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <View style={{ backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 4 }}>
                                        <Text style={{ color: 'white', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>Attività Collegata</Text>
                                    </View>
                                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                                        {post.linked_activity.title}
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                                        {new Date(post.linked_activity.date_start).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        {' · '}
                                        {new Date(post.linked_activity.date_start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }}>
                                    <Text style={{ color: Colors.primary, fontWeight: '900', fontSize: 13 }}>Apri attività</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Caption */}
            {post.caption && (
                <View style={{ padding: 14, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 14, color: '#374151', lineHeight: 21 }}>
                        {post.caption}
                    </Text>
                </View>
            )}

            {/* Reactions row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 }}>
                {(['heart', 'clap', 'muscle', 'tree'] as ReactionType[]).map(type => {
                    const active = userReactions.has(type);
                    const count = reactionCounts[type];
                    return (
                        <TouchableOpacity
                            key={type}
                            onPress={() => toggleReaction(post.id, type)}
                            activeOpacity={0.75}
                            style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                backgroundColor: active ? '#ede9fe' : '#f8fafc',
                                paddingHorizontal: 10, paddingVertical: 6,
                                borderRadius: 20, borderWidth: 1,
                                borderColor: active ? Colors.primary : '#e2e8f0',
                            }}
                        >
                            <Text style={{ fontSize: 16 }}>{REACTION_EMOJI[type]}</Text>
                            {count > 0 && (
                                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? Colors.primary : '#64748b' }}>
                                    {count}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
});
CommunityPostCard.displayName = 'CommunityPostCard';
