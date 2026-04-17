import React, { useEffect, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Award, ChartColumnIncreasing, CheckCircle2, Heart, Sparkles } from "lucide-react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { StatCard } from "../../components/StatCard";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { volunteerReportService, type VolunteerReportSummary } from "../../services/VolunteerReportService";
import { useActivitiesDomain, useUserReviews } from "../../hooks/activities/selectors";
import { useApplicationsDomain, useVolunteerApplications } from "../../hooks/applications/selectors";
import { useGamificationView } from "../../hooks/gamification/selectors";

export default function VolunteerReportScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { activities, loadData } = useActivitiesDomain(user);
    const userReviews = useUserReviews(user?.id);
    const applications = useVolunteerApplications(user, user?.id);
    const { refreshApplications } = useApplicationsDomain(user);
    const { state: gamificationState, refetch: refetchGamification } = useGamificationView(user);
    const [summary, setSummary] = useState<VolunteerReportSummary | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadReport() {
            if (!user) return;
            const next = await volunteerReportService.getVolunteerReportSummary({
                user,
                gamificationState,
                activities,
                applications,
                reviews: userReviews,
            });
            if (!cancelled) setSummary(next);
        }
        void loadReport();
        return () => {
            cancelled = true;
        };
    }, [activities, applications, gamificationState, user, userReviews]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadData(), refreshApplications(), refetchGamification()]);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <StandardLayout
            label="Report"
            title="Come sta andando?"
            bg="bg-[#f6f6f8]"
            onBack={() => router.back()}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                    colors={[Colors.primary]}
                />
            }
        >
            <SoftCard className="mb-6 p-5" testID="volunteer-report-screen">
                <Text className="text-primary font-black text-xl mb-2">Questa settimana</Text>
                <Text className="text-secondary text-sm leading-5">
                    Il tuo impatto recente, le candidature sbloccate e i passi che hai già fatto nella community.
                </Text>
            </SoftCard>

            <View className="flex-row justify-between mb-6 -mx-1">
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.completedActivitiesThisWeek ?? 0}
                        label="ATTIVITÀ SVOLTE"
                        valueColor="text-emerald-600"
                        icon={<CheckCircle2 size={12} color="#059669" />}
                    />
                </View>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.volunteerHoursThisWeek ?? 0}
                        label="ORE DONATE"
                        valueColor="text-indigo-600"
                        icon={<Sparkles size={12} color="#4f46e5" />}
                    />
                </View>
            </View>

            <View className="flex-row justify-between mb-8 -mx-1">
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.applicationsThisWeek ?? 0}
                        label="CANDIDATURE"
                        valueColor="text-pink-600"
                        icon={<Heart size={12} color="#db2777" />}
                    />
                </View>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.approvedApplicationsThisWeek ?? 0}
                        label="APPROVATE"
                        valueColor="text-blue-600"
                        icon={<Award size={12} color="#2563eb" />}
                    />
                </View>
            </View>

            <SoftCard className="mb-6 p-5">
                <Text className="text-primary font-black text-xl mb-5">Questo mese</Text>
                <View className="flex-row justify-between mb-4 -mx-1">
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.completedActivitiesThisMonth ?? 0}
                            label="ATTIVITÀ SVOLTE"
                            valueColor="text-emerald-600"
                            icon={<CheckCircle2 size={12} color="#059669" />}
                        />
                    </View>
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.volunteerHoursThisMonth ?? 0}
                            label="ORE DONATE"
                            valueColor="text-indigo-600"
                            icon={<Sparkles size={12} color="#4f46e5" />}
                        />
                    </View>
                </View>
                <View className="flex-row justify-between -mx-1">
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.applicationsThisMonth ?? 0}
                            label="CANDIDATURE"
                            valueColor="text-pink-600"
                            icon={<Heart size={12} color="#db2777" />}
                        />
                    </View>
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.approvedApplicationsThisMonth ?? 0}
                            label="APPROVATE"
                            valueColor="text-blue-600"
                            icon={<Award size={12} color="#2563eb" />}
                        />
                    </View>
                </View>
            </SoftCard>

            <SoftCard className="mb-6 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <ChartColumnIncreasing size={18} color={Colors.primary} />
                    <Text className="text-primary font-black text-lg">Il tuo percorso</Text>
                </View>
                <View className="gap-3">
                    <Text className="text-secondary text-sm">
                        XP totali: <Text className="text-primary font-bold">{summary?.totalXP ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Livello attuale: <Text className="text-primary font-bold">Lv. {summary?.level ?? 1} · {summary?.levelName ?? 'Novizio'}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        NPO seguite questa settimana: <Text className="text-primary font-bold">{summary?.followedNposThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        NPO seguite questo mese: <Text className="text-primary font-bold">{summary?.followedNposThisMonth ?? 0}</Text>
                    </Text>
                </View>
            </SoftCard>

            <SoftCard className="mb-10 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <Sparkles size={18} color={Colors.primary} />
                    <Text className="text-primary font-black text-lg">Attenzione e continuità</Text>
                </View>
                <View className="gap-3">
                    <Text className="text-secondary text-sm">
                        Recensioni lasciate questa settimana: <Text className="text-primary font-bold">{summary?.reviewsLeftThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Recensioni lasciate questo mese: <Text className="text-primary font-bold">{summary?.reviewsLeftThisMonth ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività in arrivo: <Text className="text-primary font-bold">{summary?.upcomingActivitiesCount ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività ancora da recensire: <Text className="text-primary font-bold">{summary?.pendingReviewsCount ?? 0}</Text>
                    </Text>
                </View>
            </SoftCard>
        </StandardLayout>
    );
}
