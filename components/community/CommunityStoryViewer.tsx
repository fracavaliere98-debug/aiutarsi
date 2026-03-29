import React from 'react';
import { Modal, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Story } from '../../types/stories';

const SCREEN_W = Dimensions.get('window').width;

interface CommunityStoryViewerProps {
    viewer: { stories: Story[]; index: number } | null;
    onClose: () => void;
    onChange: (next: { stories: Story[]; index: number } | null) => void;
}

export function CommunityStoryViewer({ viewer, onClose, onChange }: CommunityStoryViewerProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    if (!viewer) return null;

    const currentStory = viewer.stories[viewer.index];
    if (!currentStory) return null;

    const authorData = currentStory.author;
    const topName = authorData?.npo_name || authorData?.full_name || 'NPO';

    const advanceStory = () => {
        if (viewer.index < viewer.stories.length - 1) {
            onChange({ ...viewer, index: viewer.index + 1 });
        } else {
            onClose();
        }
    };

    const rewindStory = () => {
        if (viewer.index > 0) {
            onChange({ ...viewer, index: viewer.index - 1 });
        } else {
            onClose();
        }
    };

    return (
        <Modal visible={!!viewer} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
                <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
                    <View style={{ paddingHorizontal: 10, paddingTop: Math.max(insets.top, 14), paddingBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
                            {viewer.stories.map((story, idx) => (
                                <View
                                    key={story.id}
                                    style={{
                                        flex: 1,
                                        height: 2,
                                        backgroundColor: idx <= viewer.index ? 'white' : 'rgba(255,255,255,0.3)',
                                        borderRadius: 1,
                                    }}
                                />
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 }}>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                    if (currentStory.author_id) {
                                        onClose();
                                        router.push(`/npo-profile/${currentStory.author_id}` as any);
                                    }
                                }}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', overflow: 'hidden', marginRight: 10 }}
                            >
                                {authorData?.avatar_url ? (
                                    <Image source={{ uri: authorData.avatar_url }} style={{ width: 36, height: 36 }} />
                                ) : null}
                            </TouchableOpacity>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 13, flex: 1 }}>{topName}</Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
                                <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', lineHeight: 24 }}>×</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        {currentStory.image_url ? (
                            <Image
                                source={{ uri: currentStory.image_url }}
                                style={{ width: SCREEN_W, height: SCREEN_W * 1.4 }}
                                contentFit="contain"
                            />
                        ) : null}

                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
                            <TouchableOpacity style={{ flex: 0.3 }} onPress={rewindStory} activeOpacity={1} />
                            <TouchableOpacity style={{ flex: 0.7 }} onPress={advanceStory} activeOpacity={1} />
                        </View>

                        {currentStory.caption ? (
                            <View
                                style={{
                                    position: 'absolute',
                                    bottom: Math.max(insets.bottom, 12),
                                    left: 0,
                                    right: 0,
                                    padding: 20,
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                    pointerEvents: 'none',
                                }}
                            >
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 24 }}>
                                    {currentStory.caption}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}
