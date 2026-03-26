import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { CommunityPost } from '../../types/community';
import { Colors } from '../../constants/Colors';

interface CommunityCompactPostCardProps {
    post: CommunityPost;
    layout?: 'list' | 'carousel';
    showLinkedActivityTag?: boolean;
}

export function CommunityCompactPostCard({
    post,
    layout = 'list',
    showLinkedActivityTag = true,
}: CommunityCompactPostCardProps) {
    const router = useRouter();
    const authorName = post.author?.npo_name || post.author?.full_name || 'Community';
    const authorRoute = post.author?.role === 'VOLUNTEER'
        ? `/user-profile/${post.author_id}`
        : `/npo-profile/${post.author_id}`;
    const imageUrl = post.images_urls?.[0] || post.image_url || null;
    const isCarousel = layout === 'carousel';

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push(authorRoute as any)}
            style={{
                width: isCarousel ? 240 : undefined,
                marginHorizontal: isCarousel ? 0 : 16,
                marginRight: isCarousel ? 12 : 0,
                marginBottom: isCarousel ? 0 : 12,
                borderRadius: 22,
                backgroundColor: 'white',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                overflow: 'hidden',
            }}
        >
            {isCarousel && imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 116 }} contentFit="cover" />
            ) : null}

            <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            overflow: 'hidden',
                            backgroundColor: '#ede9fe',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                        }}
                    >
                        {post.author?.avatar_url ? (
                            <Image source={{ uri: post.author.avatar_url }} style={{ width: 42, height: 42 }} />
                        ) : (
                            <Text style={{ fontSize: 16 }}>{post.author?.role === 'VOLUNTEER' ? '🙌' : '🏛️'}</Text>
                        )}
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: Colors.primary }} numberOfLines={1}>
                            {authorName}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 2 }}>
                            {post.author?.role === 'VOLUNTEER' ? 'Volontario' : 'NPO'}
                        </Text>
                    </View>

                    <ArrowUpRight size={16} color="#94a3b8" />
                </View>

                {post.caption ? (
                    <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19, color: '#334155' }} numberOfLines={isCarousel ? 4 : 3}>
                        {post.caption}
                    </Text>
                ) : null}

                {showLinkedActivityTag && post.linked_activity?.title ? (
                    <View
                        style={{
                            alignSelf: 'flex-start',
                            marginTop: 10,
                            borderRadius: 999,
                            backgroundColor: '#f5f3ff',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#6d28d9' }} numberOfLines={1}>
                            {post.linked_activity.title}
                        </Text>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}
