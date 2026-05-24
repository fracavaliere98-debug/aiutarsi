import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, Share, Text, TouchableOpacity, View } from "react-native";
import {
    Settings,
    Share2,
    Users,
    Globe,
    Star,
    Clock,
    MapPin,
    Mail,
    Phone,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { StandardLayout } from "../../../components/StandardLayout";
import { SoftCard } from "../../../components/SoftCard";
import { StatCard } from "../../../components/StatCard";
import { UserAvatar } from "../../../components/UserAvatar";
import { ActivityCard } from "../../../components/ActivityCard";
import { useAuth } from "../../../context/AuthContext";
import { useActivitiesDomain } from "../../../hooks/activities/selectors";
import { supabase } from "../../../utils/supabase";
import { colors } from "@/theme";

export default function NPOProfileScreen() {
    const { user, getNPOFollowers, fetchUserById, setUser } = useAuth();
    const { activities, reviews, loadData } = useActivitiesDomain(user);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"info" | "attivita" | "recensioni" | "referente">("attivita");
    const [refreshing, setRefreshing] = useState(false);
    const [hasPendingVerificationRequest, setHasPendingVerificationRequest] = useState(false);

    const npoActivities = (activities || []).filter((a: any) => a.npoId === user?.id);
    const openActivities = npoActivities.filter((a: any) => a.status === "APERTA");
    const pastActivities = npoActivities.filter((a: any) => a.status === "COMPLETATA");
    const followerCount = user?.id ? getNPOFollowers(user.id).length : 0;
    const npoReviews = (reviews || []).filter((r: any) => {
        const activity = (activities || []).find((a: any) => a.id === r.activityId);
        return activity?.npoId === user?.id;
    });
    const averageRating = npoReviews.length > 0
        ? (npoReviews.reduce((sum: number, r: any) => sum + r.stars, 0) / npoReviews.length).toFixed(1)
        : "0.0";

    const impactHours = useMemo(() => {
        return pastActivities.reduce((total: number, act: any) => {
            const start = new Date(act.dateTime).getTime();
            const end = new Date(act.endDateTime).getTime();
            const durationHours = (end - start) / (1000 * 60 * 60);
            return total + (durationHours * act.iscritti.length);
        }, 0).toFixed(0);
    }, [pastActivities]);

    const shouldShowProfilePrompt =
        !user?.profile_completed || !user?.avatar_url || !(user?.publicEmail || user?.public_email) || !user?.phone;
    const isVerified = !!(user?.isVerified || user?.is_verified);
    const isPendingVerification = !isVerified && (user?.verification_status === "pending" || hasPendingVerificationRequest);
    const shouldShowVerificationPrompt = !isVerified && !isPendingVerification;
    const shouldShowPendingVerification = isPendingVerification;

    const syncPendingVerificationStatus = useCallback(async () => {
        if (!user?.id || isVerified) {
            setHasPendingVerificationRequest(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from("verification_requests")
                .select("id")
                .eq("user_id", user.id)
                .eq("status", "pending")
                .limit(1);

            if (error) throw error;

            const hasPending = !!data && data.length > 0;
            setHasPendingVerificationRequest(hasPending);

            if (hasPending && user.verification_status !== "pending") {
                setUser({
                    ...user,
                    verification_status: "pending",
                });
            }
        } catch (error) {
            console.error("Failed to check pending verification request:", error);
        }
    }, [isVerified, setUser, user]);

    useEffect(() => {
        void syncPendingVerificationStatus();
    }, [syncPendingVerificationStatus]);

    const handleShare = async () => {
        if (!user) return;
        try {
            await Share.share({
                message: `🏢 ${user.npoName || user.name}\nScopri il profilo del nostro ente su AiutarSì!\n\n📱 Apri nell'app:\naiutarsiapp://npo-profile/${user.id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/npo-profile/${user.id}`,
            });
        } catch (error) {
            console.error("Error sharing NPO profile:", error);
        }
    };

    const HeaderActions = (
        <View className="flex-row gap-2">
            <TouchableOpacity onPress={handleShare} className="bg-white/10 p-2.5 rounded-xl border border-white/20">
                <Share2 size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(npo)/settings" as any)} className="bg-white/10 p-2.5 rounded-xl border border-white/20">
                <Settings size={18} color="white" />
            </TouchableOpacity>
        </View>
    );

    const handleRefresh = useCallback(async () => {
        if (!user?.id) return;

        setRefreshing(true);
        try {
            await loadData();
            const freshUser = await fetchUserById(user.id);
            if (freshUser) {
                setUser(freshUser);
            }
            await syncPendingVerificationStatus();
        } finally {
            setRefreshing(false);
        }
    }, [fetchUserById, loadData, setUser, syncPendingVerificationStatus, user?.id]);

    return (
        <StandardLayout
            label="Il tuo ente"
            title="Profilo"
            rightElement={HeaderActions}
            bg="bg-background-light"
            hideBack={true}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
        >
            <View className="items-center mb-6">
                <View className="relative mb-3">
                    <UserAvatar
                        size={100}
                        fontSize={36}
                        name={user?.npoName || user?.name}
                        avatarUrl={user?.avatar || user?.avatar_url || undefined}
                        role="NPO"
                        isVerified={!!(user?.isVerified || user?.is_verified)}
                        verificationStatus={user?.verification_status ?? undefined}
                    />
                </View>

                <Text className="text-primary font-black text-2xl text-center mb-1">
                    {user?.npoName || user?.name || "Ente Solidale"}
                </Text>
                <Text className="text-secondary font-medium text-sm text-center mb-4 mt-1">
                    {user?.locationString || user?.address_full || "Sede da completare"}
                </Text>

                {shouldShowProfilePrompt && (
                    <TouchableOpacity
                        onPress={() => router.push("/(npo)/edit-profile" as any)}
                        activeOpacity={0.85}
                        className="w-full bg-primary/5 border border-primary/10 rounded-2xl px-4 py-4"
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center mr-3">
                                <Settings size={18} color={colors.primary} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-primary font-bold text-sm">Completa il profilo del tuo ente</Text>
                                <Text className="text-secondary text-xs mt-0.5">
                                    Aggiungi logo, email pubblica e telefono per rendere il profilo piu affidabile.
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {shouldShowVerificationPrompt && (
                    <TouchableOpacity
                        onPress={() => router.push("/(npo)/verification" as any)}
                        activeOpacity={0.85}
                        className="w-full mt-3 bg-[#f8f4ff] border border-[#e9d5ff] rounded-2xl px-4 py-4"
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-2xl bg-[#ede9fe] items-center justify-center mr-3">
                                <Star size={18} color="#7c3aed" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-primary font-bold text-sm">Completa la verifica per il Bollino Viola</Text>
                                <Text className="text-secondary text-xs mt-0.5">
                                    Tocca qui per caricare i documenti del tuo ente e ottenere il badge di verifica.
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {shouldShowPendingVerification && (
                    <View className="w-full mt-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4">
                        <Text className="text-orange-700 font-bold text-sm">Verifica in revisione</Text>
                        <Text className="text-orange-700/80 text-xs mt-0.5">
                            La richiesta per il Bollino Viola è stata inviata. Ti aggiorneremo appena completata la revisione.
                        </Text>
                    </View>
                )}
            </View>

            <View className="flex-row gap-3 mb-8">
                <View className="flex-1 h-24">
                    <StatCard
                        value={averageRating}
                        label="RATING"
                        valueColor="text-yellow-500"
                        icon={<Star size={14} color="#eab308" fill="#eab308" />}
                        onPress={() => router.push("/(npo)/report" as any)}
                        testID="npo-profile-report-rating"
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={followerCount.toString()}
                        label="FOLLOWER"
                        valueColor="text-pink-600"
                        icon={<Users size={14} color="#db2777" />}
                        onPress={() => router.push("/(npo)/report" as any)}
                        testID="npo-profile-report-followers"
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={impactHours}
                        label="ORE DONATE"
                        valueColor="text-indigo-600"
                        icon={<Clock size={14} color="#4f46e5" />}
                        onPress={() => router.push("/(npo)/report" as any)}
                        testID="npo-profile-report-hours"
                    />
                </View>
            </View>

            <View className="flex-row border-b border-gray-100 mb-6 justify-between px-2">
                <TouchableOpacity onPress={() => setActiveTab("attivita")} className={`px-2 py-3 border-b-2 ${activeTab === "attivita" ? "border-primary" : "border-transparent"}`}>
                    <Text className={`font-bold text-sm ${activeTab === "attivita" ? "text-primary" : "text-gray-400"}`}>Attività</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab("info")} className={`px-2 py-3 border-b-2 ${activeTab === "info" ? "border-primary" : "border-transparent"}`}>
                    <Text className={`font-bold text-sm ${activeTab === "info" ? "text-primary" : "text-gray-400"}`}>Chi siamo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab("recensioni")} className={`px-2 py-3 border-b-2 ${activeTab === "recensioni" ? "border-primary" : "border-transparent"}`}>
                    <Text className={`font-bold text-sm ${activeTab === "recensioni" ? "text-primary" : "text-gray-400"}`}>Recensioni</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab("referente")} className={`px-2 py-3 border-b-2 ${activeTab === "referente" ? "border-primary" : "border-transparent"}`}>
                    <Text className={`font-bold text-sm ${activeTab === "referente" ? "text-primary" : "text-gray-400"}`}>Referente</Text>
                </TouchableOpacity>
            </View>

            <View className="pb-10">
                {activeTab === "attivita" && (
                    <View>
                        <Text className="text-primary font-bold text-lg mb-4">Prossime attività</Text>
                        {openActivities.length > 0 ? (
                            openActivities.map((activity: any) => (
                                <ActivityCard
                                    key={activity.id}
                                    activity={activity}
                                    style={{ marginBottom: 16 }}
                                    onPress={() => router.push(`/activity/${activity.id}` as any)}
                                />
                            ))
                        ) : (
                            <View className="items-center py-8">
                                <Text className="text-secondary/60 text-center">Nessuna attività programmata al momento.</Text>
                            </View>
                        )}
                    </View>
                )}

                {activeTab === "info" && (
                    <View className="gap-4">
                        <SoftCard className="p-5">
                            <Text className="text-primary font-bold text-base mb-2">Chi siamo</Text>
                            <Text className="text-secondary leading-relaxed text-sm">
                                {user?.bio || "Completa la missione del tuo ente per raccontare meglio chi siete e l'impatto che create sul territorio."}
                            </Text>
                        </SoftCard>

                        <SoftCard className="p-5">
                            <Text className="text-primary font-bold text-base mb-3">Informazioni</Text>
                            <View className="gap-4">
                                {(user?.publicEmail || user?.public_email) && (
                                    <View className="flex-row items-center gap-3">
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Mail size={16} color={colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Email</Text>
                                            <Text className="text-primary font-medium">{user.publicEmail || user.public_email}</Text>
                                        </View>
                                    </View>
                                )}
                                {user?.phone && (
                                    <View className="flex-row items-center gap-3">
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Phone size={16} color={colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Telefono</Text>
                                            <Text className="text-primary font-medium">{user.phone}</Text>
                                        </View>
                                    </View>
                                )}
                                {user?.website && (
                                    <View className="flex-row items-center gap-3">
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Globe size={16} color={colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Sito Web</Text>
                                            <Text className="text-primary font-medium" numberOfLines={1}>{user.website}</Text>
                                        </View>
                                    </View>
                                )}
                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                        <MapPin size={16} color={colors.primary} />
                                    </View>
                                    <View>
                                        <Text className="text-secondary text-xs font-bold uppercase">Sede Operativa</Text>
                                        <Text className="text-primary font-medium">{user?.locationString || "Sede Principale"}</Text>
                                    </View>
                                </View>
                            </View>
                        </SoftCard>
                    </View>
                )}

                {activeTab === "recensioni" && (
                    <View>
                        <Text className="text-primary font-bold text-lg mb-4">Cosa dicono di noi</Text>
                        {npoReviews.length > 0 ? (
                            npoReviews.map((review: any) => (
                                <SoftCard key={review.id} className="p-4 mb-3">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-row gap-0.5">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Star key={s} size={14} color={s <= review.stars ? colors.accent : "#e2e8f0"} fill={s <= review.stars ? colors.accent : "transparent"} />
                                            ))}
                                        </View>
                                        <Text className="text-secondary/40 text-[10px] font-bold">{new Date(review.date).toLocaleDateString()}</Text>
                                    </View>
                                    <Text className="text-primary italic text-sm mb-2">&quot;{review.comment}&quot;</Text>
                                </SoftCard>
                            ))
                        ) : (
                            <View className="py-12 items-center">
                                <Text className="text-secondary/50 text-center">Nessuna recensione ancora.</Text>
                            </View>
                        )}
                    </View>
                )}

                {activeTab === "referente" && (
                    <View>
                        <Text className="text-primary font-bold text-lg mb-4">Referente dell&apos;ente</Text>
                        <SoftCard className="p-6 items-center">
                            <UserAvatar
                                size={120}
                                fontSize={42}
                                name={user?.referent_name || "R"}
                                avatarUrl={user?.referent_avatar_url || undefined}
                            />
                            <Text className="text-primary font-black text-xl mt-4 text-center">
                                {user?.referent_name || "Referente non specificato"}
                            </Text>
                            <Text className="text-secondary font-bold text-[10px] uppercase tracking-widest text-center">
                                {user?.referent_role || "Ruolo non specificato"}
                            </Text>
                            <View className="w-full h-[1px] bg-gray-100 my-6" />
                            <Text className="text-secondary text-sm text-center leading-relaxed px-4 pb-4">
                                {user?.auto_welcome_message
                                    ? user.auto_welcome_message
                                    : `${user?.referent_name || "Il referente"} segue candidature, attività e primi contatti per ${user?.npoName || "questo ente"}.`}
                            </Text>
                        </SoftCard>
                    </View>
                )}
            </View>
        </StandardLayout>
    );
}
