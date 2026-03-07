import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, X, Link2, Zap } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { useCommunity } from '../../context/CommunityContext';
import { useStories } from '../../context/StoriesContext';
import { useActivities } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function CreatePostScreen() {
    const router = useRouter();
    const { mode, postId } = useLocalSearchParams<{ mode?: string, postId?: string }>();
    const isStoryMode = mode === 'story';
    const isEditMode = mode === 'edit';
    const { user } = useAuth();
    const { posts, createPost, updatePost } = useCommunity();
    const { createStory } = useStories();
    const { activities } = useActivities();
    const { showToast } = useToast();

    const [caption, setCaption] = useState('');
    const [imageUris, setImageUris] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [linkedActivityId, setLinkedActivityId] = useState<string | undefined>(undefined);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (isEditMode && postId) {
            const post = posts.find(p => p.id === postId);
            if (post) {
                setCaption(post.caption || '');
                setExistingImages(post.images_urls || (post.image_url ? [post.image_url] : []));
                setLinkedActivityId(post.linked_activity_id || undefined);
            }
        }
    }, [isEditMode, postId, posts]);

    const myActivities = activities.filter(a => a.npoId === user?.id);
    const linkedActivity = myActivities.find(a => a.id === linkedActivityId);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permesso negato', 'Serve accesso alla galleria per caricare immagini.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsMultipleSelection: !isStoryMode,
            allowsEditing: isStoryMode, // Only allow cropping for stories
            aspect: isStoryMode ? [4, 5] : undefined,
        });
        if (!result.canceled && result.assets) {
            if (isStoryMode) {
                setImageUris([result.assets[0].uri]);
            } else {
                setImageUris(prev => [...prev, ...result.assets.map(a => a.uri)]);
            }
        }
    };

    const removeExistingImage = (index: number) => setExistingImages(prev => prev.filter((_, i) => i !== index));
    const removeLocalImage = (index: number) => setImageUris(prev => prev.filter((_, i) => i !== index));

    const handleSubmit = async () => {
        if (!caption.trim() && existingImages.length === 0 && imageUris.length === 0) {
            showToast('warning', 'Aggiungi almeno una foto o una descrizione.');
            return;
        }
        if (isStoryMode && imageUris.length === 0) {
            showToast('warning', 'Le storie richiedono almeno una foto.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (isStoryMode) {
                await createStory(imageUris[0], caption.trim() || undefined, linkedActivityId);
                showToast('success', 'Storia pubblicata! Sparirà tra 24h ✨');
            } else if (isEditMode && postId) {
                await updatePost(postId, caption.trim(), imageUris, existingImages, linkedActivityId);
                showToast('success', 'Post aggiornato con successo! 🎉');
            } else {
                await createPost(caption.trim(), imageUris, linkedActivityId);
                showToast('success', 'Post pubblicato nella Community! 🎉');
            }
            router.back();
        } catch (e) {
            console.error(e);
            showToast('error', 'Errore durante l\'operazione.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <SafeAreaView edges={['top']}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <ArrowLeft size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: Colors.primary }}>
                        {isStoryMode ? '✨ Nuova Storia (24h)' : (isEditMode ? 'Modifica Post' : 'Nuovo Post Community')}
                    </Text>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        style={{ backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.85}
                    >
                        {isSubmitting
                            ? <ActivityIndicator size="small" color="white" />
                            : <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>Pubblica</Text>
                        }
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>

                    {/* Images Picker Row */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                        {existingImages.map((uri, index) => (
                            <View key={`existing_${index}`} style={{ width: 140, height: 180, borderRadius: 16, overflow: 'hidden' }}>
                                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                <TouchableOpacity
                                    onPress={() => removeExistingImage(index)}
                                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <X size={14} color="white" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {imageUris.map((uri, index) => (
                            <View key={`local_${index}`} style={{ width: 140, height: 180, borderRadius: 16, overflow: 'hidden' }}>
                                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                <TouchableOpacity
                                    onPress={() => removeLocalImage(index)}
                                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <X size={14} color="white" />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {/* Add Button */}
                        {(!isStoryMode || (imageUris.length === 0 && existingImages.length === 0)) && (
                            <TouchableOpacity
                                onPress={pickImage}
                                activeOpacity={0.8}
                                style={{
                                    width: 140, height: 180,
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    borderColor: '#e2e8f0',
                                    borderStyle: 'dashed',
                                    alignItems: 'center', justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                                    <ImageIcon size={22} color={Colors.primary} />
                                </View>
                                <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 13, textAlign: 'center' }}>Aggiungi{'\n'}Foto</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Caption */}
                    <View style={{ backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <TextInput
                            value={caption}
                            onChangeText={setCaption}
                            placeholder="Racconta cosa è successo oggi... 🌟"
                            placeholderTextColor="#94a3b8"
                            multiline
                            textAlignVertical="top"
                            style={{ fontSize: 16, color: Colors.primary, lineHeight: 24, minHeight: 100 }}
                            maxLength={500}
                        />
                        <Text style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{caption.length}/500</Text>
                    </View>

                    {/* Link activity – hidden in story mode */}
                    {!isStoryMode && (
                        <TouchableOpacity
                            onPress={() => setShowActivityPicker(true)}
                            style={{ backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: linkedActivityId ? Colors.primary : '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                            activeOpacity={0.8}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: linkedActivityId ? '#ede9fe' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                <Link2 size={18} color={linkedActivityId ? Colors.primary : '#94a3b8'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: linkedActivityId ? Colors.primary : '#64748b', fontSize: 14 }}>
                                    {linkedActivity ? linkedActivity.title : 'Collega un\'attività (opzionale)'}
                                </Text>
                                {linkedActivity && (
                                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                                        {new Date(linkedActivity.dateTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                                    </Text>
                                )}
                            </View>
                            {linkedActivityId && (
                                <TouchableOpacity onPress={() => setLinkedActivityId(undefined)}>
                                    <X size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Story mode info banner */}
                    {isStoryMode && (
                        <View style={{ backgroundColor: '#fffbeb', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: '#fde68a' }}>
                            <Zap size={18} color="#f59e0b" />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: '#92400e', fontSize: 13 }}>Storia effimera</Text>
                                <Text style={{ fontSize: 12, color: '#78350f', marginTop: 2, lineHeight: 18 }}>Visibile per 24 ore. Perfetta per aggiornamenti in tempo reale dall&apos;evento!</Text>
                            </View>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>

            {/* OldActivity picker modal */}
            {showActivityPicker && (
                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '60%', paddingBottom: Platform.OS === 'ios' ? 34 : 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                            <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: Colors.primary }}>Collega un&apos;attività</Text>
                            <TouchableOpacity onPress={() => setShowActivityPicker(false)}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                            {myActivities.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Nessuna attività disponibile</Text>
                            ) : (
                                myActivities.map(act => (
                                    <TouchableOpacity
                                        key={act.id}
                                        onPress={() => { setLinkedActivityId(act.id); setShowActivityPicker(false); }}
                                        style={{ backgroundColor: linkedActivityId === act.id ? '#ede9fe' : '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: linkedActivityId === act.id ? Colors.primary : '#e2e8f0' }}
                                    >
                                        <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 14 }}>{act.title}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            {act.status} · {new Date(act.dateTime).toLocaleDateString('it-IT')}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            )}
        </View>
    );
}
