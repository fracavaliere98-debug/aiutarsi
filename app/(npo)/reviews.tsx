import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { Star, MessageSquareQuote, ArrowLeft, Calendar } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { EmptyState } from "../../components/EmptyState";
import { useRouter } from "expo-router";
import { UserAvatar } from "../../components/UserAvatar";

export default function NPOReviewsScreen() {
    const { user, getUserById } = useAuth();
    const { reviews, activities } = useActivities();
    const router = useRouter();

    // Filtriamo le recensioni che appartengono ad attività create da questa NPO
    const myActivityIds = activities.filter(a => a.npoId === user?.id).map(a => a.id);
    const myReviews = reviews
        .filter(r => myActivityIds.includes(r.activityId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const averageRating = myReviews.length > 0
        ? myReviews.reduce((sum, r) => sum + r.stars, 0) / myReviews.length
        : 0;

    return (
        <StandardLayout
            title="Feedback Ricevuti"
            label="Valutazioni dai volontari"
            onBack={() => router.back()}
            bg="bg-[#f6f6f8]"
        >
            {myReviews.length > 0 ? (
                <>
                    {/* Riepilogo Voti */}
                    <View className="bg-white p-6 rounded-3xl shadow-sm mb-6 flex-row items-center justify-between">
                        <View>
                            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                                Media Voti
                            </Text>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-3xl font-black text-amber-500">
                                    {averageRating.toFixed(1)}
                                </Text>
                                <Text className="text-sm font-bold text-slate-400">/ 5.0</Text>
                            </View>
                        </View>
                        <View className="bg-amber-50 px-4 py-3 rounded-2xl items-center">
                            <Star size={24} color="#f59e0b" fill="#f59e0b" className="mb-1" />
                            <Text className="text-xs font-bold text-amber-600">
                                {myReviews.length} Recensioni
                            </Text>
                        </View>
                    </View>

                    {/* Lista Feedback */}
                    <View className="gap-4">
                        {myReviews.map((review) => {
                            const relatedActivity = activities.find(a => a.id === review.activityId);
                            const volunteer = getUserById(review.volunteerId);
                            // Raccogliamo le sensazioni (sentiments) se presenti nel model o lo fingiamo per demo UI come array stringhe (non c'è un field strutturato rigoroso per i sentiment array ma in submitReview viene passato feelings: string[])

                            return (
                                <View key={review.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-4">
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-row items-center gap-3">
                                            <View className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-slate-100">
                                                {volunteer ? (
                                                    <UserAvatar name={volunteer.name} avatarUrl={volunteer.avatar} size={40} />
                                                ) : (
                                                    <View className="flex-1 items-center justify-center bg-slate-200">
                                                        <Text className="text-slate-500 font-bold">A</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View>
                                                <Text className="text-sm font-black text-slate-800 mb-0.5">
                                                    {volunteer ? volunteer.name : `Utente Sconosciuto`}
                                                </Text>
                                                <Text className="text-[11px] font-bold text-slate-400">
                                                    {new Date(review.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="flex-row mt-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    size={14}
                                                    color={i < review.stars ? "#f59e0b" : "#e2e8f0"}
                                                    fill={i < review.stars ? "#f59e0b" : "transparent"}
                                                    className="ml-0.5"
                                                />
                                            ))}
                                        </View>
                                    </View>

                                    {relatedActivity && (
                                        <View className="flex-row items-center gap-1.5 mb-3 bg-indigo-50/50 self-start px-2 py-1 rounded-md">
                                            <Calendar size={10} color={Colors.primary} />
                                            <Text className="text-[10px] font-bold text-indigo-900 line-clamp-1" numberOfLines={1}>
                                                Missione: {relatedActivity.title}
                                            </Text>
                                        </View>
                                    )}

                                    {review.comment ? (
                                        <Text className="text-sm text-slate-600 leading-5 italic">
                                            "{review.comment}"
                                        </Text>
                                    ) : (
                                        <Text className="text-sm text-slate-400 italic">
                                            Nessun commento testuale.
                                        </Text>
                                    )}

                                    {review.feelings && review.feelings.length > 0 && (
                                        <View className="flex-row flex-wrap gap-2 mt-4">
                                            {review.feelings.map((feeling, idx) => (
                                                <View key={idx} className="bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                                    <Text className="text-[10px] font-bold text-emerald-700">{feeling}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </>
            ) : (
                <EmptyState
                    emoji="⭐"
                    title="Nessun feedback"
                    description="Non ci sono ancora valutazioni da parte dei volontari. Organizza attività per riceverne!"
                />
            )}
        </StandardLayout>
    );
}
