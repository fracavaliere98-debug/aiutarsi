import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { useEffect, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../context/ActivityContext";
import { Bell, Sparkles, PlusCircle, Star, Users, Calendar, Clock, AlertCircle, Brain, Plus } from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { SoftCard } from "../../../components/SoftCard";
import { StatCard } from "../../../components/StatCard";
import { ActivityCard } from "../../../components/ActivityCard";
import { StandardLayout } from "../../../components/StandardLayout";
import { EmptyState } from "../../../components/EmptyState";

import { useApplications } from "../../../context/ApplicationContext";
import { useNotifications } from "../../../context/NotificationContext";
import { LinearGradient } from "expo-linear-gradient";
import { NPOHeaderActions } from "../../../components/NPOHeaderActions";
import { UserAvatar } from "../../../components/UserAvatar";

export default function NPODashboard() {
    const { user, getNPOFollowers } = useAuth();
    const router = useRouter();
    const { activities, reviews, getNPORating } = useActivities();
    const { getNPOApplications } = useApplications();
    const { unreadCount } = useNotifications();
    const { users, refreshUsers } = useAuth(); // Destructure users and refreshUsers

    // Refresh followers when screen gains focus to update "online" status
    useFocusEffect(
        useCallback(() => {
            refreshUsers();
        }, [refreshUsers])
    );

    // Filter activities created by this NPO
    const myActivities = activities.filter(a => a.npoId === user?.id);
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

    const { addNotification } = useNotifications();

    const triggerTestNotifications = () => {
        const testData = [
            {
                type: "APPLICATION_RECEIVED" as const,
                title: "Nuova Candidatura! 📋",
                message: "Un volontario si è candidato per la tua attività",
                userId: user?.id || ""
            },
            {
                type: "VOLUNTEER_ENROLLED" as const,
                title: "Nuovo Iscritto! 🎉",
                message: "Un nuovo volontario si è unito al tuo team",
                userId: user?.id || ""
            },
            {
                type: "URGENT" as const,
                title: "Azione Richiesta ⚠️",
                message: "Hai un'attività che richiede attenzione immediata",
                userId: user?.id || ""
            },
            {
                type: "ACTIVITY_UPDATE" as const,
                title: "Aggiornamento Attività 📅",
                message: "Ci sono nuovi dettagli per la tua attività di domani",
                userId: user?.id || ""
            },
            {
                type: "SUCCESS" as const,
                title: "Obiettivo Raggiunto! 🏆",
                message: "Congratulazioni! Hai raggiunto un nuovo traguardo",
                userId: user?.id || ""
            }
        ];

        testData.forEach((data, index) => {
            setTimeout(() => {
                addNotification(data);
            }, index * 200);
        });

        alert("5 Notifiche inviate! Controlla la campanella.");
    };

    const HeaderActions = <NPOHeaderActions />;

    return (
        <StandardLayout
            label="Panoramica Ente"
            title={user?.npoName || "La Tua NPO"}
            rightElement={HeaderActions}
            bg="bg-[#f6f6f8]"
        >
            {/* Stats Overview - Restored 1x4 Row with Individual Colors */}
            <View className="flex-row justify-between mb-8 -mx-1">
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/reviews" as any)}
                >
                    <StatCard
                        value={npoRating.toFixed(1)}
                        label="RATING"
                        valueColor="text-amber-600"
                        icon={<Star size={12} color="#d97706" fill="#d97706" />}
                    />
                </TouchableOpacity>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={myActivities.length}
                        label="MISSIONI"
                        valueColor="text-indigo-600"
                        icon={<Sparkles size={12} color="#4f46e5" />}
                    />
                </View>
                <View className="flex-1 mx-1">
                    <StatCard
                        value={followerCount}
                        label="FOLLOWERS"
                        valueColor="text-blue-600"
                        icon={<Users size={12} color="#2563eb" />}
                    />
                </View>
                <TouchableOpacity
                    className="flex-1 mx-1"
                    activeOpacity={0.7}
                    onPress={() => router.push("/(npo)/volunteers?tab=ISCRITTI" as any)}
                >
                    <StatCard
                        value={totalEnrollmentsCount}
                        label="VOLONTARI"
                        valueColor="text-pink-600"
                        icon={<Users size={12} color="#db2777" />}
                    />
                </TouchableOpacity>
            </View>

            {/* AI Insight Card - Updated with Design System Colors */}
            <TouchableOpacity activeOpacity={0.95} className="mb-8">
                <LinearGradient
                    colors={[Colors.primary, '#5b3dc4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 24, padding: 20, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}
                >
                    <View className="flex-row items-center gap-2 mb-3">
                        <Brain size={18} color={Colors.accent} />
                        <Text className="text-white/80 text-[10px] font-black uppercase tracking-[2px]">AI Insight</Text>
                    </View>
                    <Text className="text-white text-xl font-black mb-1">Previsione Carenza</Text>
                    <Text className="text-white/80 text-xs leading-5 mb-5 font-medium">
                        Carenza prevista per il weekend del 15/10. Copri subito i turni per non perdere l'impatto.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(npo)/create-activity" as any)}
                        className="bg-accent w-full py-3.5 rounded-xl shadow-lg active:scale-[0.98] items-center justify-center"
                        style={{ backgroundColor: Colors.accent }}
                    >
                        <Text className="text-white font-extrabold text-sm">Risolvi Ora</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </TouchableOpacity>

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
                    {followers.filter(vol => vol.lastSeenAt && (new Date().getTime() - new Date(vol.lastSeenAt).getTime()) < 300000).length > 0 ? (
                        followers
                            .filter(vol => vol.lastSeenAt && (new Date().getTime() - new Date(vol.lastSeenAt).getTime()) < 300000)
                            .map((vol) => {
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

                {myActivities.length > 0 ? (
                    <View>
                        {myActivities.map((act) => (
                            <View key={act.id} className="mb-4">
                                <ActivityCard activity={act} onPress={() => router.push(`/activity/${act.id}` as any)} />
                            </View>
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        emoji="🎨"
                        title="Vuoto"
                        description="Nessuna attività in arrivo"
                    />
                )}
            </View>
        </StandardLayout>
    );
}
