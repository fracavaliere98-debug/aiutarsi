import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, Map as MapIcon, ArrowRight, Clock, Target } from "lucide-react-native";
import { ActivityCard } from "../../../components/ActivityCard";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { StandardLayout } from "../../../components/StandardLayout";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { SoftCard } from "../../../components/SoftCard";
import { StatCard } from "../../../components/StatCard";
import { useToast } from "../../../context/ToastContext";
import { useState, useMemo, useCallback } from "react";
import { ErrorState } from "../../../components/ErrorState";
import { EmptyState } from "../../../components/EmptyState";
import { SmartMatchCarousel } from "../../../components/SmartMatchCarousel";
import { useActivitiesDomain, useUserReviews, useVolunteerStats } from "../../../hooks/activities/selectors";
import { useSmartMatchView } from "../../../hooks/smart-match/useSmartMatchView";
import { colors } from "@/theme";

export default function VolunteerDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { activities, error, loadData } = useActivitiesDomain(user);
    const userReviews = useUserReviews(user?.id);
    const volunteerStats = useVolunteerStats(user);
    const { refresh: refreshSmartMatch } = useSmartMatchView(user);
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );



    // Filter activities
    const openActivities = activities
        .filter(a => a.status === "APERTA" || a.status === "IN_CORSO")
        .filter(a => !a.iscritti.includes(user?.id || ""));
    const enrolledActivities = activities.filter(a => a.iscritti.includes(user?.id || ""));
    const activeEnrolled = useMemo(() => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        return enrolledActivities
            .filter(a => a.status !== "CANCELLATA")
            .filter(a => {
                if (a.status === "COMPLETATA") {
                    const endDate = new Date(a.endDateTime || a.dateTime);
                    return endDate >= oneDayAgo;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.status === "COMPLETATA" && b.status !== "COMPLETATA") return 1;
                if (a.status !== "COMPLETATA" && b.status === "COMPLETATA") return -1;
                return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
            });
    }, [enrolledActivities]);
    const toEvaluate = enrolledActivities.filter(a =>
        a.status === "COMPLETATA" && !userReviews.some(r => r.activityId === a.id)
    );


    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            loadData(),
            refreshSmartMatch(),
        ]);
        showToast('success', 'Dati aggiornati!');
        setRefreshing(false);
    };



    if (error) {
        return (
            <StandardLayout
                title="Dashboard"
                label="Qualcosa è andato storto"
                bg="bg-background-light"
                hideBack={true}
            >
                <ErrorState
                    title="Errore nel caricamento"
                    description="Non siamo riusciti a recuperare le tue attività. Controlla la connessione."
                    onRetry={loadData}
                />
            </StandardLayout>
        );
    }

    return (
        <StandardLayout
            label={`Ciao, ${user?.name?.split(" ")[0] || "Volontario"}! 👋`}
            title="Dashboard"
            rightElement={<VolunteerHeaderActions />}
            bg="bg-background-light"
            hideBack={true}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.accent}
                    colors={[colors.accent]}
                />
            }
        >
            {/* Quick Stats - Premium Dashboard Style */}
            <View className="flex-row gap-2 mb-6">
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.totalHours.toString()}
                        label="ORE DONATE"
                        valueColor={colors.primary}
                        icon={<Clock size={14} color="#312e81" style={{ marginBottom: 2 }} />}
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.completedMissions.toString()}
                        label="ATTIVITÀ"
                        valueColor={colors.accent}
                        icon={<Target size={14} color="#db2777" style={{ marginBottom: 2 }} />}
                        onPress={() => router.push("/(volunteer)/calendar?view=list&filter=completed" as any)}
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.upcomingMissions.toString()}
                        label="ATTIVE"
                        valueColor={colors.accent}
                        icon={<Clock size={14} color={colors.accent} style={{ marginBottom: 2 }} />}
                        onPress={() => router.push("/(volunteer)/calendar?view=list&filter=upcoming" as any)}
                    />
                </View>
            </View>



            {/* Activities to Evaluate Reminder */}
            {toEvaluate.length > 0 && (
                <SoftCard
                    className="mb-6 p-5 bg-gradient-to-r from-accent/5 to-accent/10 border-accent/20"
                    onPress={() => router.push(`/activity/${toEvaluate[0].id}` as any)}
                >
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3 flex-1">
                            <View className="bg-accent p-3 rounded-2xl">
                                <Sparkles size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-primary font-black text-base mb-0.5">Valuta la tua esperienza</Text>
                                <Text className="text-secondary text-xs font-semibold">La tua opinione aiuta la community</Text>
                            </View>
                        </View>
                        <ArrowRight size={20} color={colors.accent} />
                    </View>
                </SoftCard>
            )}

            {/* Map Card */}
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/(volunteer)/map" as any)}
                style={{
                    height: 92,
                    borderRadius: 22,
                    overflow: 'hidden',
                    marginBottom: 20,
                }}
            >
                <LinearGradient
                    colors={[colors.primary, '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                >
                    {/* 3 stylized pin dots instead of the fake map */}
                    <View style={{ position: 'absolute', top: 18, left: 46, width: 8, height: 8, borderRadius: 999, backgroundColor: 'white', opacity: 0.9 }} />
                    <View style={{ position: 'absolute', top: 40, left: 90, width: 6, height: 6, borderRadius: 999, backgroundColor: 'white', opacity: 0.7 }} />
                    <View style={{ position: 'absolute', top: 24, left: 130, width: 6, height: 6, borderRadius: 999, backgroundColor: 'white', opacity: 0.7 }} />

                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: 'white', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, letterSpacing: 0.4 }}>LIVE</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: 'white' }}>Trova attività vicino a te</Text>
                        </View>
                        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRight size={16} color="white" />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            {/* AI Smart Match Carousel — Consigliato per te */}
            <SmartMatchCarousel />

            {/* Enrolled Activities */}
            {activeEnrolled.length > 0 && (
                <View className="mb-8">
                    <Text className="text-lg font-bold text-primary mb-4">Le Tue Attività</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                        {activeEnrolled.map(activity => (
                            <ActivityCard
                                key={activity.id}
                                activity={activity}
                                style={{ width: 320, height: 195, marginRight: 16 }}
                                onPress={() => router.push(`/activity/${activity.id}` as any)}
                            />
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Explore Opportunities */}
            {activeEnrolled.length === 0 && openActivities.length === 0 ? (
                <EmptyState
                    emoji="🌱"
                    title="Nessuna attività ancora"
                    description="Esplora le opportunità vicino a te e trova la tua prima attività di volontariato."
                    actionLabel="Esplora Opportunità"
                    onAction={() => router.push("/(volunteer)/map" as any)}
                />
            ) : (
                <View className="mb-8">
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold text-primary">Esplora Opportunità</Text>
                        <TouchableOpacity
                            onPress={() => router.push("/(volunteer)/map" as any)}
                            className="flex-row items-center gap-1"
                        >
                            <MapIcon size={16} color={colors.accent} />
                            <Text className="text-accent font-bold text-sm">Mappa</Text>
                        </TouchableOpacity>
                    </View>

                    {openActivities.slice(0, 5).map(activity => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onPress={() => router.push(`/activity/${activity.id}` as any)}
                        />
                    ))}

                    {/* Bottom Spacer to separate from footer/pills */}
                    <View style={{ height: 50 }} />
                </View>
            )}
        </StandardLayout>
    );
}
