/**
 * StoriesRow.tsx – updated to use the dedicated `stories` table via StoriesContext.
 * NPO users see a '+' add-story bubble first (calls onAddStory).
 * Volunteers only see the active stories.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useStories } from '../context/StoriesContext';
import { Story } from '../types/stories';

interface StoriesRowProps {
    isNPO?: boolean;
    onAddStory?: () => void;
    onStoryPress?: (story: Story) => void;
}

export function StoriesRow({ isNPO, onAddStory, onStoryPress }: StoriesRowProps) {
    const { stories } = useStories();

    const hasContent = isNPO || stories.length > 0;
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
                {isNPO && (
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

                {/* Active story bubbles */}
                {stories.map(story => {
                    const isLive = story.linked_activity?.status === 'IN_CORSO';
                    const name = story.author?.npo_name || story.author?.name || 'NPO';
                    const firstName = name.split(' ')[0];

                    // Time left until expiry
                    const msLeft = new Date(story.expires_at).getTime() - Date.now();
                    const hLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)));
                    const expiryLabel = hLeft < 1 ? '<1h' : `${hLeft}h`;

                    return (
                        <TouchableOpacity
                            key={story.id}
                            onPress={() => onStoryPress?.(story)}
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
                                    {story.author?.avatar ? (
                                        <Image source={{ uri: story.author.avatar }} style={{ width: '100%', height: '100%' }} />
                                    ) : story.image_url ? (
                                        <Image source={{ uri: story.image_url }} style={{ width: '100%', height: '100%' }} />
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
