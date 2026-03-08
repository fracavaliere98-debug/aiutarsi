import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useActivities } from "../../context/ActivityContext";
import { Award, Clock, Target, Star } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { StatCard } from "../StatCard";

interface ProfileStatsProps {
    level: number;
    totalXP: number;
    xpInLevel: number;
    xpNeededForLevel: number;
    levelProgress: number;
    stats: {
        totalHours: number;
        completedMissions: number;
        rating: number;
    };
    ratings?: any[]; // Assuming type, adjust if known
    eventsCount?: number; // Assuming type, adjust if known
    userId: string;
    isOwnProfile: boolean;
}

export function ProfileStats({
    level,
    totalXP,
    xpInLevel,
    xpNeededForLevel,
    levelProgress,
    stats,
    ratings,
    eventsCount,
    userId,
    isOwnProfile
}: ProfileStatsProps) {
    const router = useRouter();
    const { reviews, volunteerReviews } = useActivities();

    // Average Rating Calculation
    const averageRating = useMemo(() => {
        if (!userId) return "0.0";
        // From NPOs -> Volunteer
        const myReviews = volunteerReviews.filter(r => r.volunteerId === userId && r.isPresent && r.stars && r.stars > 0);
        if (myReviews.length === 0) return "0.0";
        const sum = myReviews.reduce((acc, r) => acc + (r.stars || 0), 0);
        return (sum / myReviews.length).toFixed(1);
    }, [volunteerReviews, userId]);



    return (
        <View>
            {/* Level Section - Standardized alignment */}
            <View className="px-6 mb-10">
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                        <Award size={20} color={Colors.accent} />
                        <Text className="text-primary font-black text-lg">Livello {level}</Text>
                    </View>
                    <Text className="text-secondary text-sm font-bold">{xpInLevel} / {xpNeededForLevel} XP</Text>
                </View>
                <View className="bg-slate-100 rounded-full h-3 overflow-hidden mb-1.5">
                    <View className="bg-accent h-full rounded-full" style={{ width: `${levelProgress}%` }} />
                </View>
                <Text className="text-xs text-slate-400 text-right font-semibold">
                    Totale: {totalXP} XP
                </Text>
            </View>

            {/* Stats Cards - Premium Dashbord Style */}
            <View className="px-6 mb-8">
                <View className="flex-row gap-2">
                    <View className="flex-1 h-24">
                        <StatCard
                            value={Math.round(stats.totalHours).toString()}
                            label="ORE DONATE"
                            valueColor="text-indigo-900"
                            icon={<Clock size={14} color="#312e81" style={{ marginBottom: 2 }} />}
                        />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard
                            value={stats.completedMissions.toString()}
                            label="ATTIVITÀ"
                            valueColor="text-pink-600"
                            icon={<Target size={14} color="#db2777" style={{ marginBottom: 2 }} />}
                            onPress={isOwnProfile ? () => router.push("/(volunteer)/calendar?view=list&filter=completed" as any) : undefined}
                        />
                    </View>
                    <View className="flex-1 h-24">
                        {isOwnProfile ? (
                            <TouchableOpacity onPress={() => router.push('/my-reviews')} className="flex-1">
                                <StatCard
                                    value={averageRating}
                                    label="VALUTAZIONE"
                                    valueColor="text-yellow-600"
                                    icon={<Star size={14} color="#d97706" style={{ marginBottom: 2 }} />}
                                />
                            </TouchableOpacity>
                        ) : (
                            <StatCard
                                value={averageRating}
                                label="VALUTAZIONE"
                                valueColor="text-yellow-600"
                                icon={<Star size={14} color="#d97706" style={{ marginBottom: 2 }} />}
                            />
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}
