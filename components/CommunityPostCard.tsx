import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { CommunityPost, REACTION_EMOJI, ReactionType } from '../types/community';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useCommunity } from '../context/CommunityContext';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_W = Dimensions.get('window').width;

interface CommunityPostCardProps {
    post: CommunityPost;
}

export function CommunityPostCard({ post }: CommunityPostCardProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { toggleReaction } = useCommunity();

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
    const timeAgo = (() => {
        if (!post.created_at) return '...';
        const diff = Date.now() - new Date(post.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m fa`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h fa`;
        return `${Math.floor(hrs / 24)}g fa`;
    })();

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
                    onPress={() => router.push(`/npo-profile/${post.author_id}` as any)}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ede9fe', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}
                >
                    {post.author?.avatar_url
                        ? <Image source={{ uri: post.author.avatar_url }} style={{ width: 40, height: 40 }} />
                        : <Text style={{ fontSize: 18 }}>🏛️</Text>
                    }
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 14 }}>{authorName}</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>{timeAgo}</Text>
                </View>
            </View>

            {/* Image */}
            {post.image_url && (
                <View style={{ position: 'relative' }}>
                    <Image
                        source={{ uri: post.image_url }}
                        style={{ width: SCREEN_W - 32, height: (SCREEN_W - 32) * 1.1 }}
                        resizeMode="cover"
                    />
                    {/* OldActivity anchor banner */}
                    {post.linked_activity && (
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.75)']}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
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
                            {post.linked_activity.status === 'APERTA' && (
                                <TouchableOpacity
                                    onPress={() => router.push(`/activity/${post.linked_activity!.id}` as any)}
                                    style={{ backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={{ color: Colors.primary, fontWeight: '900', fontSize: 13 }}>Partecipa</Text>
                                </TouchableOpacity>
                            )}
                        </LinearGradient>
                    )}
                </View>
            )}

            {/* Caption */}
            {post.caption && (
                <Text style={{ fontSize: 14, color: '#374151', lineHeight: 21, padding: 14, paddingBottom: 10 }}>
                    {post.caption}
                </Text>
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
}
