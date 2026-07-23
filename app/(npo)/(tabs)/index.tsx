import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { Sparkles, Star, Users, Plus, ArrowRight, Clock } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatCard } from "../../../components/StatCard";
import { ActivityCard } from "../../../components/ActivityCard";
import { StandardLayout } from "../../../components/StandardLayout";
import { EmptyState } from "../../../components/EmptyState";

import { NPOHeaderActions } from "../../../components/NPOHeaderActions";
import { UserAvatar } from "../../../components/UserAvatar";
import { useNPOInsights } from "../../../hooks/useNPOInsights";
import { InsightCarousel } from "../../../components/InsightCarousel";
import { reportService } from "../../../services/ReportService";
import { useActivitiesDomain, useNPORating } from "../../../hooks/activities/selectors";
import { useApplicationsDomain, useNPOApplications } from "../../../hooks/applications/selectors";
import { colors } from "@/theme";
import { AppActivity } from "../../../types";

export default function NPODashboard() {
    const { user, getNPOFollowers, refreshUsers } = useAuth();
    const router = useRouter();
    const { activities, activityApplications, loadData } = useActivitiesDomain(user);
    const { refreshApplications } = useApplicationsDomain(user);
    const allNpoApps = useNPOApplications(user, user?.id);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { insights, dismissInsight } = useNPOInsights();
    const [lowCoverageActivities, setLowCoverageActivities] = useState<AppActivity[]>([]);
    const [overdueActivities, setOverdueActivities] = useState<AppActivity[]>([]);
    const lowCoverageCount = lowCoverageActivities.length;
    const overdueCount = overdueActivities.length;

    // Refresh followers when screen gains focus to update "online" status
    useFocusEffect(
        useCallback(() => {
            refreshUsers();
        }, [refreshUsers])
    );

    // Filter activities created by this NPO
    const myActivities = activities.filter(a => a.npoId === user?.id);

    // For "Prossime Attività": only open/ongoing with future end date
    const now = new Date();
    const upcomingActivities = myActivities.filter(a =>
        (a.status === 'APERTA' || a.status === 'IN_CORSO') &&
        new Date(a.endDateTime) > now
    ).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const npoRating = useNPORating(user?.id);

    // Calculate followers (volunteers following the NPO)
    const followers = getNPOFollowers(user?.id || "");
    const followerCount = followers.length;

    // Sincronizzazione "Iscrizioni" con numero reale di volontari approvati (APPROVED)
    const approvedNpoApps = allNpoApps.filter(a => a.status === "APPROVED");
    const approvedActivityApps = activityApplications.filter(a => a.status === "APPROVED");

    const totalEnrollmentsCount = approvedNpoApps.length + approvedActivityApps.length;

    useEffect(() => {
        let cancelled = false;
        async function evaluateCoverage() {
            if (!user?.id) return;
            const summary = await reportService.getNPOReportSummary({
                npoId: user.id,
                activities,
                applications: allNpoApps,
                activityApplications,
            });
            if (cancelled) return;
            setLowCoverageActivities(summary.lowCoverageActivities);
            setOverdueActivities(summary.overdueActivities);
        }

        void evaluateCoverage();
        return () => {
            cancelled = true;
        };
    }, [activities, activityApplications, allNpoApps, user?.id]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshUsers(),
                loadData(),
                refreshApplications(),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [loadData, refreshApplications, refreshUsers]);

    const HeaderActions = <NPOHeaderActions />;

    return (
        <StandardLayout
            label="Panoramica Ente"
            title={user?.npoName || "La Tua NPO"}
            rightElement={HeaderActions}
            bg="bg-[#f6f6f8]"
            hideBack={true}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
        >
            {/* Stats Overview - Restored 1x4 Row with Individual Colors */}
            <View className="flex-row justify-between mb-8 -mx-1">
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/(tabs)/profile?tab=recensioni" as any)}
                    testID="npo-dashboard-report-rating"
                >
                    <StatCard
                        value={npoRating.toFixed(1)}
                        label="RATING"
                        valueColor={colors.warningStrong}
                        icon={<Star size={12} color="#d97706" fill="#d97706" />}
                        compact
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/report" as any)}
                    testID="npo-dashboard-report-activities"
                >
                    <StatCard
                        value={myActivities.length}
                        label="ATTIVITÀ"
                        valueColor={colors.primary}
                        icon={<Sparkles size={12} color="#4f46e5" />}
                        compact
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/report" as any)}
                    testID="npo-dashboard-report-volunteers"
                >
                    <StatCard
                        value={totalEnrollmentsCount}
                        label="VOLONTARI"
                        valueColor={colors.accent}
                        icon={<Users size={12} color="#db2777" />}
                        compact
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/report" as any)}
                    testID="npo-dashboard-report-followers"
                >
                    <StatCard
                        value={followerCount}
                        label="FOLLOWERS"
                        valueColor={colors.infoStrong}
                        icon={<Users size={12} color="#2563eb" />}
                        compact
                    />
                </TouchableOpacity>
            </View>

            {lowCoverageCount > 0 && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                        // Con una sola attività coinvolta portiamo l'ente dritto lì (è quella "su cui
                        // si sta ponendo attenzione"); con più di una l'elenco puntuale resta il report.
                        if (lowCoverageActivities.length === 1) {
                            router.push(`/activity/${lowCoverageActivities[0].id}` as any);
                        } else {
                            router.push("/(npo)/report" as any);
                        }
                    }}
                    style={{
                        minHeight: 92,
                        borderRadius: 22,
                        overflow: 'hidden',
                        marginBottom: 20,
                    }}
                    testID="npo-dashboard-low-coverage"
                >
                    <LinearGradient
                        colors={[colors.warning, colors.warningStrong]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 18, gap: 12 }}
                    >
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: 'white', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, letterSpacing: 0.4 }}>ATTENZIONE</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: 'white', lineHeight: 17 }} numberOfLines={2} ellipsizeMode="tail">
                                Hai {lowCoverageCount} {lowCoverageCount === 1 ? 'attività con pochi iscritti' : 'attività con pochi iscritti'} nei prossimi giorni. Tocca per {lowCoverageActivities.length === 1 ? "vederla" : "vedere il report"}.
                            </Text>
                        </View>
                        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ArrowRight size={16} color="white" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            )}

            {overdueCount > 0 && (
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/(npo)/projects" as any)}
                    style={{
                        minHeight: 92,
                        borderRadius: 22,
                        overflow: 'hidden',
                        marginBottom: 20,
                    }}
                    testID="npo-dashboard-overdue"
                >
                    <LinearGradient
                        colors={[colors.info, colors.infoStrong]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 18, gap: 12 }}
                    >
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: 'white', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, letterSpacing: 0.4 }}>DA VERIFICARE</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: 'white', lineHeight: 17 }} numberOfLines={2} ellipsizeMode="tail">
                                {overdueCount} {overdueCount === 1 ? 'attività risulta ancora aperta' : 'attività risultano ancora aperte'} da oltre 24 ore dalla fine prevista.
                            </Text>
                        </View>
                        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Clock size={16} color="white" />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            )}

            {/* AI Insight Carousel - bleed to screen edges */}
            <View style={{ marginHorizontal: -24, paddingHorizontal: 0 }}>
                <InsightCarousel insights={insights} onDismiss={dismissInsight} />
            </View>

            {/* Active Volunteers Section */}
            <View className="mb-8">
                <View className="flex-row justify-between items-center mb-6 px-1">
                    <Text className="text-lg font-black text-slate-900">Volontari Attivi</Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(npo)/volunteers" as any)}
                        className="py-1"
                    >
                        <Text className="font-bold text-xs" style={{ color: colors.primary }}>Vedi tutti</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="px-1"
                    contentContainerStyle={{ gap: 20 }}
                >
                    {followers.filter((vol: any) => vol.lastSeenAt && (new Date().getTime() - new Date(vol.lastSeenAt).getTime()) < 300000).length > 0 ? (
                        followers
                            .filter((vol: any) => vol.lastSeenAt && (new Date().getTime() - new Date(vol.lastSeenAt).getTime()) < 300000)
                            .map((vol: any) => {
                                return (
                                    <TouchableOpacity
                                        key={vol.id}
                                        className="items-center gap-2"
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${vol.id}` as any)}
                                        activeOpacity={0.7}
                                    >
                                        <View className="relative">
                                            <View className="p-1 bg-white rounded-full shadow-sm">
                                                <UserAvatar name={vol.name} avatarUrl={vol.avatar} size={56} />
                                            </View>
                                            <View
                                                className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#f6f6f8] bg-green-500"
                                            />
                                        </View>
                                        <Text className="text-[10px] font-bold text-slate-600" numberOfLines={1}>{vol.name.split(' ')[0]}</Text>
                                    </TouchableOpacity>
                                );
                            })
                    ) : (
                        <Text className="text-slate-400 text-xs font-medium italic">Nessun volontario attivo...</Text>
                    )}
                </ScrollView>
            </View>

            {/* Upcoming Activities List */}
            <View className="mb-12">
                <View className="flex-row justify-between items-center mb-6 px-1">
                    <Text className="text-lg font-black text-slate-900">Prossime Attività</Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(npo)/create-activity" as any)}
                        className="px-4 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm active:scale-95"
                        style={{ backgroundColor: colors.accent }}
                    >
                        <Plus size={14} color="white" strokeWidth={3} />
                        <Text className="text-white font-extrabold text-[10px]">Aggiungi</Text>
                    </TouchableOpacity>
                </View>

                {upcomingActivities.length > 0 ? (
                    <View>
                        {upcomingActivities.map((act) => (
                            <View key={act.id} className="mb-4">
                                <ActivityCard activity={act} onPress={() => router.push(`/activity/${act.id}` as any)} showProgress />
                            </View>
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        emoji="🎨"
                        title="Nessuna attività imminente"
                        description="Aggiungi una nuova attività per iniziare"
                    />
                )}
            </View>
        </StandardLayout>
    );
}
