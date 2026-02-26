import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Colors } from "../../constants/Colors";
import { ArrowLeft, Star, Heart, Send, Sparkles, CheckCircle2 } from "lucide-react-native";
import { ScreenWrapper } from "../../components/ScreenWrapper";

export default function FeedbackScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const { activities, submitReview } = useActivities();

    const activity = activities.find(a => a.id === id);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // Role Guard: Only Volunteers can give feedback
    useEffect(() => {
        if (user && user.role !== "VOLUNTEER") {
            alert("Solo i volontari possono inviare feedback alle attività.");
            router.replace("/");
        }
    }, [user]);

    const feelings = ["Ispirato", "Utile", "Motivato", "Soddisfatto", "Sfidato"];

    const toggleFeeling = (feeling: string) => {
        if (selectedFeelings.includes(feeling)) {
            setSelectedFeelings(selectedFeelings.filter(f => f !== feeling));
        } else {
            setSelectedFeelings([...selectedFeelings, feeling]);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            alert("Per favore seleziona un punteggio.");
            return;
        }

        const success = await submitReview({
            activityId: id as string,
            npoId: activity?.npoId || "",
            stars: rating,
            comment,
            feelings: selectedFeelings
        });

        if (success) {
            showToast('success', '⭐ Recensione inviata con successo!');
            setSubmitted(true);
            setTimeout(() => {
                router.replace("/(volunteer)" as any);
            }, 2000);
        } else {
            showToast('error', 'Errore durante l\'invio della recensione');
        }
    };

    if (!user || user.role !== "VOLUNTEER") return null;

    return (
        <ScreenWrapper className="px-0 bg-white" withPadding={false}>
            {/* Custom Header */}
            <View className="px-6 py-6 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={24} color={Colors.primary} />
                </TouchableOpacity>
                <Text className="flex-1 text-center font-black text-primary text-xl mr-6">Feedback Attività</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Heart Icon Badge */}
                <View className="items-center mt-10 mb-6">
                    <View className="w-24 h-24 bg-indigo-50 rounded-full items-center justify-center">
                        <Heart size={48} color={Colors.primary} fill={Colors.primary} />
                    </View>
                </View>

                <Text className="text-3xl font-black text-primary text-center leading-tight mb-10">Com'è andata la tua attività?</Text>

                {/* Stars */}
                <View className="flex-row justify-center gap-3 mb-10">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <TouchableOpacity key={s} onPress={() => setRating(s)}>
                            <Star
                                size={44}
                                color={s <= rating ? Colors.accent : "#e2e8f0"}
                                fill={s <= rating ? Colors.accent : "transparent"}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                <Text className="text-center text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-4">Come ti senti?</Text>

                {/* Feelings chips */}
                <View className="flex-row flex-wrap justify-center gap-3 mb-10">
                    {feelings.map(f => {
                        const isSelected = selectedFeelings.includes(f);
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => toggleFeeling(f)}
                                className={`px-6 py-3 rounded-2xl border-2 ${isSelected ? "bg-accent border-accent shadow-lg shadow-accent/30" : "bg-white border-primary/5"
                                    }`}
                            >
                                <Text className={`font-bold text-sm ${isSelected ? "text-white" : "text-primary/60"}`}>{f}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text className="text-secondary/60 font-bold uppercase tracking-widest text-[10px] mb-4 ml-1">Dettagli</Text>

                <View className="bg-slate-50 p-5 rounded-[32px] border border-primary/5 mb-8 relative">
                    <TextInput
                        placeholder="Racconta la tua esperienza (l'IA analizzerà il tuo feedback per migliorare i futuri match)"
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        value={comment}
                        onChangeText={setComment}
                        className="text-primary font-medium text-base min-h-[120px]"
                    />
                    <View className="flex-row items-center gap-1 self-end mt-4 bg-indigo-50 px-3 py-1.5 rounded-full">
                        <Sparkles size={12} color={Colors.primary} />
                        <Text className="text-primary font-black text-[10px] uppercase tracking-tighter">AI Analysis</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitted}
                    className={`${submitted ? "bg-green-500" : "bg-primary"} py-5 rounded-[24px] shadow-xl shadow-primary/30 flex-row justify-center items-center gap-3 active:scale-95 transition-transform`}
                >
                    <Text className="text-white font-black text-xl">
                        {submitted ? "Feedback Inviato" : "Invia Feedback"}
                    </Text>
                    {submitted ? <CheckCircle2 size={20} color="white" /> : <Send size={20} color="white" />}
                </TouchableOpacity>

                {submitted && (
                    <View className="mt-6 items-center">
                        <Text className="text-primary font-bold text-center">Grazie per aver completato il questionario.</Text>
                    </View>
                )}

                <Text className="text-center text-secondary/40 text-xs mt-6">Il tuo feedback è anonimo e ci aiuta a crescere.</Text>
            </ScrollView>
        </ScreenWrapper>
    );
}
