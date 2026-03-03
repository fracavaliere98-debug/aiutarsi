import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { CommunityPost } from '../types/community';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

interface StoriesRowProps {
    posts: CommunityPost[];
    isNPO?: boolean;
    onAddStory?: () => void;
    onStoryPress?: (post: CommunityPost) => void;
}

export function StoriesRow({ posts, isNPO, onAddStory, onStoryPress }: StoriesRowProps) {
    // Show most recent post per NPO from last 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentByNpo = new Map<string, CommunityPost>();
    for (const p of posts) {
        const age = new Date(p.created_at).getTime();
        if (age >= cutoff && !recentByNpo.has(p.author_id)) {
            recentByNpo.set(p.author_id, p);
        }
    }
    const stories = Array.from(recentByNpo.values()).slice(0, 12);

    if (stories.length === 0) return null;

    return (
        <View style={{ paddingVertical: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary, paddingHorizontal: 16, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Storie di Impatto
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                {/* Add Story bubble – NPO only */}
                {isNPO && (
                    <TouchableOpacity
                        onPress={onAddStory}
                        activeOpacity={0.8}
                        style={{ alignItems: 'center', width: 72 }}
                    >
                        <View style={{
                            width: 72, height: 72, borderRadius: 36,
                            backgroundColor: '#f1f5f9',
                            borderWidth: 2, borderColor: '#e2e8f0',
                            borderStyle: 'dashed',
                            alignItems: 'center', justifyContent: 'center',
                            marginBottom: 6,
                        }}>
                            <Text style={{ fontSize: 28, color: Colors.primary, lineHeight: 32 }}>+</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center' }}>La tua storia</Text>
                    </TouchableOpacity>
                )}
                {stories.map(post => {
                    const isLive = post.linked_activity?.status === 'IN_CORSO';
                    const name = post.author?.npo_name || post.author?.name || 'NPO';
                    const firstName = name.split(' ')[0];
                    return (
                        <TouchableOpacity
                            key={post.id}
                            onPress={() => onStoryPress?.(post)}
                            activeOpacity={0.85}
                            style={{ alignItems: 'center', width: 72 }}
                        >
                            {/* Gradient ring */}
                            <LinearGradient
                                colors={isLive ? ['#f59e0b', '#ef4444'] : [Colors.primary, Colors.accent]}
                                style={{ width: 72, height: 72, borderRadius: 36, padding: 2.5, marginBottom: 6 }}
                            >
                                <View style={{ flex: 1, borderRadius: 34, overflow: 'hidden', backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                    {post.author?.avatar ? (
                                        <Image source={{ uri: post.author.avatar }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Text style={{ fontSize: 22 }}>🏛️</Text>
                                    )}
                                </View>
                            </LinearGradient>
                            {isLive && (
                                <View style={{ position: 'absolute', top: 54, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1.5, borderColor: 'white' }}>
                                    <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>LIVE</Text>
                                </View>
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center' }} numberOfLines={1}>
                                {firstName}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}
