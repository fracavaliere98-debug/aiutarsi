
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, Platform, ActivityIndicator, Share } from "react-native";
import { useLocalSearchParams, useRouter, Link, Stack, useFocusEffect } from "expo-router";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { useCallback } from "react";
import { useGamification } from "../../context/GamificationContext";
import { useApplications } from "../../context/ApplicationContext";
import { useToast } from "../../context/ToastContext";
import { activityService } from "../../services/ActivityService";
import { Activity } from "../../types";
import { Colors } from "../../constants/Colors";
import {
    ArrowLeft, Share2, Sparkles, CheckCircle2, Send, Pencil,
    Users, Star, Tag, MapPin, Phone, Calendar, Clock, Map as MapIcon
} from "lucide-react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { ErrorState } from "../../components/ErrorState";
import ParallaxScrollView from "../../components/ui/ParallaxScrollView";
import { ActivityInfoCard } from "../../components/activity/ActivityInfoCard";
import { OrganizerCard } from "../../components/activity/OrganizerCard";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "../../utils/supabase";

const { width } = Dimensions.get('window');

const SKILLS_MAP: Record<string, string> = {
    "comms": "Comunicazione",
    "tech": "Informatica",
    "medical": "Primo Soccorso",
    "creative": "Creatività",
    "planning": "Organizzazione",
    "data": "Analisi Dati",
    "manual": "Lavoro Manuale",
    "photo": "Fotografia"
};

