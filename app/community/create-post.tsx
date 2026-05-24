import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, X, Link2, Zap } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { requestMediaLibraryPermission } from '../../utils/permissions';
import { useActivitiesDomain } from '../../hooks/activities/selectors';
import { useCreateStoryMutation } from '../../hooks/stories/mutations';
import {
    getCommunityPostFromFeedCache,
    useCommunityPostQuery,
} from '../../hooks/community/queries';
import {
import { colors } from "@/theme";
    useCreateCommunityPostMutation,
    useUpdateCommunityPostMutation,
} from '../../hooks/community/mutations';

const IMAGE_PICKER_MEDIA_TYPES =
    (ImagePicker as any).MediaType?.images
        ? [(ImagePicker as any).MediaType.images]
        : ImagePicker.MediaTypeOptions.Images;

export default function CreatePostScreen() {
    const router = useRouter();
    const { mode, postId, prefillCaption, prefillLinkedActivityId, draftLabel } = useLocalSearchParams<{
        mode?: string,
        postId?: string,
        prefillCaption?: string,
        prefillLinkedActivityId?: string,
        draftLabel?: string,
    }>();
    const isStoryMode = mode === 'story';
    const isEditMode = mode === 'edit';
    const { user } = useAuth();
    const { activities } = useActivitiesDomain(user);
    const { showToast } = useToast();
    const isVolunteer = user?.role === 'VOLUNTEER';
    const queryClient = useQueryClient();
    const createPostMutation = useCreateCommunityPostMutation(user);
    const updatePostMutation = useUpdateCommunityPostMutation(user);
    const createStoryMutation = useCreateStoryMutation(user);
    const cachedPost = isEditMode && postId
        ? getCommunityPostFromFeedCache(queryClient, user?.id, postId)
        : undefined;
    const postQuery = useCommunityPostQuery(postId, {
        enabled: isEditMode && !!postId,
        initialData: cachedPost ?? undefined,
        userId: user?.id,
    });
    const editPost = postQuery.data;
    const hasInitializedEditStateRef = React.useRef(false);

    const [caption, setCaption] = useState('');
    const [imageUris, setImageUris] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [linkedActivityId, setLinkedActivityId] = useState<string | undefined>(undefined);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (!isEditMode || !postId) {
            hasInitializedEditStateRef.current = false;
            return;
        }

        if (!editPost || hasInitializedEditStateRef.current) {
            return;
        }

        setCaption(editPost.caption || '');
        setExistingImages(editPost.images_urls || (editPost.image_url ? [editPost.image_url] : []));
        setLinkedActivityId(editPost.linked_activity_id || undefined);
        hasInitializedEditStateRef.current = true;
    }, [editPost, isEditMode, postId]);

    React.useEffect(() => {
        if (isEditMode) return;
        if (typeof prefillCaption === 'string' && !caption.trim()) {
            setCaption(prefillCaption);
        }
        if (typeof prefillLinkedActivityId === 'string' && !linkedActivityId) {
            setLinkedActivityId(prefillLinkedActivityId);
        }
    }, [isEditMode, prefillCaption, prefillLinkedActivityId, caption, linkedActivityId]);

    const availableActivities = activities.filter((activity) => {
        if (!user?.id) return false;
        if (user.role === 'NPO') {
            return activity.npoId === user.id;
        }
        return activity.iscritti.includes(user.id);
    });
    const linkedActivity = availableActivities.find(a => a.id === linkedActivityId);
    const activityPickerTitle = isVolunteer ? 'Collega un’attività vissuta' : 'Collega un’attività';
    const activityPickerEmptyLabel = isVolunteer
        ? 'Non hai ancora attività a cui collegare questo contenuto'
        : 'Nessuna attività disponibile';
    const composerTitle = isStoryMode
        ? '✨ Nuova storia'
        : (isEditMode ? 'Modifica post' : 'Nuovo post');
    const publishLabel = isStoryMode ? 'Pubblica storia' : 'Pubblica';
    const captionPlaceholder = isVolunteer
        ? 'Racconta cosa hai visto, sentito o fatto...'
        : 'Condividi un momento, un aggiornamento o un invito...';

    const pickImage = async () => {
        const granted = await requestMediaLibraryPermission({
            title: 'Accesso alla galleria',
            message: 'AiutarSi ti chiede l’accesso alla galleria per allegare immagini a post e storie.',
            settingsLabel: 'la galleria',
        });
        if (!granted) {
            Alert.alert('Permesso negato', 'Serve accesso alla galleria per caricare immagini.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
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
                await createStoryMutation.mutateAsync({
                    imageUri: imageUris[0],
                    caption: caption.trim() || undefined,
                    linkedActivityId,
                });
                showToast('success', 'Storia pubblicata! Sparirà tra 24h ✨');
            } else if (isEditMode && postId) {
                await updatePostMutation.mutateAsync({
                    postId,
                    caption: caption.trim(),
                    newLocalUris: imageUris,
                    retainedExistingUrls: existingImages,
                    linkedActivityId,
                });
                showToast('success', 'Post aggiornato con successo! 🎉');
            } else {
                await createPostMutation.mutateAsync({
                    caption: caption.trim(),
                    imageUris,
                    linkedActivityId,
                });
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

    if (isEditMode && postId && postQuery.isLoading && !editPost) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <SafeAreaView edges={['top']}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <ArrowLeft size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: colors.primary }}>
                        {composerTitle}
                    </Text>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        activeOpacity={0.85}
                    >
                        {isSubmitting
                            ? <ActivityIndicator size="small" color="white" />
                            : <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>{publishLabel}</Text>
                        }
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
                    {draftLabel && !isEditMode && (
                        <View style={{ backgroundColor: '#eef2ff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#c7d2fe' }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Bozza Gemma
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 }}>
                                {draftLabel}
                            </Text>
                        </View>
                    )}

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
                                    <ImageIcon size={22} color={colors.primary} />
                                </View>
                                <Text style={{ fontWeight: '800', color: colors.primary, fontSize: 13, textAlign: 'center' }}>Aggiungi{'\n'}Foto</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Caption */}
                    <View style={{ backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <TextInput
                            value={caption}
                            onChangeText={setCaption}
                            placeholder={captionPlaceholder}
                            placeholderTextColor="#94a3b8"
                            multiline
                            textAlignVertical="top"
                            style={{ fontSize: 16, color: colors.primary, lineHeight: 24, minHeight: 100 }}
                            maxLength={500}
                        />
                        <Text style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{caption.length}/500</Text>
                    </View>

                    {/* Link activity – hidden in story mode */}
                    {!isStoryMode && (
                        <TouchableOpacity
                            onPress={() => setShowActivityPicker(true)}
                            style={{ backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: linkedActivityId ? colors.primary : '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                            activeOpacity={0.8}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: linkedActivityId ? '#ede9fe' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                <Link2 size={18} color={linkedActivityId ? colors.primary : '#94a3b8'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '800', color: linkedActivityId ? colors.primary : '#64748b', fontSize: 14 }}>
                                    {linkedActivity ? linkedActivity.title : `${activityPickerTitle} (opzionale)`}
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
                                <Text style={{ fontSize: 12, color: '#78350f', marginTop: 2, lineHeight: 18 }}>
                                    Visibile per 24 ore. Ideale per condividere un momento al volo.
                                </Text>
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
                            <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: colors.primary }}>{activityPickerTitle}</Text>
                            <TouchableOpacity onPress={() => setShowActivityPicker(false)}>
                                <X size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                            {availableActivities.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>{activityPickerEmptyLabel}</Text>
                            ) : (
                                availableActivities.map(act => (
                                    <TouchableOpacity
                                        key={act.id}
                                        onPress={() => { setLinkedActivityId(act.id); setShowActivityPicker(false); }}
                                        style={{ backgroundColor: linkedActivityId === act.id ? '#ede9fe' : '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: linkedActivityId === act.id ? colors.primary : '#e2e8f0' }}
                                    >
                                        <Text style={{ fontWeight: '800', color: colors.primary, fontSize: 14 }}>{act.title}</Text>
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
