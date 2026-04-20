import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Users } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { StoryAuthorGroup } from '../hooks/stories/types';

interface StoriesRowProps {
    allowAddStory?: boolean;
    onAddStory?: () => void;
    onStoryPress?: (groupIndex: number) => void;
    authorGroups: StoryAuthorGroup[];
    isLoading?: boolean;
}

export function StoriesRow({
    allowAddStory,
    onAddStory,
    onStoryPress,
    authorGroups,
    isLoading,
}: StoriesRowProps) {
    const hasContent = allowAddStory || authorGroups.length > 0;
    if (!hasContent) return null;

    return (
        <View style={{ paddingVertical: 14 }}>
            <Text style={{
                fontSize: 13, fontWeight: '900', color: Colors.primary,
                paddingHorizontal: 16, marginBottom: 12,
                textTransform: 'uppercase', letterSpacing: 0.6
            }}>
                Storie di Impatto
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            >
                {allowAddStory && (
                    <TouchableOpacity
                        onPress={onAddStory}
                        activeOpacity={0.8}
                        style={{ alignItems: 'center', width: 72 }}
                    >
                        <View style={{
                            width: 72, height: 72, borderRadius: 36,
                            backgroundColor: '#f1f5f9',
                            borderWidth: 2, borderColor: Colors.primary + '50',
                            borderStyle: 'dashed',
                            alignItems: 'center', justifyContent: 'center',
                            marginBottom: 6,
                        }}>
                            <Text style={{ fontSize: 28, color: Colors.primary, lineHeight: 32 }}>+</Text>
                        </View>
                        <Text style={{
                            fontSize: 11, fontWeight: '700',
                            color: Colors.primary, textAlign: 'center'
                        }}>
                            La tua{'\n'}storia
                        </Text>
                    </TouchableOpacity>
                )}

                {isLoading && authorGroups.length === 0 ? (
                    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : null}

                {authorGroups.map((group, index) => (
                    <TouchableOpacity
                        key={group.authorId}
                        onPress={() => onStoryPress?.(index)}
                        activeOpacity={0.85}
                        style={{ alignItems: 'center', width: 78 }}
                    >
                        <LinearGradient
                            colors={
                                group.isLive
                                    ? ['#f59e0b', '#ef4444']
                                    : group.hasUnseenStories
                                        ? [Colors.primary, Colors.accent]
                                        : ['#cbd5e1', '#94a3b8']
                            }
                            style={{
                                width: 72, height: 72, borderRadius: 36,
                                padding: 2.5, marginBottom: 6,
                                opacity: group.hasUnseenStories ? 1 : 0.72,
                            }}
                        >
                            <View style={{
                                flex: 1, borderRadius: 34, overflow: 'hidden',
                                backgroundColor: '#f1f5f9',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                {group.firstStory.image_url ? (
                                    <Image source={{ uri: group.firstStory.image_url }} style={{ width: '100%', height: '100%' }} />
                                ) : group.firstStory.author?.avatar_url ? (
                                    <Image source={{ uri: group.firstStory.author.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text style={{ fontSize: 22 }}>🏛️</Text>
                                )}
                            </View>
                        </LinearGradient>

                        {(group.isAffiliatedNpo || group.isFollowedNpo) && (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 2,
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor: 'white',
                                    borderWidth: 1,
                                    borderColor: group.isAffiliatedNpo ? '#dbeafe' : '#fce7f3',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {group.isAffiliatedNpo ? (
                                    <Users size={12} color="#2563eb" />
                                ) : (
                                    <Heart size={12} color={Colors.accent} fill={Colors.accent} />
                                )}
                            </View>
                        )}

                        <View style={{
                            position: 'absolute',
                            top: 54,
                            backgroundColor: group.isLive ? '#ef4444' : '#1e1b4b',
                            paddingHorizontal: 5, paddingVertical: 1,
                            borderRadius: 8, borderWidth: 1.5, borderColor: 'white',
                        }}>
                            <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>
                                {group.expiryLabel}
                            </Text>
                        </View>

                        <Text style={{
                            fontSize: 11, fontWeight: '700',
                            color: Colors.primary, textAlign: 'center',
                        }} numberOfLines={1}>
                            {group.authorShortName}
                        </Text>
                        <Text style={{
                            fontSize: 9,
                            fontWeight: '800',
                            color: group.hasUnseenStories ? Colors.accent : '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginTop: 2,
                        }}>
                            {group.hasUnseenStories ? `${group.unseenCount} nuove` : 'Viste'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
