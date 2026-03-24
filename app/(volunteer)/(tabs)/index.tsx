import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { Sparkles, Map as MapIcon, Bell, ArrowRight, Clock, Target, Building2, MessageCircle } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { ActivityCard } from "../../../components/ActivityCard";
import { useActivities } from "../../../context/ActivityContext";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { UserAvatar } from "../../../components/UserAvatar";
import { StandardLayout } from "../../../components/StandardLayout";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { SoftCard } from "../../../components/SoftCard";
import { StatCard } from "../../../components/StatCard";
import { BadgePill } from "../../../components/BadgePill";
import { useNotifications } from "../../../context/NotificationContext";
import { useToast } from "../../../context/ToastContext";
import { useChat } from "../../../context/ChatContext";
import { useState, useMemo } from "react";
import { ErrorState } from "../../../components/ErrorState";
import { SmartMatchCarousel } from "../../../components/SmartMatchCarousel";

export default function VolunteerDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { activities, userReviews, volunteerStats, error, loadData } = useActivities();
    const { unreadCount: notificationsUnreadCount } = useNotifications();
    const { unreadCount: chatUnreadCount } = useChat();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);



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
        // Simulate refresh - in real app, this would fetch new data
        await new Promise(resolve => setTimeout(resolve, 1000));
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
                    tintColor={Colors.accent}
                    colors={[Colors.accent]}
                />
            }
        >
            {/* Quick Stats - Premium Dashboard Style */}
            <View className="flex-row gap-2 mb-6">
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.totalHours.toString()}
                        label="ORE DONATE"
                        valueColor="text-indigo-900"
                        icon={<Clock size={14} color="#312e81" style={{ marginBottom: 2 }} />}
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.completedMissions.toString()}
                        label="ATTIVITÀ"
                        valueColor="text-pink-600"
                        icon={<Target size={14} color="#db2777" style={{ marginBottom: 2 }} />}
                        onPress={() => router.push("/(volunteer)/calendar?view=list&filter=completed" as any)}
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={volunteerStats.upcomingMissions.toString()}
                        label="ATTIVE"
                        valueColor="text-accent"
                        icon={<Clock size={14} color={Colors.accent} style={{ marginBottom: 2 }} />}
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
                        <ArrowRight size={20} color={Colors.accent} />
                    </View>
                </SoftCard>
            )}

            {/* Map Card */}
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/(volunteer)/map" as any)}
                style={{
                    height: 130,
                    borderRadius: 24,
                    overflow: 'hidden',
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 5,
                }}
            >
                {/* Map-like layered background */}
                <View style={{ flex: 1, backgroundColor: '#e8ecef' }}>
                    {/* Road grid simulation */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                        {/* Horizontal roads */}
                        <View style={{ position: 'absolute', top: 28, left: 0, right: 0, height: 7, backgroundColor: '#ffffff', opacity: 0.85 }} />
                        <View style={{ position: 'absolute', top: 66, left: 0, right: 0, height: 5, backgroundColor: '#ffffff', opacity: 0.7 }} />
                        <View style={{ position: 'absolute', top: 100, left: 0, right: 0, height: 4, backgroundColor: '#ffffff', opacity: 0.6 }} />
                        {/* Vertical roads */}
                        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 60, width: 7, backgroundColor: '#ffffff', opacity: 0.75 }} />
                        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 165, width: 5, backgroundColor: '#ffffff', opacity: 0.65 }} />
                        <View style={{ position: 'absolute', top: 0, bottom: 0, right: 70, width: 6, backgroundColor: '#ffffff', opacity: 0.7 }} />
                        {/* Blue-gray water patch */}
                        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 95, height: 60, backgroundColor: '#b8cfe0', opacity: 0.65, borderTopLeftRadius: 40 }} />
                        {/* Park block — muted gray-green */}
                        <View style={{ position: 'absolute', top: 0, right: 75, width: 55, height: 65, backgroundColor: '#c8d8c4', opacity: 0.75, borderBottomLeftRadius: 12, borderBottomRightRadius: 8 }} />
                        {/* Building blocks — medium grays */}
                        <View style={{ position: 'absolute', top: 0, left: 0, width: 55, height: 25, backgroundColor: '#cdd3d8', opacity: 0.9 }} />
                        <View style={{ position: 'absolute', top: 35, left: 68, width: 85, height: 24, backgroundColor: '#c8cdd2', opacity: 0.8 }} />
                        <View style={{ position: 'absolute', top: 73, left: 68, width: 45, height: 18, backgroundColor: '#c4c9ce', opacity: 0.75 }} />
                        <View style={{ position: 'absolute', bottom: 0, left: 0, width: 55, height: 20, backgroundColor: '#c0c6cb', opacity: 0.8 }} />
                    </View>
                    {/* Dark overlay for text contrast */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,40,55,0.38)' }} />
                    {/* Content */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: 7, borderRadius: 12 }}>
                                    <MapIcon size={18} color={Colors.accent} />
                                </View>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                                    <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>LIVE</Text>
                                </View>
                            </View>
                            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                                TROVA ATTIVITÀ VICINO A TE
                            </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                            <ArrowRight size={20} color="#ffffff" />
                        </View>
                    </View>
                </View>
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
            <View className="mb-8">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-bold text-primary">Esplora Opportunità</Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(volunteer)/map" as any)}
                        className="flex-row items-center gap-1"
                    >
                        <MapIcon size={16} color={Colors.accent} />
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
        </StandardLayout>
    );
}
