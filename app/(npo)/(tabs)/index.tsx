import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../context/ActivityContext";
import { Sparkles, Star, Users, Plus } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { StatCard } from "../../../components/StatCard";
import { ActivityCard } from "../../../components/ActivityCard";
import { StandardLayout } from "../../../components/StandardLayout";
import { EmptyState } from "../../../components/EmptyState";

import { useApplications } from "../../../context/ApplicationContext";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";
import { UserAvatar } from "../../../components/UserAvatar";
import { useNPOInsights } from "../../../hooks/useNPOInsights";
import { InsightCarousel } from "../../../components/InsightCarousel";
import { reportService } from "../../../services/ReportService";
import { dispatchNotification } from "../../../utils/notificationDispatch";
import { shouldSendLowCoverageAlert, markLowCoverageAlertSent } from "../../../utils/npoCoverageAlerts";
import { markWeeklyRecapSent, shouldSendWeeklyRecap } from "../../../utils/npoWeeklyRecap";

export default function NPODashboard() {
    const { user, getNPOFollowers, refreshUsers } = useAuth();
    const router = useRouter();
    const { activities, getNPORating, loadData } = useActivities();
    const { getNPOApplications, refreshApplications } = useApplications();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { insights, dismissInsight } = useNPOInsights();
    const [lowCoverageCount, setLowCoverageCount] = useState(0);

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
    const npoRating = getNPORating(user?.id || "");

    // Calculate followers (volunteers following the NPO)
    const followers = getNPOFollowers(user?.id || "");
    const followerCount = followers.length;

    // Sincronizzazione "Iscrizioni" con numero reale di volontari approvati (APPROVED)
    const allNpoApps = getNPOApplications(user?.id || "");
    const { activityApplications } = useActivities();

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
            setLowCoverageCount(summary.lowCoverageActivities.length);

            const shouldSendRecap = await shouldSendWeeklyRecap(user.id);
            if (shouldSendRecap) {
                await dispatchNotification({
                    userId: user.id,
                    type: 'NPO_WEEKLY_RECAP',
                    title: 'Come sta andando',
                    message: `Questa settimana hai avuto ${summary.newFollowersThisWeek} nuovi follower, ${summary.registrationsThisWeek} nuovi iscritti e ${summary.activeFollowersOnContent} follower attivi sui contenuti.`,
                    npoId: user.id,
                });
                await markWeeklyRecapSent(user.id);
            }

            const primary = summary.lowCoverageActivities[0];
            if (!primary) return;
            const shouldSend = await shouldSendLowCoverageAlert(primary.id);
            if (!shouldSend) return;

            await dispatchNotification({
                userId: user.id,
                type: 'NPO_LOW_COVERAGE',
                title: 'Attività da rinforzare',
                message: `${primary.title} ha ancora pochi volontari iscritti`,
                activityId: primary.id,
                npoId: user.id,
            });
            await markLowCoverageAlertSent(primary.id);
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
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                />
            }
        >
            {/* Stats Overview - Restored 1x4 Row with Individual Colors */}
            <View className="flex-row justify-between mb-8 -mx-1">
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/report" as any)}
                    testID="npo-dashboard-report-rating"
                >
                    <StatCard
                        value={npoRating.toFixed(1)}
                        label="RATING"
                        valueColor="text-amber-600"
                        icon={<Star size={12} color="#d97706" fill="#d97706" />}
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
                        valueColor="text-indigo-600"
                        icon={<Sparkles size={12} color="#4f46e5" />}
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
                        valueColor="text-blue-600"
                        icon={<Users size={12} color="#2563eb" />}
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
                        valueColor="text-pink-600"
                        icon={<Users size={12} color="#db2777" />}
                    />
                </TouchableOpacity>
            </View>

            {lowCoverageCount > 0 && (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push("/(npo)/report" as any)}
                    className="mb-6 bg-orange-50 border border-orange-100 rounded-3xl px-5 py-4"
                    testID="npo-dashboard-low-coverage"
                >
                    <Text className="text-orange-700 font-black text-sm mb-1">Attività da attenzionare</Text>
                    <Text className="text-orange-700/80 text-xs">
                        Hai {lowCoverageCount} {lowCoverageCount === 1 ? 'attività con pochi iscritti' : 'attività con pochi iscritti'} nei prossimi giorni. Tocca per vedere il report.
                    </Text>
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
                        <Text className="font-bold text-xs" style={{ color: Colors.primary }}>Vedi tutti</Text>
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
                        style={{ backgroundColor: Colors.accent }}
                    >
                        <Plus size={14} color="white" strokeWidth={3} />
                        <Text className="text-white font-extrabold text-[10px]">Aggiungi</Text>
                    </TouchableOpacity>
                </View>

                {upcomingActivities.length > 0 ? (
                    <View>
                        {upcomingActivities.map((act) => (
                            <View key={act.id} className="mb-4">
                                <ActivityCard activity={act} onPress={() => router.push(`/activity/${act.id}` as any)} />
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
