import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useStories } from '../context/StoriesContext';
import { Story } from '../types/stories';

interface StoriesRowProps {
    allowAddStory?: boolean;
    onAddStory?: () => void;
    onStoryPress?: (allStories: Story[], initialIndex: number) => void;
}

export function StoriesRow({ allowAddStory, onAddStory, onStoryPress }: StoriesRowProps) {
    const { stories } = useStories();

    // Group stories by author
    const { authorGroups, flatOrderedStories } = useMemo(() => {
        const groups = new Map<string, Story[]>();
        for (const story of stories) {
            if (!story.author_id) continue;
            const existing = groups.get(story.author_id) || [];
            existing.push(story);
            groups.set(story.author_id, existing);
        }

        // Sort stories within each group (oldest first to watch in chronological order)
        const sortedGroups = Array.from(groups.values()).map(group =>
            group.sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime())
        );

        // Flatten back for the global viewer so we can seamlessly jump to the next NPO's stories
        const flatOrderedStories = sortedGroups.flat();

        return { authorGroups: sortedGroups, flatOrderedStories };
    }, [stories]);

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
                {/* Add Story bubble – NPO only */}
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

                {/* Active story bubbles for each NPO author */}
                {authorGroups.map(group => {
                    const firstStory = group[0];
                    const latestStory = group[group.length - 1]; // To find expiry of latest update
                    const isLive = group.some(s => s.linked_activity?.status === 'IN_CORSO');
                    const name = firstStory.author?.npo_name || firstStory.author?.full_name || 'NPO';
                    const firstName = name.split(' ')[0];

                    // Find index in the global flat array for viewer transition
                    const initialGroupIndex = flatOrderedStories.findIndex(s => s.id === firstStory.id);

                    // Time left until expiry based on the latesst story
                    const msLeft = new Date(latestStory.expires_at as string).getTime() - Date.now();
                    const hLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
                    const expiryLabel = hLeft < 1 ? '<1h' : `${hLeft}h`;

                    return (
                        <TouchableOpacity
                            key={firstStory.author_id}
                            onPress={() => onStoryPress?.(flatOrderedStories, initialGroupIndex)}
                            activeOpacity={0.85}
                            style={{ alignItems: 'center', width: 72 }}
                        >
                            {/* Gradient ring */}
                            <LinearGradient
                                colors={isLive ? ['#f59e0b', '#ef4444'] : [Colors.primary, Colors.accent]}
                                style={{
                                    width: 72, height: 72, borderRadius: 36,
                                    padding: 2.5, marginBottom: 6,
                                }}
                            >
                                <View style={{
                                    flex: 1, borderRadius: 34, overflow: 'hidden',
                                    backgroundColor: '#f1f5f9',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {firstStory.image_url ? (
                                        <Image source={{ uri: firstStory.image_url }} style={{ width: '100%', height: '100%' }} />
                                    ) : firstStory.author?.avatar_url ? (
                                        <Image source={{ uri: firstStory.author.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                        <Text style={{ fontSize: 22 }}>🏛️</Text>
                                    )}
                                </View>
                            </LinearGradient>

                            {/* Expiry badge */}
                            <View style={{
                                position: 'absolute', top: 54,
                                backgroundColor: isLive ? '#ef4444' : '#1e1b4b',
                                paddingHorizontal: 5, paddingVertical: 1,
                                borderRadius: 8, borderWidth: 1.5, borderColor: 'white',
                            }}>
                                <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>
                                    {isLive ? 'LIVE' : expiryLabel}
                                </Text>
                            </View>

                            <Text style={{
                                fontSize: 11, fontWeight: '700',
                                color: Colors.primary, textAlign: 'center',
                            }} numberOfLines={1}>
                                {firstName}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}
