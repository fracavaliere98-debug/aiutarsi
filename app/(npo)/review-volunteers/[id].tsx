import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StandardLayout } from '../../../components/StandardLayout';
import { useActivities } from '../../../context/ActivityContext';
import { useAuth } from '../../../context/AuthContext';
import { Colors } from '../../../constants/Colors';
import { UserAvatar } from '../../../components/UserAvatar';
import { Star, CheckCircle2, XCircle, Loader2 } from 'lucide-react-native';
import { useToast } from '../../../context/ToastContext';
import { EmptyState } from '../../../components/EmptyState';

type VolunteerReviewDraft = {
    volunteerId: string;
    isPresent: boolean | null;
    stars: number;
    comment: string;
    isProcessed: boolean; // True if it was already saved to DB
};

export default function ReviewVolunteersScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { activities, volunteerReviews, submitVolunteerReviews } = useActivities();
    const { users } = useAuth();
    const { showToast } = useToast();

    const activityId = typeof id === "string" ? id : id?.[0] || "";
    const activity = useMemo(() => activities.find(a => a.id === activityId), [activities, activityId]);

    const [drafts, setDrafts] = useState<Record<string, VolunteerReviewDraft>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize drafts based on existing applications and already saved reviews
    useEffect(() => {
        if (!activity) return;

        const enrolledIds = activity.iscritti || [];
        const existingReviews = volunteerReviews.filter(r => r.activityId === activityId);

        const initialDrafts: Record<string, VolunteerReviewDraft> = {};

        enrolledIds.forEach(volId => {
            const savedReview = existingReviews.find(r => r.volunteerId === volId);

            if (savedReview) {
                initialDrafts[volId] = {
                    volunteerId: volId,
                    isPresent: savedReview.isPresent,
                    stars: savedReview.stars || 0,
                    comment: savedReview.comment || "",
                    isProcessed: true
                };
            } else {
                initialDrafts[volId] = {
                    volunteerId: volId,
                    isPresent: null, // null means "not selected yet"
                    stars: 0,
                    comment: "",
                    isProcessed: false
                };
            }
        });

        setDrafts(initialDrafts);
    }, [activity, volunteerReviews, activityId]);

    if (!activity) {
        return (
            <StandardLayout label="Valutazione" title="Errore" onBack={() => router.back()}>
                <EmptyState title="Attività non trovata" description="Impossibile caricare i dati." />
            </StandardLayout>
        );
    }

    const enrolledIds = activity.iscritti || [];
    const volunteers = users.filter(u => enrolledIds.includes(u.id));

    const handleUpdateDraft = (volId: string, updates: Partial<VolunteerReviewDraft>) => {
        setDrafts(prev => ({
            ...prev,
            [volId]: { ...prev[volId], ...updates }
        }));
    };

    const handleSave = async () => {
        const reviewsToSave = Object.values(drafts)
            .filter(d => !d.isProcessed && d.isPresent !== null) // Only unsaved ones with a choice made
            .map(d => ({
                activityId,
                npoId: activity.npoId,
                volunteerId: d.volunteerId,
                isPresent: d.isPresent!,
                stars: d.isPresent ? d.stars : undefined,
                comment: d.isPresent ? d.comment : undefined
            }));

        if (reviewsToSave.length === 0) {
            showToast("info", "Nessuna nuova valutazione da salvare.");
            return;
        }

        setIsSubmitting(true);
        try {
            await submitVolunteerReviews(reviewsToSave);
            showToast("success", "Valutazioni salvate con successo!");

            // Re-check how many left to process
            const leftToSave = Object.values(drafts).filter(d => !d.isProcessed && d.isPresent === null).length;
            if (leftToSave === 0) {
                router.back();
            } else {
                // Update local drafts to mark as processed
                setDrafts(prev => {
                    const next = { ...prev };
                    reviewsToSave.forEach(r => {
                        if (next[r.volunteerId]) {
                            next[r.volunteerId].isProcessed = true;
                        }
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error(error);
            showToast("error", "Errore durante il salvataggio.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingCount = Object.values(drafts).filter(d => !d.isProcessed && d.isPresent !== null).length;
    const isAllProcessed = Object.values(drafts).every(d => d.isProcessed);

    return (
        <StandardLayout
            label="Valutazione"
            title="Valuta Volontari"
            onBack={() => router.back()}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                    <Text className="text-secondary/70 mb-6 font-medium leading-5">
                        Conferma la presenza dei volontari iscritti all&apos;attività &quot;{activity.title}&quot;.
                        Puoi salvare in momenti diversi, aggiungendo feedback e stelle per chi ha partecipato.
                    </Text>

                    {volunteers.length === 0 ? (
                        <EmptyState title="Nessun iscritto" description="Nessun volontario ha partecipato a questa attività." />
                    ) : (
                        volunteers.map(vol => {
                            const draft = drafts[vol.id];
                            if (!draft) return null;

                            const isReadOnly = draft.isProcessed;

                            return (
                                <View
                                    key={vol.id}
                                    className={`bg-white rounded-[24px] p-5 mb-4 border ${isReadOnly ? 'border-emerald-100 bg-slate-50 opacity-90' : 'border-slate-100 shadow-sm'}`}
                                >
                                    <View className="flex-row items-center gap-3 mb-4">
                                        <UserAvatar name={vol.name} avatarUrl={vol.avatar} size={48} />
                                        <View className="flex-1">
                                            <Text className="font-black text-primary text-lg">{vol.name}</Text>
                                            <Text className="text-secondary/60 text-xs font-medium">{vol.email}</Text>
                                        </View>
                                        {isReadOnly && (
                                            <View className="bg-emerald-100 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                                                <CheckCircle2 size={12} color="#059669" />
                                                <Text className="text-emerald-700 font-bold text-[10px] uppercase tracking-wider">Salvato</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* PRESENCE TOGGLE */}
                                    <View className="flex-row gap-3 mb-4">
                                        <TouchableOpacity
                                            disabled={isReadOnly}
                                            onPress={() => handleUpdateDraft(vol.id, { isPresent: true })}
                                            className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border ${draft.isPresent === true ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200'} ${isReadOnly && draft.isPresent !== true ? 'opacity-40' : ''}`}
                                        >
                                            <CheckCircle2 size={18} color={draft.isPresent === true ? "#10b981" : "#94a3b8"} />
                                            <Text className={`font-bold ${draft.isPresent === true ? 'text-emerald-600' : 'text-slate-400'}`}>Presente</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            disabled={isReadOnly}
                                            onPress={() => handleUpdateDraft(vol.id, { isPresent: false })}
                                            className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border ${draft.isPresent === false ? 'bg-red-50 border-red-500' : 'bg-white border-slate-200'} ${isReadOnly && draft.isPresent !== false ? 'opacity-40' : ''}`}
                                        >
                                            <XCircle size={18} color={draft.isPresent === false ? "#ef4444" : "#94a3b8"} />
                                            <Text className={`font-bold ${draft.isPresent === false ? 'text-red-600' : 'text-slate-400'}`}>Assente</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* RATING & COMMENT (only if present) */}
                                    {(draft.isPresent === true) && (
                                        <View className="border-t border-slate-100 pt-4 mt-2">
                                            <Text className="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-3">Valutazione</Text>

                                            <View className="flex-row items-center gap-2 mb-4">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <TouchableOpacity
                                                        key={`star_${vol.id}_${star}`}
                                                        disabled={isReadOnly}
                                                        onPress={() => handleUpdateDraft(vol.id, { stars: star })}
                                                    >
                                                        <Star
                                                            size={32}
                                                            color={draft.stars >= star ? Colors.accent : "#e2e8f0"}
                                                            fill={draft.stars >= star ? Colors.accent : "transparent"}
                                                        />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <TextInput
                                                className={`bg-slate-50 p-4 rounded-xl text-primary font-medium min-h-[80px] border ${isReadOnly ? 'border-transparent text-slate-500' : 'border-slate-200'}`}
                                                placeholder={isReadOnly ? "" : "Aggiungi un commento (opzionale)..."}
                                                placeholderTextColor="#94a3b8"
                                                multiline
                                                textAlignVertical="top"
                                                editable={!isReadOnly}
                                                value={draft.comment}
                                                onChangeText={(text) => handleUpdateDraft(vol.id, { comment: text })}
                                            />
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* BOTTOM FLOATING ACTION BAR */}
                {!isAllProcessed && volunteers.length > 0 && (
                    <View className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-100 pb-8">
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={pendingCount === 0 || isSubmitting}
                            className={`w-full py-4 rounded-2xl flex-row items-center justify-center gap-2 ${pendingCount > 0 ? 'bg-accent shadow-lg shadow-accent/30' : 'bg-slate-200'}`}
                            style={{ backgroundColor: pendingCount > 0 ? Colors.accent : '#e2e8f0' }}
                        >
                            {isSubmitting ? (
                                <Loader2 size={24} color="white" />
                            ) : (
                                <>
                                    <Text className={`font-black text-lg ${pendingCount > 0 ? 'text-white' : 'text-slate-400'}`}>
                                        Salva ({pendingCount}) Valutazioni
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </StandardLayout>
    );
}
