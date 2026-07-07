import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Award, Clock, Target, Star, Info, X } from "lucide-react-native";
import { StatCard } from "../StatCard";
import { SheetModal } from "../SheetModal";
import { useVolunteerReviewsQuery } from "../../hooks/activities/queries";
import { colors } from "@/theme";

const XP_LEVELS = [
    { level: 1, name: "Novizio", minXP: 0, nextXP: 110, description: "Stai muovendo i primi passi nella community." },
    { level: 2, name: "Apprendista", minXP: 110, nextXP: 450, description: "Hai iniziato a prendere confidenza con il volontariato." },
    { level: 3, name: "Sociale", minXP: 450, nextXP: 1000, description: "La tua presenza inizia a diventare concreta e costante." },
    { level: 4, name: "Attivo", minXP: 1000, nextXP: 2000, description: "Sei una persona su cui la community puo contare davvero." },
    { level: 5, name: "Esperto", minXP: 2000, nextXP: 3500, description: "Hai gia lasciato un segno chiaro nelle attivita a cui partecipi." },
    { level: 6, name: "Mentore", minXP: 3500, nextXP: 5500, description: "Il tuo esempio puo guidare anche chi ha appena iniziato." },
    { level: 7, name: "Pilastro", minXP: 5500, nextXP: 8000, description: "Sei uno dei punti forti della rete di volontari." },
    { level: 8, name: "Ambasciatore", minXP: 8000, nextXP: 11000, description: "Porti energia, continuita e fiducia nella community." },
    { level: 9, name: "Leader", minXP: 11000, nextXP: 15000, description: "Il tuo percorso genera impatto visibile e ispira gli altri." },
    { level: 10, name: "Leggenda", minXP: 15000, nextXP: null, description: "Hai raggiunto il massimo livello e continui a far crescere l'impatto." },
];

interface ProfileStatsProps {
    level: number;
    levelName?: string;
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
    levelName,
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
    const { data: volunteerReviews = [] } = useVolunteerReviewsQuery();
    const insets = useSafeAreaInsets();
    const [showXpInfo, setShowXpInfo] = useState(false);

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
                        <Award size={20} color={colors.accent} />
                        <Text className="text-primary font-black text-lg">
                            Livello {level} {levelName ? `• ${levelName}` : ''}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowXpInfo(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}
                    >
                        <Text style={{ fontSize: 11, color: '#1e1b4b', fontWeight: '800', lineHeight: 14 }}>{xpInLevel} / {xpNeededForLevel} XP</Text>
                        <Info size={11} color={colors.primary} />
                    </TouchableOpacity>
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
                            valueColor={colors.primary}
                            icon={<Clock size={14} color="#312e81" style={{ marginBottom: 2 }} />}
                        />
                    </View>
                    <View className="flex-1 h-24">
                        <StatCard
                            value={stats.completedMissions.toString()}
                            label="ATTIVITÀ"
                            valueColor={colors.accent}
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
                                    valueColor={colors.warningStrong}
                                    icon={<Star size={14} color="#d97706" style={{ marginBottom: 2 }} />}
                                />
                            </TouchableOpacity>
                        ) : (
                            <StatCard
                                value={averageRating}
                                label="VALUTAZIONE"
                                valueColor={colors.warningStrong}
                                icon={<Star size={14} color="#d97706" style={{ marginBottom: 2 }} />}
                            />
                        )}
                    </View>
                </View>
            </View>

            <SheetModal visible={showXpInfo} onClose={() => setShowXpInfo(false)}>
                <View className="flex-1 bg-white px-8" style={{ paddingTop: Math.max(insets.top, 20) + 16 }}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-2xl font-black text-primary">Livelli Esperienza</Text>
                            <Text className="text-secondary font-semibold text-sm">Scopri nome e soglia di ogni livello</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowXpInfo(false)} className="p-2 bg-slate-100 rounded-full">
                            <X size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View className="mb-5 items-center">
                        <Text className="text-primary font-black text-base mb-1">Il tuo livello attuale</Text>
                        <Text className="text-secondary text-sm font-semibold">Livello {level} · {levelName || "Volontario"}</Text>
                        <Text className="text-secondary text-sm mt-2">Totale accumulato: <Text className="font-black text-primary">{totalXP} XP</Text></Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
                        {XP_LEVELS.map((item) => {
                            const isCurrent = item.level === level || (item.level === 10 && level >= 10);
                            const isUnlocked = totalXP >= item.minXP;
                            const rangeLabel = item.nextXP
                                ? `${item.minXP.toLocaleString('it-IT')} - ${(item.nextXP - 1).toLocaleString('it-IT')} XP`
                                : `${item.minXP.toLocaleString('it-IT')}+ XP`;

                            return (
                                <View
                                    key={`xp-level-${item.level}`}
                                    className={`rounded-[28px] p-5 mb-4 border ${isCurrent ? 'bg-primary border-primary' : isUnlocked ? 'bg-white border-indigo-100' : 'bg-slate-50 border-slate-200'}`}
                                >
                                    <View className="flex-row items-start justify-between mb-3">
                                        <View className="flex-1 mr-3">
                                            <Text
                                                numberOfLines={1}
                                                adjustsFontSizeToFit
                                                minimumFontScale={0.72}
                                                className={`font-black text-base ${isCurrent ? 'text-white' : 'text-primary'}`}
                                            >
                                                Livello {item.level} · {item.name}
                                            </Text>
                                            <Text className={`text-xs font-black uppercase tracking-wider mt-1 ${isCurrent ? 'text-white/75' : isUnlocked ? 'text-accent' : 'text-slate-400'}`}>
                                                {rangeLabel}
                                            </Text>
                                        </View>
                                        <View className={`px-2.5 py-1.5 rounded-full ${isCurrent ? 'bg-white/15' : isUnlocked ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                            <Text className={`text-[10px] font-black ${isCurrent ? 'text-white' : isUnlocked ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                {isCurrent ? 'Attuale' : isUnlocked ? 'Sbloccato' : 'Da raggiungere'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className={`text-sm leading-6 ${isCurrent ? 'text-white/90' : 'text-secondary'}`}>
                                        {item.description}
                                    </Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </SheetModal>
        </View>
    );
}
