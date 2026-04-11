import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Activity, BellRing, ChartColumnIncreasing, HeartHandshake, Sparkles, Users } from "lucide-react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { SoftCard } from "../../components/SoftCard";
import { StatCard } from "../../components/StatCard";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import { reportService, type NPOReportSummary } from "../../services/ReportService";
import { useActivitiesDomain } from "../../hooks/activities/selectors";
import { useApplicationsDomain } from "../../hooks/applications/selectors";

export default function NPOReportScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { activities, activityApplications, loadData } = useActivitiesDomain(user);
    const { applications, refreshApplications } = useApplicationsDomain(user);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState<NPOReportSummary | null>(null);

    const npoActivities = useMemo(
        () => activities.filter((activity) => activity.npoId === user?.id),
        [activities, user?.id]
    );

    useEffect(() => {
        let cancelled = false;
        async function loadReport() {
            if (!user?.id) return;
            const next = await reportService.getNPOReportSummary({
                npoId: user.id,
                activities,
                applications,
                activityApplications,
            });
            if (!cancelled) setSummary(next);
        }
        void loadReport();
        return () => {
            cancelled = true;
        };
    }, [activities, activityApplications, applications, user?.id]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadData(), refreshApplications()]);
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
            <SoftCard className="mb-6 p-5" testID="npo-report-screen">
                <Text className="text-primary font-black text-xl mb-2">Questa settimana</Text>
                <Text className="text-secondary text-sm leading-5">
                    Ecco i segnali più importanti di crescita e attenzione per il tuo ente.
                </Text>
            </SoftCard>

            <View className="flex-row justify-between mb-6 -mx-1">
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.newFollowersThisWeek ?? 0}
                        label="NUOVI FOLLOWER"
                        valueColor="text-pink-600"
                        icon={<Users size={12} color="#db2777" />}
                        testID="npo-report-new-followers"
                    />
                </View>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.applicationsThisWeek ?? 0}
                        label="CANDIDATURE"
                        valueColor="text-indigo-600"
                        icon={<HeartHandshake size={12} color="#4f46e5" />}
                        testID="npo-report-applications"
                    />
                </View>
            </View>

            <View className="flex-row justify-between mb-8 -mx-1">
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.registrationsThisWeek ?? 0}
                        label="NUOVI ISCRITTI"
                        valueColor="text-blue-600"
                        icon={<Users size={12} color="#2563eb" />}
                        testID="npo-report-registrations"
                    />
                </View>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={summary?.approvedThisWeek ?? 0}
                        label="APPROVATI"
                        valueColor="text-emerald-600"
                        icon={<Sparkles size={12} color="#059669" />}
                        testID="npo-report-approved"
                    />
                </View>
            </View>

            <SoftCard className="mb-6 p-5">
                <Text className="text-primary font-black text-xl mb-5">Questo mese</Text>
                <View className="flex-row justify-between mb-4 -mx-1">
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.newFollowersThisMonth ?? 0}
                            label="NUOVI FOLLOWER"
                            valueColor="text-pink-600"
                            icon={<Users size={12} color="#db2777" />}
                        />
                    </View>
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.applicationsThisMonth ?? 0}
                            label="CANDIDATURE"
                            valueColor="text-indigo-600"
                            icon={<HeartHandshake size={12} color="#4f46e5" />}
                        />
                    </View>
                </View>
                <View className="flex-row justify-between -mx-1">
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.registrationsThisMonth ?? 0}
                            label="NUOVI ISCRITTI"
                            valueColor="text-blue-600"
                            icon={<Users size={12} color="#2563eb" />}
                        />
                    </View>
                    <View className="flex-1 mx-1">
                        <StatCard
                            value={summary?.approvedThisMonth ?? 0}
                            label="APPROVATI"
                            valueColor="text-emerald-600"
                            icon={<Sparkles size={12} color="#059669" />}
                        />
                    </View>
                </View>
            </SoftCard>

            <SoftCard className="mb-6 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <ChartColumnIncreasing size={18} color={Colors.primary} />
                    <Text className="text-primary font-black text-lg">Crescita dell’ente</Text>
                </View>
                <View className="gap-3">
                    <Text className="text-secondary text-sm">
                        Follower totali: <Text className="text-primary font-bold">{summary?.followerCount ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività pubblicate questa settimana: <Text className="text-primary font-bold">{summary?.publishedActivitiesThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività completate questa settimana: <Text className="text-primary font-bold">{summary?.completedActivitiesThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività pubblicate questo mese: <Text className="text-primary font-bold">{summary?.publishedActivitiesThisMonth ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Attività completate questo mese: <Text className="text-primary font-bold">{summary?.completedActivitiesThisMonth ?? 0}</Text>
                    </Text>
                </View>
            </SoftCard>

            <SoftCard className="mb-6 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <Users size={18} color="#2563eb" />
                    <Text className="text-primary font-black text-lg">Community e follower</Text>
                </View>
                <View className="gap-3">
                    <Text className="text-secondary text-sm">
                        Post pubblicati questa settimana: <Text className="text-primary font-bold">{summary?.postsThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Storie pubblicate questa settimana: <Text className="text-primary font-bold">{summary?.storiesThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Reazioni ricevute questa settimana: <Text className="text-primary font-bold">{summary?.reactionsThisWeek ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Follower attivi sui contenuti: <Text className="text-primary font-bold">{summary?.activeFollowersOnContent ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Post pubblicati questo mese: <Text className="text-primary font-bold">{summary?.postsThisMonth ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Storie pubblicate questo mese: <Text className="text-primary font-bold">{summary?.storiesThisMonth ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Reazioni ricevute questo mese: <Text className="text-primary font-bold">{summary?.reactionsThisMonth ?? 0}</Text>
                    </Text>
                    <Text className="text-secondary text-sm">
                        Follower attivi sui contenuti questo mese: <Text className="text-primary font-bold">{summary?.activeFollowersOnContentThisMonth ?? 0}</Text>
                    </Text>
                </View>
            </SoftCard>

            <SoftCard className="mb-6 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <BellRing size={18} color="#ea580c" />
                    <Text className="text-primary font-black text-lg">Attività da attenzionare</Text>
                </View>

                {summary?.lowCoverageActivities?.length ? (
                    <View className="gap-3">
                        {summary.lowCoverageActivities.map((activity) => (
                            <TouchableOpacity
                                key={activity.id}
                                activeOpacity={0.75}
                                onPress={() => router.push(`/activity/${activity.id}` as any)}
                                className="bg-orange-50 border border-orange-100 rounded-2xl p-4"
                            >
                                <Text className="text-primary font-bold text-sm mb-1">{activity.title}</Text>
                                <Text className="text-secondary text-xs">
                                    {activity.iscritti.length}/{activity.slots} volontari al momento
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <Text className="text-secondary text-sm">
                        Nessuna attività critica nei prossimi giorni. La copertura attuale è buona.
                    </Text>
                )}
            </SoftCard>

            <SoftCard className="mb-10 p-5">
                <View className="flex-row items-center gap-3 mb-4">
                    <Activity size={18} color={Colors.primary} />
                    <Text className="text-primary font-black text-lg">Panoramica attività</Text>
                </View>
                <Text className="text-secondary text-sm">
                    Attività totali: <Text className="text-primary font-bold">{npoActivities.length}</Text>
                </Text>
            </SoftCard>
        </StandardLayout>
    );
}
