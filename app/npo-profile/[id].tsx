
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useActivities } from "../../context/ActivityContext";
import { useApplications } from "../../context/ApplicationContext";
import { useToast } from "../../context/ToastContext";
import { AppUser } from "../../types";
import { supabase } from "../../utils/supabase";
import { ArrowLeft, Share2, Heart, Star, Users, Calendar, Clock, ChevronRight, MapPin, Globe, Mail, Phone, CheckCircle2, MessageCircle, AlertTriangle } from "lucide-react-native";
import { StandardLayout } from "../../components/StandardLayout";
import { UserAvatar } from "../../components/UserAvatar";
import { SoftCard } from "../../components/SoftCard";
import { StatCard } from "../../components/StatCard";
import { BadgePill } from "../../components/BadgePill";
import { ActivityCard } from "../../components/ActivityCard";
import { Colors } from "../../constants/Colors";
import { useState } from "react";
import ChatService from "../../services/ChatService";
import ReportModal from "../../components/ReportModal";

export default function NPOProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user, followNPO, unfollowNPO, isFollowingNPO, getNPOFollowers, users } = useAuth();
    const { activities, reviews } = useActivities();
    const { applyToNPO, hasAppliedToNPO } = useApplications();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<"info" | "attivita" | "recensioni" | "referente">("attivita");
    const [showReportModal, setShowReportModal] = useState(false);
    const [fetchedNpo, setFetchedNpo] = useState<AppUser | null>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Get NPO data
    const npoId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    
    // Use Effect to fetch NPO directly if not in users list
    useEffect(() => {
        const existing = users.find(u => u.id === npoId && u.role === "NPO");
        if (!existing && npoId) {
            const fetchNpo = async () => {
                setIsFetching(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select(`
                            *,
                            user_skills (skill),
                            user_interests (interest),
                            followed_entities:npo_followers!npo_followers_follower_id_fkey (npo_id)
                        `)
                        .eq('id', npoId)
                        .single();

                    if (data && !error) {
                        const mapped: AppUser = {
                            ...data,
                            name: data.full_name || data.npo_name || 'Utente',
                            avatar: data.avatar_url,
                            profileCompleted: data.profile_completed,
                            npoName: data.npo_name || data.full_name,
                        } as any;
                        setFetchedNpo(mapped);
                    }
                } catch (err) {
                    console.error("Error fetching NPO:", err);
                } finally {
                    setIsFetching(false);
                }
            };

            fetchNpo();
        }
    }, [npoId, users]); // Added users to dependencies as `existing` depends on it.

    const npoUser = users.find(u => u.id === npoId && u.role === "NPO") || fetchedNpo;

    // Get NPO activities
    const npoActivities = activities.filter(a => a.npoId === npoId);
    const openActivities = npoActivities.filter(a => a.status === "APERTA");
    const pastActivities = npoActivities.filter(a => a.status === "COMPLETATA");

    // Get NPO stats
    const followerCount = getNPOFollowers(npoId).length;

    // Calculate total donated hours (approx: completed activities * duration * participants)
    // For now, simpler metric: just sum of completed activity durations * participants
    const totalDonatedHours = pastActivities.reduce((total, act) => {
        const start = new Date(act.dateTime).getTime();
        const end = new Date(act.endDateTime).getTime();
        const durationHours = (end - start) / (1000 * 60 * 60);
        return total + (durationHours * act.iscritti.length);
    }, 0);

    const npoReviews = reviews.filter(r => {
        const activity = activities.find(a => a.id === r.activityId);
        return activity?.npoId === npoId;
    });

    const npoRating = npoReviews.length > 0
        ? parseFloat((npoReviews.reduce((sum, r) => sum + r.stars, 0) / npoReviews.length).toFixed(1))
        : 0.0;

    const averageRating = npoRating.toFixed(1);

    if (isFetching) {
        return (
            <StandardLayout title="Caricamento..." label="Profilo Ente">
                <View className="flex-1 items-center justify-center p-10">
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text className="text-secondary mt-4 font-medium">Recupero informazioni ente...</Text>
                </View>
            </StandardLayout>
        );
    }

    if (!npoUser) {
        return (
            <StandardLayout title="Ente Non Trovato" label="Profilo Non Trovato" onBack={() => router.back()}>
                <View className="flex-1 items-center justify-center p-10">
                    <AlertTriangle size={48} color={Colors.accent} style={{ marginBottom: 16 }} />
                    <Text className="text-primary font-bold text-lg mb-2">Ops! Profilo non trovato</Text>
                    <Text className="text-secondary text-center mb-6">Non siamo riusciti a trovare le informazioni per questo ente.</Text>
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        className="bg-primary px-6 py-3 rounded-full"
                    >
                        <Text className="text-white font-bold">Torna Indietro</Text>
                    </TouchableOpacity>
                </View>
            </StandardLayout>
        );
    }

    const handleApply = () => {
        if (!user || user.role !== "VOLUNTEER") return;

        router.push({
            pathname: "/(volunteer)/review-application",
            params: { npoId, type: "NPO" }
        } as any);
    };

    const handleMessageNPO = async () => {
        if (!user || user.role !== "VOLUNTEER") return;
        try {
            const convId = await ChatService.startPrivateConversation(user.id, npoId);
            router.push(`/messages/${convId}` as any);
        } catch (error) {
            console.error("Error starting chat with NPO:", error);
            showToast("error", "Errore nell'avvio della chat");
        }
    };

    const handleOpenLink = async (url: string) => {
        try {
            // Check if URL has protocol, if not add https:// (unless it's mailto/tel)
            let finalUrl = url;
            if (!url.startsWith("http") && !url.startsWith("mailto") && !url.startsWith("tel")) {
                finalUrl = "https://" + url;
            }

            const canOpen = await Linking.canOpenURL(finalUrl);
            if (canOpen) {
                await Linking.openURL(finalUrl);
            } else {
                Alert.alert("Errore", "Impossibile aprire il link: " + url);
            }
        } catch (error) {
            console.error("Link error:", error);
            Alert.alert("Errore", "Si è verificato un problema nell'apertura del link.");
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🏢 ${npoUser.npoName || npoUser.name}\nScopri questo Ente su AiutarSì!\n\n📱 Apri direttamente nell'app:\naiutarsiapp://npo-profile/${npoId}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/npo-profile/${npoId}`,
            });
        } catch (error) {
            console.error("Error sharing profile:", error);
        }
    };

    const HeaderActions = (
        <View className="flex-row gap-2">
            {user?.role === "VOLUNTEER" && (
                <TouchableOpacity
                    onPress={handleMessageNPO}
                    className="p-2 bg-white/20 rounded-full"
                >
                    <MessageCircle size={20} color="white" />
                </TouchableOpacity>
            )}
            {user?.role === "VOLUNTEER" && (
                <TouchableOpacity
                    onPress={() => setShowReportModal(true)}
                    className="p-2 bg-white/20 rounded-full bg-red-500/20"
                >
                    <AlertTriangle size={20} color="white" />
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleShare} className="p-2 bg-white/20 rounded-full">
                <Share2 size={20} color="white" />
            </TouchableOpacity>
        </View>
    );

    return (
        <StandardLayout
            title={npoUser.npoName || "Profilo Ente"}
            label="Profilo Ente"
            rightElement={HeaderActions}
            bg="bg-background-light"
            onBack={() => router.back()}
        >
            {/* Header Profile Section */}
            <View className="items-center mb-6">
                <View className="relative mb-3">
                    <UserAvatar
                        size={100}
                        fontSize={36}
                        name={npoUser.npoName || npoUser.name}
                        avatarUrl={npoUser.avatar}
                        role="NPO"
                        isVerified={!!(npoUser.isVerified || npoUser.is_verified)}
                        verificationStatus={npoUser.verification_status}
                    />
                </View>

                <Text className="text-primary font-black text-2xl text-center mb-1">
                    {npoUser.npoName || npoUser.name}
                </Text>
                <Text className="text-secondary font-medium text-sm text-center mb-4 mt-1">
                    Comitato Locale • {npoUser.locationString || "Milano, MI"}
                </Text>

                {/* Main Action: Follow */}
                <TouchableOpacity
                    onPress={async () => {
                        if (!user || user.role !== "VOLUNTEER") return;
                        const isFollowing = isFollowingNPO(npoId);
                        const success = isFollowing
                            ? await unfollowNPO(npoId)
                            : await followNPO(npoId);
                        if (success) {
                            showToast(
                                isFollowing ? "info" : "success",
                                isFollowing ? "Non segui più questa NPO" : `Ora segui ${npoUser.npoName}!`
                            );
                        }
                    }}
                    className={`px-6 h-11 rounded-full flex-row items-center justify-center gap-2 border ${user?.role === "VOLUNTEER" && isFollowingNPO(npoId)
                        ? "bg-white border-accent"
                        : "bg-accent border-accent"
                        }`}
                >
                    <Heart
                        size={18}
                        color={user?.role === "VOLUNTEER" && isFollowingNPO(npoId) ? Colors.accent : "white"}
                        fill={user?.role === "VOLUNTEER" && isFollowingNPO(npoId) ? Colors.accent : "transparent"}
                    />
                    <Text className={`font-bold text-sm ${user?.role === "VOLUNTEER" && isFollowingNPO(npoId)
                        ? "text-accent"
                        : "text-white"
                        }`}>
                        {user?.role === "VOLUNTEER" && isFollowingNPO(npoId) ? "Segui già" : "Segui Ente"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View className="flex-row gap-3 mb-8">
                <TouchableOpacity
                    className="flex-1 h-24"
                    onPress={() => setActiveTab("recensioni")}
                >
                    <StatCard
                        value={averageRating}
                        label="RATING"
                        valueColor="text-yellow-500"
                        icon={<Star size={14} color="#eab308" fill="#eab308" />}
                    />
                </TouchableOpacity>
                <View className="flex-1 h-24">
                    <StatCard
                        value={followerCount.toString()}
                        label="FOLLOWER"
                        valueColor="text-pink-600"
                        icon={<Users size={14} color="#db2777" />}
                    />
                </View>
                <View className="flex-1 h-24">
                    <StatCard
                        value={Math.round(totalDonatedHours).toString()}
                        label="ORE DONATE"
                        valueColor="text-indigo-600"
                        icon={<Clock size={14} color="#4f46e5" />}
                    />
                </View>
            </View>

            {/* Become Volunteer Callout */}
            {user?.role === "VOLUNTEER" && !hasAppliedToNPO(user.id, npoId) && (
                <SoftCard className="p-4 mb-6 bg-primary" onPress={handleApply}>
                    <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-4">
                            <Text className="text-white font-black text-lg mb-1">Diventa Volontario</Text>
                            <Text className="text-white/80 text-xs text-medium">
                                Unisciti al team di {npoUser.npoName} per accedere ad attività esclusive.
                            </Text>
                        </View>
                        <View className="bg-white/20 p-2 rounded-full">
                            <ChevronRight size={24} color="white" />
                        </View>
                    </View>
                </SoftCard>
            )}

            {/* Already Applied Badge */}
            {user?.role === "VOLUNTEER" && hasAppliedToNPO(user.id, npoId) && (
                <View className="bg-green-50 p-4 rounded-xl border border-green-100 flex-row items-center justify-center gap-2 mb-6">
                    <CheckCircle2 size={18} color="#15803d" />
                    <Text className="text-green-800 font-bold text-sm">Candidatura inviata con successo</Text>
                </View>
            )}

            {/* Contact & Info Tabs */}
            <View className="flex-row border-b border-gray-100 mb-6 justify-between px-2">
                <TouchableOpacity
                    onPress={() => setActiveTab("attivita")}
                    className={`px-2 py-3 border-b-2 ${activeTab === "attivita" ? "border-primary" : "border-transparent"}`}
                >
                    <Text className={`font-bold text-sm ${activeTab === "attivita" ? "text-primary" : "text-gray-400"}`}>Attività</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab("info")}
                    className={`px-2 py-3 border-b-2 ${activeTab === "info" ? "border-primary" : "border-transparent"}`}
                >
                    <Text className={`font-bold text-sm ${activeTab === "info" ? "text-primary" : "text-gray-400"}`}>Chi Siamo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab("recensioni")}
                    className={`px-2 py-3 border-b-2 ${activeTab === "recensioni" ? "border-primary" : "border-transparent"}`}
                >
                    <Text className={`font-bold text-sm ${activeTab === "recensioni" ? "text-primary" : "text-gray-400"}`}>Recensioni</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab("referente")}
                    className={`px-2 py-3 border-b-2 ${activeTab === "referente" ? "border-primary" : "border-transparent"}`}
                >
                    <Text className={`font-bold text-sm ${activeTab === "referente" ? "text-primary" : "text-gray-400"}`}>Referente</Text>
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View className="pb-10">
                {activeTab === "attivita" && (
                    <View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-primary font-bold text-lg">Prossime Attività</Text>
                            <TouchableOpacity onPress={() => router.push("/(volunteer)/search" as any)}>
                                <Text className="text-accent font-bold text-xs">VEDI TUTTE</Text>
                            </TouchableOpacity>
                        </View>

                        {openActivities.length > 0 ? (
                            openActivities.map(activity => (
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

                        {/* Past Activities Teaser */}
                        {pastActivities.length > 0 && (
                            <View className="mt-8">
                                <Text className="text-primary font-bold text-lg mb-4">Attività Concluse</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                                    {pastActivities.slice(0, 5).map(act => (
                                        <View key={act.id} className="w-64 bg-slate-50 p-4 rounded-2xl mr-3 border border-slate-100">
                                            <Text className="text-primary font-bold text-sm mb-1" numberOfLines={1}>{act.title}</Text>
                                            <Text className="text-secondary text-xs mb-2">
                                                {new Date(act.dateTime).toLocaleDateString()}
                                            </Text>
                                            <View className="flex-row items-center gap-1">
                                                <CheckCircle2 size={12} color="green" />
                                                <Text className="text-green-700 text-[10px] font-bold uppercase">Completata</Text>
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                )}

                {activeTab === "info" && (
                    <View className="gap-4">
                        <SoftCard className="p-5">
                            <Text className="text-primary font-bold text-base mb-3">Informazioni</Text>

                            <View className="gap-4">
                                {npoUser.publicEmail && (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-3"
                                        onPress={() => handleOpenLink(`mailto:${npoUser.publicEmail}`)}
                                    >
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Mail size={16} color={Colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Email</Text>
                                            <Text className="text-primary font-medium">{npoUser.publicEmail}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {npoUser.phone && (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-3"
                                        onPress={() => handleOpenLink(`tel:${npoUser.phone}`)}
                                    >
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Phone size={16} color={Colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Telefono</Text>
                                            <Text className="text-primary font-medium">{npoUser.phone}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {npoUser.website && (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-3"
                                        onPress={() => handleOpenLink(npoUser.website!)}
                                    >
                                        <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                            <Globe size={16} color={Colors.primary} />
                                        </View>
                                        <View>
                                            <Text className="text-secondary text-xs font-bold uppercase">Sito Web</Text>
                                            <Text className="text-primary font-medium truncate max-w-[200px]" numberOfLines={1}>{npoUser.website}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 bg-indigo-50 rounded-full items-center justify-center">
                                        <MapPin size={16} color={Colors.primary} />
                                    </View>
                                    <View>
                                        <Text className="text-secondary text-xs font-bold uppercase">Sede Operativa</Text>
                                        <Text className="text-primary font-medium">{npoUser.locationString || "Sede Principale"}</Text>
                                    </View>
                                </View>
                            </View>
                        </SoftCard>

                        {npoUser.bio && (
                            <SoftCard className="p-5">
                                <Text className="text-primary font-bold text-base mb-2">Chi Siamo</Text>
                                <Text className="text-secondary leading-relaxed text-sm">
                                    {npoUser.bio}
                                </Text>
                            </SoftCard>
                        )}

                        {/* Map Placeholder */}
                        <View className="h-40 bg-slate-100 rounded-2xl items-center justify-center border border-slate-200">
                            <MapPin size={32} color={Colors.secondary} />
                            <Text className="text-secondary/50 text-xs font-bold mt-2">Mappa non disponibile</Text>
                        </View>
                    </View>
                )}

                {activeTab === "recensioni" && (
                    <View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-primary font-bold text-lg">Cosa dicono di noi</Text>
                        </View>

                        {npoReviews.length > 0 ? (
                            npoReviews.map(review => (
                                <SoftCard key={review.id} className="p-4 mb-3">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-row gap-0.5">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={14} color={s <= review.stars ? Colors.accent : "#e2e8f0"} fill={s <= review.stars ? Colors.accent : "transparent"} />
                                            ))}
                                        </View>
                                        <Text className="text-secondary/40 text-[10px] font-bold">{new Date(review.date).toLocaleDateString()}</Text>
                                    </View>
                                    <Text className="text-primary italic text-sm mb-2">&quot;{review.comment}&quot;</Text>
                                    {review.feelings.length > 0 && (
                                        <View className="flex-row flex-wrap gap-2">
                                            {review.feelings.map(f => (
                                                <View key={f} className="bg-gray-100 px-2 py-1 rounded-md">
                                                    <Text className="text-secondary text-[10px] font-bold uppercase">{f}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
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
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-primary font-bold text-lg">Il Tuo Referente</Text>
                        </View>

                        <SoftCard className="p-6 items-center">
                            <UserAvatar
                                size={120}
                                fontSize={42}
                                name={npoUser.referent_name || "R"}
                                avatarUrl={npoUser.referent_avatar_url || undefined}
                            />
                            <Text className="text-primary font-black text-xl mt-4 text-center">
                                {npoUser.referent_name || "Referente non specificato"}
                            </Text>
                            <Text className="text-secondary font-bold text-[10px] uppercase tracking-widest text-center">
                                {npoUser.referent_role || "Ruolo non specificato"}
                            </Text>

                            <View className="w-full h-[1px] bg-gray-100 my-6" />

                            <Text className="text-secondary text-sm text-center leading-relaxed italic px-4 pb-4">
                                &quot;Insieme possiamo fare la differenza. Il mio compito è guidarti nella tua missione di volontariato con {npoUser.npoName || 'il nostro ente'}.&quot;
                            </Text>

                            {user?.role === "VOLUNTEER" && (
                                <TouchableOpacity
                                    onPress={handleMessageNPO}
                                    className="mt-6 bg-primary py-2 px-8 rounded-full flex-row items-center justify-center gap-2"
                                >
                                    <MessageCircle size={18} color="white" />
                                    <Text className="text-white font-bold text-sm">Contatta Referente</Text>
                                </TouchableOpacity>
                            )}
                        </SoftCard>
                    </View>
                )}
            </View>

            {/* Modal di Segnalazione */}
            <ReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reportedUser={npoUser as any}
                contentType="profile"
            />
        </StandardLayout>
    );
}

const styles = {
    // Helper if needed for specific overrides not covered by tailwind
};
