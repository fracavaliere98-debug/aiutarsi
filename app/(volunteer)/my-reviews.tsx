import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StandardLayout } from '../../components/StandardLayout';
import { useActivities } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Star, Calendar, Building2 } from 'lucide-react-native';
import { EmptyState } from '../../components/EmptyState';
import { UserAvatar } from '../../components/UserAvatar';

export default function MyReviewsScreen() {
    const router = useRouter();
    const { volunteerReviews, activities } = useActivities();
    const { user, users } = useAuth();

    const myReviews = useMemo(() => {
        if (!user) return [];
        return volunteerReviews
            .filter(r => r.volunteerId === user.id && r.isPresent) // Only get ones where they were present and thus actually reviewed
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [volunteerReviews, user]);

    // Calculate Average
    const averageRating = useMemo(() => {
        const withStars = myReviews.filter(r => r.stars && r.stars > 0);
        if (withStars.length === 0) return 0;
        const sum = withStars.reduce((acc, r) => acc + (r.stars || 0), 0);
        return sum / withStars.length;
    }, [myReviews]);

    return (
        <StandardLayout
            label="Profilo"
            title="Le Mie Recensioni"
            onBack={() => router.back()}
        >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                {myReviews.length > 0 && (
                    <View className="bg-accent/10 p-6 rounded-[32px] mb-8 items-center justify-center border border-accent/20">
                        <Text className="text-secondary/70 font-bold mb-2 uppercase tracking-widest text-xs">Valutazione Media</Text>
                        <View className="flex-row items-end gap-2 mb-3">
                            <Text className="text-5xl font-black text-accent">{averageRating.toFixed(1)}</Text>
                            <Text className="text-xl font-bold text-accent/60 mb-1.5">/ 5</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                    key={star}
                                    size={24}
                                    color={averageRating >= star - 0.5 ? Colors.accent : "#cbd5e1"}
                                    fill={averageRating >= star - 0.5 ? Colors.accent : "transparent"}
                                />
                            ))}
                        </View>
                        <Text className="text-secondary/60 text-xs mt-3">{myReviews.length} recensioni totali</Text>
                    </View>
                )}

                <Text className="text-xl font-black text-primary mb-4">Dettaglio Recensioni</Text>

                {myReviews.length === 0 ? (
                    <EmptyState
                        title="Nessuna recensione"
                        description="Non hai ancora ricevuto recensioni dalle NPO per le tue attività."
                    />
                ) : (
                    myReviews.map(review => {
                        const activity = activities.find(a => a.id === review.activityId);
                        const npo = users.find(u => u.id === review.npoId);

                        return (
                            <View key={review.id} className="bg-white p-5 rounded-[24px] mb-4 border border-slate-100 shadow-sm">
                                {/* Header: NPO Info & Date */}
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className="flex-row items-center gap-3 flex-1 mr-4">
                                        <UserAvatar name={npo?.name || "NPO"} avatarUrl={npo?.avatar} size={40} />
                                        <View>
                                            <Text className="font-bold text-primary text-base">{npo?.name || "Ente Sconosciuto"}</Text>
                                            <View className="flex-row items-center gap-1 mt-0.5">
                                                <Calendar size={12} color={Colors.secondary} />
                                                <Text className="text-xs text-secondary/70 font-medium">
                                                    {new Date(review.date).toLocaleDateString("it-IT", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Stars */}
                                    {review.stars && review.stars > 0 && (
                                        <View className="bg-amber-50 px-2.5 py-1.5 rounded-xl flex-row items-center gap-1 border border-amber-100">
                                            <Text className="font-black text-amber-500 text-sm">{review.stars}</Text>
                                            <Star size={14} color="#f59e0b" fill="#f59e0b" />
                                        </View>
                                    )}
                                </View>

                                {/* Activity Context */}
                                {activity && (
                                    <View className="bg-slate-50 p-3 rounded-xl mb-4 flex-row items-center gap-2 border border-slate-100">
                                        <Building2 size={16} color={Colors.primary} />
                                        <Text className="text-sm font-bold text-primary flex-1" numberOfLines={1}>
                                            {activity.title}
                                        </Text>
                                    </View>
                                )}

                                {/* Comment */}
                                {review.comment ? (
                                    <Text className="text-secondary/80 text-[15px] leading-6 italic">
                                        &quot;{review.comment}&quot;
                                    </Text>
                                ) : (
                                    <Text className="text-slate-400 text-[13px] italic">
                                        Nessun commento testuale fornito.
                                    </Text>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </StandardLayout>
    );
}