export default function ActivityDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user, followNPO, unfollowNPO, isFollowingNPO, users } = useAuth();
    const { showToast } = useToast();
    const { applyToNPO, hasAppliedToNPO } = useApplications();
    const {
        activities,
        reviews,
        enrollInActivity,
        unenrollFromActivity,
        error,
        loadData,
        activityApplications,
        volunteerReviews
    } = useActivities();
    const { handleActivityShare } = useGamification();

    if (error) {
        return (
            <ErrorState
                title="Errore di caricamento"
                description="Non siamo riusciti a caricare i dettagli dell'attività."
                onRetry={loadData}
            />
        );
    }

    const activityId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    const activityFromContext = activities.find(a => a.id === activityId);

    // Fallback: if not in context (e.g. coming from map), fetch directly from DB
    const [fetchedActivity, setFetchedActivity] = useState<Activity | null>(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    useEffect(() => {
        if (!activityFromContext && activityId) {
            setFetchLoading(true);
            activityService.getActivityById(activityId).then(act => {
                setFetchedActivity(act);
                setFetchLoading(false);
            });
        }
    }, [activityId, activityFromContext]);

    const activity = activityFromContext ?? fetchedActivity;

    // LOCAL OVERRIDE to guarantee 100% instant reactivity regardless of context/pagination limits
    const [localIscrittiOverride, setLocalIscrittiOverride] = useState<string[] | null>(null);

    // REALTIME SYNC
    useEffect(() => {
        if (!activity) return;

        // 1. Creiamo il canale per questa specifica attività
        const channel = supabase
            .channel(`activity_changes_${activity.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'activities',
                    filter: `id=eq.${activity.id}`,
                },
                (_payload) => {
                    // 2. RESET cruciale: il database è aggiornato, 
                    // quindi cancelliamo l'override locale e torniamo ai dati reali che pioveranno
                    // dal normale fetch globale.
                    setLocalIscrittiOverride(null);
                }
            )
            .subscribe();

        // 3. Cleanup quando il componente viene rimosso
        return () => {
            supabase.removeChannel(channel);
        };
    }, [activity?.id]);

    useFocusEffect(
        useCallback(() => {
            // Ogni volta che l'utente torna su questa schermata (anche con il Back)
            // resettiamo gli override locali per forzare il recupero dei dati freschi dal DB
            setLocalIscrittiOverride(null);
        }, [])
    );

    const isOwner = useMemo(() => {
        if (!user || user.role !== "NPO" || !activity) return false;
        const userId = user.id.trim();
        const activityNpoId = activity.npoId.trim();
        return userId === activityNpoId;
    }, [user, activity]);

    const currentIscritti = localIscrittiOverride ?? activity?.iscritti ?? [];
    const isEnrolled = !!user && currentIscritti.includes(user.id);
    const npoUser = useMemo(() => users.find(u => u.id === activity?.npoId), [users, activity?.npoId]);
    const isFull = activity ? currentIscritti.length >= activity.slots : false;
    const activityReviews = reviews.filter(r => r.activityId === activityId);
    const hasReviewed = !!user && !!activity && reviews.some(r => r.activityId === activityId && r.volunteerId === user.id);

    const currentUserApplication = useMemo(() => {
        if (!user || !activity) return null;
        return activityApplications.find(app => app.activityId === activity.id && app.volunteerId === user.id);
    }, [activityApplications, activity, user]);

    const isPending = currentUserApplication?.status === "PENDING";

    // --- NPO REVIEW LOGIC ---
    const daysSinceEnd = useMemo(() => {
        if (!activity || !activity.endDateTime) return 0;
        const end = new Date(activity.endDateTime).getTime();
        const now = new Date().getTime();
        return Math.floor((now - end) / (1000 * 3600 * 24));
    }, [activity?.endDateTime]);

    const canNPOReview = isOwner && activity?.status === "COMPLETATA" && daysSinceEnd <= 10;
    const isNPOReviewExpired = isOwner && activity?.status === "COMPLETATA" && daysSinceEnd > 10;

    // Check if the NPO has already reviewed ALL enrolled volunteers
    const pendingReviewsCount = useMemo(() => {
        if (!activity || !isOwner) return 0;
        const currentReviews = volunteerReviews.filter(r => r.activityId === activity.id);
        const reviewedVolunteerIds = new Set(currentReviews.map(r => r.volunteerId));
        return currentIscritti.filter(volId => !reviewedVolunteerIds.has(volId)).length;
    }, [activity?.id, isOwner, volunteerReviews, currentIscritti]);

    if (fetchLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <ActivityIndicator size="large" color="#462282" />
                <Text style={{ marginTop: 12, color: '#64748b', fontWeight: '600' }}>Caricamento attività...</Text>
            </View>
        );
    }

    if (!activity) {
        return (
            <View className="flex-1 justify-center items-center bg-white px-10">
                <Text className="text-primary font-black text-2xl mb-2 text-center">Attività non trovata</Text>
                <TouchableOpacity onPress={() => router.back()} className="bg-primary px-8 py-4 rounded-2xl mt-4">
                    <Text className="text-white font-black">Torna Indietro</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleShare = async () => {
        if (!activity) return;
        try {
            const result = await Share.share({
                message: `Partecipa a questa attività di volontariato: ${activity.title}\nScarica AiutarSi!`,
                url: `https://aiutarsi.app/activity/${activity.id}`,
            });
            if (result.action === Share.sharedAction) {
                handleActivityShare(activity.id);
            }
        } catch (error) {
            console.error("Error sharing activity:", error);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ParallaxScrollView
                headerBackgroundColor={{ light: 'white', dark: 'black' }}
                headerImage={
                    <View style={{ width: '100%', height: 300 }}>
                        <Image
                            source={{ uri: activity.imageUrl || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop" }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
                            style={[StyleSheet.absoluteFill]}
                        />
                    </View>
                }
            >
                <View className="flex-1 bg-white -mt-12 rounded-t-[40px] px-8 pt-12 pb-40">

                    {/* Centered Floating Status Badge - Positioned on the edge */}
                    <View className="absolute -top-6 left-0 right-0 items-center z-10">
                        <View className="shadow-lg shadow-black/20">
                            <BlurView intensity={90} tint="light" className="px-6 py-3 rounded-full overflow-hidden flex-row items-center gap-2 bg-white/95">
                                <View className={`w-2.5 h-2.5 rounded-full ${activity.status === "IN_CORSO" ? "bg-amber-500" :
                                    activity.status === "APERTA" ? "bg-emerald-500" : "bg-slate-400"
                                    }`} />
                                <Text className="text-xs font-black uppercase tracking-widest text-primary">
                                    {activity.status.replace("_", " ")}
                                </Text>
                            </BlurView>
                        </View>
                    </View>

                    {/* Title */}
                    <Animated.View entering={FadeInDown.delay(100).springify()}>
                        <Text className="text-[28px] font-black text-primary leading-tight mb-5 text-center">{activity.title}</Text>
                    </Animated.View>

                    {/* Organizer Card (Centered & Clickable) */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-8 items-center">
                        <TouchableOpacity
                            onPress={() => isOwner ? router.push('/(npo)/(tabs)/profile') : router.push(`/npo-profile/${activity?.npoId}` as any)}
                            activeOpacity={0.7}
                            className="bg-white px-5 h-[64px] rounded-full flex-row items-center gap-3 border border-slate-100 shadow-sm"
                        >
                            <Image
                                source={{ uri: npoUser?.avatar || "https://ui-avatars.com/api/?name=NPO" }}
                                className="w-10 h-10 rounded-full"
                            />
                            <View className="justify-center">
                                <View className="flex-row items-center gap-1.5">
                                    <Text
                                        className="text-sm font-black text-primary leading-none"
                                        style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                                    >
                                        {npoUser?.npoName || activity.npoName}
                                    </Text>
                                    <CheckCircle2 size={12} color={Colors.accent} fill={Colors.accent} />
                                </View>
                                <Text
                                    className="text-secondary/60 text-[9px] font-bold uppercase tracking-widest leading-none mt-1.5"
                                    style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                                >
                                    {npoUser?.publicEmail || "Organizzazione Verificata"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* 3-Column Info Row */}
                    <Animated.View entering={FadeInDown.delay(300).springify()} className="flex-row gap-3 mb-6">
                        {/* DATE */}
                        <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                            <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                                <Calendar size={20} color={Colors.primary} />
                            </View>
                            <Text className="text-primary font-bold text-sm text-center">
                                {new Date(activity.dateTime).toLocaleDateString("it-IT", { day: '2-digit', month: 'short' }).replace('.', '')}
                            </Text>
                            <Text className="text-[10px] text-secondary/60 font-bold uppercase tracking-wide mt-1">DATA</Text>
                        </View>

                        {/* TIME */}
                        <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                            <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                                <Clock size={20} color={Colors.primary} />
                            </View>
                            <Text className="text-primary font-bold text-sm text-center">
                                {new Date(activity.dateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Text className="text-[10px] text-secondary/60 font-bold uppercase tracking-wide mt-1">ORARIO</Text>
                        </View>

                        {/* LOCATION */}
                        <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                            <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                                <MapPin size={20} color={Colors.primary} />
                            </View>
                            <Text className="text-primary font-bold text-xs text-center leading-tight" numberOfLines={2}>
                                {activity.location.address.split(',')[1]?.trim() || activity.location.address.split(',')[0]?.trim() || "ND"}
                            </Text>
                            <Text className="text-[10px] text-secondary/60 font-bold uppercase tracking-wide mt-1">CITTÀ</Text>
                        </View>
                    </Animated.View>

                    {/* Participants Section */}
                    <Animated.View entering={FadeInDown.delay(400).springify()} className="bg-white mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-primary font-bold text-base mb-3">Volontari che parteciperanno</Text>

                                {/* Overlapping Avatars (Now under title) */}
                                <View className="flex-row items-center">
                                    <View className="flex-row">
                                        {currentIscritti.slice(0, 4).map((volId, index) => {
                                            const volunteer = users.find(u => u.id === volId);
                                            return (
                                                <View key={volId} className={`rounded-full border-2 border-white -ml-3 first:ml-0 z-${10 - index}`}>
                                                    <Image
                                                        source={{ uri: volunteer?.avatar || "https://ui-avatars.com/api/?name=User" }}
                                                        className="w-9 h-9 rounded-full"
                                                    />
                                                </View>
                                            )
                                        })}
                                        {currentIscritti.length > 4 && (
                                            <View className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white items-center justify-center -ml-3 z-0">
                                                <Text className="text-secondary font-bold text-[10px]">+{currentIscritti.length - 4}</Text>
                                            </View>
                                        )}
                                    </View>
                                    {currentIscritti.length === 0 && (
                                        <Text className="text-secondary/60 text-xs italic">Nessun partecipante ancora</Text>
                                    )}
                                </View>
                            </View>

                            <View className="items-end">
                                <View className="flex-row items-center gap-2 mb-1.5">
                                    <Text className="text-secondary/60 text-[10px] font-bold uppercase tracking-widest">Stato</Text>
                                </View>
                                {activity.status === "COMPLETATA" ? (
                                    <View className="bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                                        <Text className="text-slate-600 font-black text-[9px] uppercase">Conclusa</Text>
                                    </View>
                                ) : currentIscritti.length >= activity.slots ? (
                                    <View className="bg-rose-50 px-3 py-1 rounded-xl border border-rose-100">
                                        <Text className="text-rose-600 font-black text-[9px] uppercase">Posti Esauriti</Text>
                                    </View>
                                ) : (
                                    <View className="bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100">
                                        <Text className="text-emerald-600 font-black text-[9px] uppercase">Posti Liberi</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* Category & Skills (Split) */}
                    <Animated.View entering={FadeInDown.delay(500).springify()}>
                        <View className="mb-6">
                            <Text className="text-primary font-bold text-base mb-3">Categoria</Text>
                            <View className="flex-row flex-wrap gap-2">
                                <View className="bg-accent/10 px-4 py-2.5 rounded-2xl border border-accent/20">
                                    <Text className="text-accent font-bold text-xs uppercase">{activity.category}</Text>
                                </View>
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="text-primary font-bold text-base mb-3">Competenze Richieste</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {activity.skills && activity.skills.length > 0 ? (
                                    activity.skills.map(skillId => (
                                        <View key={skillId} className="bg-primary/5 px-4 py-2.5 rounded-2xl border border-primary/10">
                                            <Text className="text-primary font-bold text-xs">{SKILLS_MAP[skillId] || skillId}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text className="text-secondary/50 text-sm italic">Nessuna competenza specifica richiesta</Text>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* Description */}
                    <Animated.View entering={FadeInDown.delay(600).springify()} className="mb-6">
                        <Text className="text-primary font-bold text-base mb-3">Descrizione Attività</Text>
                        <Text className="text-secondary/80 text-base leading-7">
                            {activity.description}
                        </Text>
                    </Animated.View>

                    {/* Location Map (Real Implementation) */}
                    <Animated.View entering={FadeInDown.delay(700).springify()} className="mb-6">
                        <Text className="text-primary font-bold text-base mb-3">Luogo dell'Attività</Text>
                        {isOwner ? (
                            <View className="rounded-[32px] overflow-hidden bg-slate-100 h-52 relative border border-slate-100 shadow-sm">
                                <MapView
                                    provider={PROVIDER_GOOGLE}
                                    style={{ width: '100%', height: '100%' }}
                                    initialRegion={{
                                        latitude: activity.location.coords.lat,
                                        longitude: activity.location.coords.lng,
                                        latitudeDelta: 0.005,
                                        longitudeDelta: 0.005,
                                    }}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    pitchEnabled={false}
                                    rotateEnabled={false}
                                >
                                    <Marker
                                        coordinate={{
                                            latitude: activity.location.coords.lat,
                                            longitude: activity.location.coords.lng,
                                        }}
                                    >
                                        <View className="bg-accent p-2.5 rounded-2xl shadow-xl shadow-accent/40 border-2 border-white">
                                            <MapPin size={20} color="white" fill="white" />
                                        </View>
                                    </Marker>
                                </MapView>
                                <View className="absolute bottom-4 left-4 right-4 bg-white/95 px-4 py-3 rounded-2xl shadow-lg flex-row items-center gap-3 border border-slate-100">
                                    <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                        <MapIcon size={16} color={Colors.primary} />
                                    </View>
                                    <Text className="text-[11px] font-bold text-primary flex-1" numberOfLines={1}>{activity.location.address}</Text>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => router.push({
                                    pathname: '/(volunteer)/(tabs)/map',
                                    params: {
                                        focusLat: activity.location.coords.lat.toString(),
                                        focusLng: activity.location.coords.lng.toString(),
                                        focusActivityId: activity.id,
                                    }
                                } as any)}
                            >
                                <View className="rounded-[32px] overflow-hidden bg-slate-100 h-52 relative border border-slate-100 shadow-sm">
                                    <MapView
                                        provider={PROVIDER_GOOGLE}
                                        style={{ width: '100%', height: '100%' }}
                                        initialRegion={{
                                            latitude: activity.location.coords.lat,
                                            longitude: activity.location.coords.lng,
                                            latitudeDelta: 0.005,
                                            longitudeDelta: 0.005,
                                        }}
                                        scrollEnabled={false}
                                        zoomEnabled={false}
                                        pitchEnabled={false}
                                        rotateEnabled={false}
                                    >
                                        <Marker
                                            coordinate={{
                                                latitude: activity.location.coords.lat,
                                                longitude: activity.location.coords.lng,
                                            }}
                                        >
                                            <View className="bg-accent p-2.5 rounded-2xl shadow-xl shadow-accent/40 border-2 border-white">
                                                <MapPin size={20} color="white" fill="white" />
                                            </View>
                                        </Marker>
                                    </MapView>
                                    <View className="absolute bottom-4 left-4 right-4 bg-white/95 px-4 py-3 rounded-2xl shadow-lg flex-row items-center gap-3 border border-slate-100">
                                        <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                            <MapIcon size={16} color={Colors.primary} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-[11px] font-bold text-primary flex-1" numberOfLines={1}>{activity.location.address}</Text>
                                            <Text className="text-[9px] font-bold text-accent uppercase tracking-wide">Tocca per aprire nella Mappa</Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    </Animated.View>

                    {/* NPO Owner View: Volunteers List Full (Enhanced) */}
                    {isOwner && (
                        <View className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Users size={20} color={Colors.primary} />
                                <Text className="text-xl font-black text-primary">Elenco Volontari</Text>
                            </View>
                            {currentIscritti.map((volId) => {
                                const volunteer = users.find(u => u.id === volId);
                                const application = activityApplications.find(app => (app.activityId === activity.id && app.volunteerId === volId));

                                if (!volunteer) return null;
                                return (
                                    <TouchableOpacity
                                        key={volId}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${volId}` as any)}
                                        activeOpacity={0.7}
                                        className="bg-white p-4 rounded-2xl mb-3 border border-slate-100 shadow-sm"
                                    >
                                        <View className="flex-row items-center gap-3 mb-3">
                                            <UserAvatar name={volunteer.name} avatarUrl={volunteer.avatar} size={40} />
                                            <View className="flex-1">
                                                <Text className="font-bold text-primary">{volunteer.name}</Text>
                                                <Text className="text-xs text-secondary">{volunteer.email}</Text>
                                            </View>
                                        </View>

                                        {/* Phone & Notes if available */}
                                        {(application?.phone || application?.message) && (
                                            <View className="bg-slate-50 p-3 rounded-xl gap-2">
                                                {application.phone && (
                                                    <View className="flex-row items-center gap-2">
                                                        <Phone size={14} color={Colors.secondary} />
                                                        <Text className="text-xs text-primary font-bold">{application.phone}</Text>
                                                    </View>
                                                )}
                                                {application.message && (
                                                    <View className="flex-row items-start gap-2">
                                                        <View className="mt-0.5"><Tag size={14} color={Colors.secondary} /></View>
                                                        <Text className="text-xs text-secondary italic flex-1">"{application.message}"</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ParallaxScrollView>

            {/* Sticky Header (Back, Share, Edit) */}
            <View className="absolute top-0 left-0 right-0 pt-16 px-5 z-50 flex-row justify-between items-center">
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full bg-black/30 items-center justify-center backdrop-blur-md">
                        <ArrowLeft size={20} color="white" />
                    </View>
                </TouchableOpacity>
                <View className="flex-row gap-3">
                    {/* Share Button */}
                    <TouchableOpacity onPress={handleShare}>
                        <View className="w-10 h-10 rounded-full bg-black/30 items-center justify-center backdrop-blur-md">
                            <Share2 size={20} color="white" />
                        </View>
                    </TouchableOpacity>

                    {/* Edit Button (NPO Only) */}
                    {isOwner && (
                        <TouchableOpacity onPress={() => router.push(`/(npo)/edit-activity/${activity.id}` as any)}>
                            <View className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-lg">
                                <Pencil size={20} color={Colors.primary} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Bottom Action Bar */}
            <View className="absolute bottom-0 left-0 right-0 bg-white py-5 px-8 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-50 flex-row items-center justify-between">
                {/* Slots Left or Status */}
                <View className="flex-1 mr-4">
                    <Text className="text-[9px] font-bold text-secondary/40 uppercase tracking-widest mb-1">
                        {activity.status === "COMPLETATA" ? "ATTIVITÀ" : "STATO"}
                    </Text>
                    <Text className="text-accent font-bold text-base" numberOfLines={1}>
                        {activity.status === "COMPLETATA" ? "Conclusa" : `${Math.max(0, activity.slots - currentIscritti.length)} posti rimasti`}
                    </Text>
                </View>

                {/* Action Button */}
                {isOwner ? (
                    activity.status === "COMPLETATA" ? (
                        canNPOReview ? (
                            pendingReviewsCount > 0 ? (
                                <TouchableOpacity
                                    onPress={() => router.push(`/(npo)/review-volunteers/${activity.id}` as any)}
                                    activeOpacity={0.8}
                                    className="bg-accent ml-2 px-6 py-4 rounded-2xl shadow-lg shadow-accent/20 active:scale-95 transition-transform flex-row items-center justify-center gap-2"
                                >
                                    <Star size={18} color="white" fill="white" />
                                    <Text className="text-white font-black text-sm">Valuta Volontari</Text>
                                </TouchableOpacity>
                            ) : (
                                <View className="bg-emerald-50 ml-2 px-6 py-4 rounded-2xl border border-emerald-200 flex-row items-center justify-center gap-2">
                                    <CheckCircle2 size={18} color="#059669" />
                                    <Text className="text-emerald-700 font-bold text-sm">Tutti Valutati</Text>
                                </View>
                            )
                        ) : (
                            <View className="bg-slate-100 flex-1 ml-2 h-14 rounded-2xl border border-slate-200 justify-center items-center">
                                <Text className="text-slate-500 font-bold text-xs text-center px-2">Scaduto</Text>
                            </View>
                        )
                    ) : (
                        <View className="bg-slate-100 flex-1 ml-2 h-14 rounded-2xl border border-slate-200 justify-center items-center">
                            <Text className="text-slate-500 font-bold text-xs text-center px-2">Gestione Attività</Text>
                        </View>
                    )
                ) : isEnrolled ? (
                    activity.status === "COMPLETATA" ? (
                        hasReviewed ? (
                            <View className="bg-slate-100 ml-3 px-6 h-14 rounded-2xl border border-slate-200 flex-row items-center justify-center gap-2">
                                <CheckCircle2 size={14} color="#64748b" />
                                <Text className="text-slate-500 font-bold text-sm leading-none" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>Feedback Inviato</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => router.push(`/feedback/${activity.id}` as any)}
                                activeOpacity={0.8}
                                className="bg-accent ml-3 px-8 h-14 rounded-2xl shadow-lg shadow-accent/20 active:scale-95 transition-transform flex-row items-center justify-center gap-2"
                            >
                                <Star size={16} color="white" fill="white" />
                                <Text className="text-white font-black text-sm leading-none" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>Valuta</Text>
                            </TouchableOpacity>
                        )
                    ) : (
                        <View className="flex-1 ml-0 flex-row gap-2 justify-end">
                            <TouchableOpacity
                                onPress={async () => {
                                    // Memorizziamo il valore precedente per il rollback
                                    const previousOverride = localIscrittiOverride;

                                    try {
                                        // 1. UPDATE OTTIMISTICO FUNZIONALE
                                        setLocalIscrittiOverride((prev) => {
                                            const baseList = prev ?? activity?.iscritti ?? [];
                                            return baseList.filter(id => id !== user?.id);
                                        });

                                        // 2. CHIAMATA AL DB
                                        await unenrollFromActivity(activity.id);

                                        // (il reset verrà triggerato dal listener Realtime)
                                    } catch (e) {
                                        // 3. ROLLBACK: Ripristina esattamente com'era prima
                                        setLocalIscrittiOverride(previousOverride);
                                        showToast("error", "Errore durante l'annullamento");
                                    }
                                }}
                                activeOpacity={0.7}
                                className="bg-red-50 h-14 w-14 rounded-2xl border border-red-100 items-center justify-center shrink-0"
                            >
                                <Text className="text-red-500 font-black text-lg">×</Text>
                            </TouchableOpacity>
                            <View className="bg-emerald-50 h-14 px-6 rounded-2xl border border-emerald-100 flex-row items-center justify-center gap-2">
                                <CheckCircle2 size={18} color="#10b981" fill="#10b981" />
                                <Text className="text-emerald-800 font-bold text-sm">Iscritto</Text>
                            </View>
                        </View>
                    )
                ) : isPending ? (
                    <View className="bg-amber-50 flex-1 ml-2 h-14 rounded-2xl border border-amber-100 flex-row items-center justify-center gap-2">
                        <Clock size={18} color="#f59e0b" />
                        <Text className="text-amber-600 font-bold text-sm">In attesa di approvazione</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => router.push({
                            pathname: "/(volunteer)/review-application",
                            params: { activityId: activity.id, type: "ACTIVITY" }
                        } as any)}
                        disabled={isFull}
                        activeOpacity={0.8}
                        className={`px-10 py-4 rounded-2xl shadow-xl shadow-accent/30 items-center justify-center active:scale-95 transition-transform ${isFull ? "bg-slate-300" : "bg-accent"}`}
                    >
                        <View className="flex-row items-center justify-center relative">
                            <Text className="text-white font-black text-sm uppercase" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>
                                {isFull ? "Posti Esauriti" : "Iscriviti ora"}
                            </Text>
                            {!isFull && (
                                <View style={{ position: 'absolute', right: -24 }}>
                                    <ArrowLeft size={16} color="white" style={{ transform: [{ rotate: '180deg' }] }} />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
