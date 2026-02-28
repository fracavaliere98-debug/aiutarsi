import React, { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, Platform, ActivityIndicator, Share, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from "expo-router";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { useGamification } from "../../context/GamificationContext";
import { useApplications } from "../../context/ApplicationContext";
import { useToast } from "../../context/ToastContext";
import { activityService } from "../../services/ActivityService";
import { Activity } from "../../types";
import { Colors } from "../../constants/Colors";
import {
    ArrowLeft, Share2, CheckCircle2, Pencil,
    Users, Star, Tag, MapPin, Phone, Calendar, Clock, Map as MapIcon, ChevronRight
} from "lucide-react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { ErrorState } from "../../components/ErrorState";
import ParallaxScrollView from "../../components/ui/ParallaxScrollView";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "../../utils/supabase";

// Conditional import for react-native-maps to prevent web bundling errors
let MapView: any, Marker: any, PROVIDER_GOOGLE: any;
if (Platform.OS !== 'web') {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

const { width } = Dimensions.get('window');
const isOldAndroid = Platform.OS === 'android' && (typeof Platform.Version === 'number' ? Platform.Version < 29 : parseInt(String(Platform.Version), 10) < 29);

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
    const { user, users } = useAuth();
    const { showToast } = useToast();
    const {
        activities,
        reviews,
        unenrollFromActivity,
        error,
        loadData,
        activityApplications,
        volunteerReviews
    } = useActivities();
    const { handleActivityShare } = useGamification();
    const [debugLogs, setDebugLogs] = useState<string[]>(["Mounting ActivityDetail..."]);

    const addLog = useCallback((msg: string) => {
        console.log(`[DEBUG] ${msg}`);
        setDebugLogs(prev => [...prev.slice(-14), `${new Date().toLocaleTimeString()} - ${msg}`]);
    }, []);

    const activityId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    const activityFromContext = activities.find(a => a.id === activityId);

    const [fetchedActivity, setFetchedActivity] = useState<Activity | null>(null);
    const [fetchLoading, setFetchLoading] = useState(false);

    useEffect(() => {
        if (!activityFromContext && activityId) {
            addLog(`Fetching activity ${activityId} from DB...`);
            setFetchLoading(true);
            activityService.getActivityById(activityId)
                .then(act => {
                    addLog(act ? `Activity fetched successfully: ${act.title}` : `Activity NOT found in DB`);
                    setFetchedActivity(act);
                    setFetchLoading(false);
                })
                .catch(err => {
                    addLog(`FETCH ERROR: ${err.message}`);
                    setFetchLoading(false);
                });
        } else if (activityFromContext) {
            addLog(`Activity found in context: ${activityFromContext.title}`);
        }
    }, [activityId, activityFromContext, addLog]);

    const activity = activityFromContext ?? fetchedActivity;
    const [localIscrittiOverride, setLocalIscrittiOverride] = useState<string[] | null>(null);

    useEffect(() => {
        if (!activity) return;
        const channel = supabase
            .channel(`activity_changes_${activity.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'activities', filter: `id=eq.${activity.id}` },
                () => { setLocalIscrittiOverride(null); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activity?.id]);

    useFocusEffect(
        useCallback(() => {
            setLocalIscrittiOverride(null);
        }, [])
    );

    const isOwner = useMemo(() => {
        if (!user || user.role !== "NPO" || !activity) return false;
        return user.id.trim() === activity.npoId.trim();
    }, [user, activity]);

    const currentIscritti = localIscrittiOverride ?? activity?.iscritti ?? [];
    const isEnrolled = !!user && currentIscritti.includes(user.id);
    const npoUser = useMemo(() => {
        if (!activity?.npoId) return null;
        return users.find(u => u.id === activity.npoId);
    }, [users, activity?.npoId]);

    const isFull = activity ? currentIscritti.length >= activity.slots : false;

    const currentUserApplication = useMemo(() => {
        if (!user || !activity) return null;
        return activityApplications.find(app => app.activityId === activity.id && app.volunteerId === user.id);
    }, [activityApplications, activity, user]);

    const isPending = currentUserApplication?.status === "PENDING";

    const daysSinceEnd = useMemo(() => {
        if (!activity || !activity.endDateTime) return 0;
        const end = new Date(activity.endDateTime).getTime();
        const now = new Date().getTime();
        return Math.floor((now - end) / (1000 * 3600 * 24));
    }, [activity?.endDateTime]);

    const canNPOReview = isOwner && activity?.status === "COMPLETATA" && daysSinceEnd <= 10;
    const hasReviewed = !!user && !!activity && reviews.some(r => r.activityId === activityId && r.volunteerId === user.id);

    const pendingReviewsCount = useMemo(() => {
        if (!activity || !isOwner) return 0;
        const currentReviews = volunteerReviews.filter(r => r.activityId === activity.id);
        const reviewedVolunteerIds = new Set(currentReviews.map(r => r.volunteerId));
        return currentIscritti.filter(volId => !reviewedVolunteerIds.has(volId)).length;
    }, [activity?.id, isOwner, volunteerReviews, currentIscritti]);

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

    const renderContent = () => (
        <View>
            {/* Title - Only in Parallax View, in Safe Mode it's rendered outside */}
            {!isOldAndroid && (
                <Animated.View entering={FadeInDown.delay(100).springify()}>
                    <Text className="text-[28px] font-black text-primary leading-tight mb-2 text-center">{activity?.title}</Text>
                </Animated.View>
            )}

            {/* Organizer Card */}
            <View style={isOldAndroid ? { alignItems: 'center', marginVertical: 10 } : undefined}>
                <Animated.View
                    entering={isOldAndroid ? undefined : FadeInDown.delay(200).springify()}
                    className={isOldAndroid ? "" : "items-center mt-2 mb-2"}
                >
                    <TouchableOpacity
                        onPress={() => isOwner ? router.push('/(npo)/(tabs)/profile') : router.push(`/npo-profile/${activity?.npoId}` as any)}
                        activeOpacity={0.7}
                        className="flex-row items-center gap-3"
                    >
                        <Image
                            source={{ uri: npoUser?.avatar || (activity?.npoId ? `https://ui-avatars.com/api/?name=${activity?.npoName}` : "https://ui-avatars.com/api/?name=NPO") }}
                            className="w-10 h-10 rounded-full border-2 border-white"
                        />
                        <View className="flex-row items-center justify-center gap-1">
                            <Text className="text-base font-black text-primary text-center">
                                {npoUser?.npoName || npoUser?.name || activity?.npoName || "Ente Solidale"}
                            </Text>
                            <CheckCircle2 size={14} color={Colors.accent} fill={Colors.accent} />
                        </View>
                        <ChevronRight size={16} color={Colors.primary} className="ml-1" />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* 3-Column Info Row */}
            <Animated.View
                entering={isOldAndroid ? undefined : FadeInDown.delay(300).springify()}
                className="flex-row gap-3 mb-6"
            >
                <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                    <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                        <Calendar size={20} color={Colors.primary} />
                    </View>
                    <Text className="text-primary font-bold text-sm text-center">
                        {activity?.dateTime ? new Date(activity.dateTime).toLocaleDateString("it-IT", { day: '2-digit', month: 'short' }).replace('.', '') : "--"}
                    </Text>
                    <Text className="text-secondary/60 font-bold uppercase tracking-wide mt-1">DATA</Text>
                </View>

                <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                    <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                        <Clock size={20} color={Colors.primary} />
                    </View>
                    <Text className="text-primary font-bold text-sm text-center">
                        {activity?.dateTime ? new Date(activity.dateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                    </Text>
                    <Text className="text-secondary/60 font-bold uppercase tracking-wide mt-1">ORARIO</Text>
                </View>

                <View className="flex-1 bg-white p-4 rounded-[24px] items-center justify-center shadow-lg shadow-slate-100 border border-slate-50 aspect-square">
                    <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mb-2">
                        <MapPin size={20} color={Colors.primary} />
                    </View>
                    <Text className="text-primary font-bold text-xs text-center leading-tight" numberOfLines={2}>
                        {activity?.location?.address?.split(',')[1]?.trim() || activity?.location?.address?.split(',')[0]?.trim() || "ND"}
                    </Text>
                    <Text className="text-secondary/60 font-bold uppercase tracking-wide mt-1">CITTÀ</Text>
                </View>
            </Animated.View>

            {/* Participants */}
            <Animated.View entering={isOldAndroid ? undefined : FadeInDown.delay(400).springify()} className="bg-white mb-4">
                <View className="flex-row justify-between items-center mb-4">
                    <View>
                        <Text className="text-primary font-bold text-base mb-3">Volontari partecipanti</Text>
                        <View className="flex-row items-center">
                            <View className="flex-row">
                                {currentIscritti.slice(0, 4).map((volId, index) => {
                                    const v = users.find(u => u.id === volId);
                                    return (
                                        <View key={volId} className="rounded-full border-2 border-white -ml-3 first:ml-0" style={{ zIndex: 10 - index }}>
                                            <Image source={{ uri: v?.avatar || "https://ui-avatars.com/api/?name=User" }} className="w-9 h-9 rounded-full" />
                                        </View>
                                    )
                                })}
                                {currentIscritti.length > 4 && (
                                    <View className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white items-center justify-center -ml-3" style={{ zIndex: 0 }}>
                                        <Text className="text-secondary font-bold text-[10px]">+{currentIscritti.length - 4}</Text>
                                    </View>
                                )}
                            </View>
                            {currentIscritti.length === 0 && <Text className="text-secondary/60 text-xs italic ml-2">Nessuno ancora</Text>}
                        </View>
                    </View>
                    <View className="items-end">
                        <Text className="text-secondary/60 text-[10px] font-bold uppercase mb-1">Stato</Text>
                        {activity?.status === "COMPLETATA" ? (
                            <View className="bg-slate-100 px-3 py-1 rounded-xl border border-slate-200"><Text className="text-slate-600 font-black text-[9px] uppercase">Conclusa</Text></View>
                        ) : currentIscritti.length >= (activity?.slots || 0) ? (
                            <View className="bg-rose-50 px-3 py-1 rounded-xl border border-rose-100"><Text className="text-rose-600 font-black text-[9px] uppercase">Pieno</Text></View>
                        ) : (
                            <View className="bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100"><Text className="text-emerald-600 font-black text-[9px] uppercase">Posti Liberi</Text></View>
                        )}
                    </View>
                </View>
            </Animated.View>

            {/* Category & Skills */}
            <Animated.View entering={isOldAndroid ? undefined : FadeInDown.delay(500).springify()}>
                <View className="mb-4">
                    <Text className="text-primary font-bold text-base mb-3">Categoria</Text>
                    <View className="bg-accent/10 px-4 py-2.5 rounded-2xl border border-accent/20 self-start">
                        <Text className="text-accent font-bold text-xs uppercase">{activity?.category}</Text>
                    </View>
                </View>
                <View className="mb-6">
                    <Text className="text-primary font-bold text-base mb-3">Competenze</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {activity?.skills?.map(s => (
                            <View key={s} className="bg-primary/5 px-4 py-2.5 rounded-2xl border border-primary/10">
                                <Text className="text-primary font-bold text-xs">{SKILLS_MAP[s] || s}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </Animated.View>

            {/* Description */}
            <Animated.View entering={isOldAndroid ? undefined : FadeInDown.delay(600).springify()} className="mb-6">
                <Text className="text-primary font-bold text-base mb-3">Descrizione</Text>
                <Text className="text-secondary/80 text-base leading-7">{activity?.description}</Text>
            </Animated.View>

            {/* Location Map - RE-ENABLED for Android 9 test */}
            <Animated.View entering={FadeInDown.delay(700).springify()} className="mb-6">
                <Text className="text-primary font-bold text-base mb-3">Mappa</Text>
                {MapView && activity?.location?.coords?.lat ? (
                    <View className="rounded-[32px] overflow-hidden bg-slate-100 h-52 relative border border-slate-100">
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
                        >
                            <Marker coordinate={{ latitude: activity.location.coords.lat, longitude: activity.location.coords.lng }}>
                                <View className="bg-accent p-2.5 rounded-2xl border-2 border-white"><MapPin size={20} color="white" fill="white" /></View>
                            </Marker>
                        </MapView>
                        <View className="absolute bottom-4 left-4 right-4 bg-white px-4 py-3 rounded-2xl shadow-lg flex-row items-center gap-3 border border-slate-100">
                            <View className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                                <MapIcon size={16} color={Colors.primary} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-bold text-primary flex-1" numberOfLines={1}>{activity?.location?.address || "Indirizzo"}</Text>
                                <Text className="text-[9px] font-bold text-accent uppercase tracking-wide">Tocca per aprire nella Mappa</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View className="h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 items-center justify-center">
                        <Text className="text-secondary/40">Mappa non disponibile</Text>
                    </View>
                )}
            </Animated.View>

            {/* Owner List of Volunteers */}
            {isOwner && (
                <View className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8">
                    <Text className="text-xl font-black text-primary mb-4">Volontari Iscritti</Text>
                    {currentIscritti.map(volId => {
                        const v = users.find(u => u.id === volId);
                        const app = activityApplications.find(a => a.activityId === activity.id && a.volunteerId === volId);
                        if (!v) return null;
                        return (
                            <View key={volId} className="bg-white p-4 rounded-2xl mb-3 border border-slate-100">
                                <View className="flex-row items-center gap-3">
                                    <UserAvatar name={v.name} avatarUrl={v.avatar} size={40} />
                                    <View><Text className="font-bold text-primary">{v.name}</Text><Text className="text-xs text-secondary">{v.email}</Text></View>
                                </View>
                                {app?.phone && <Text className="mt-2 text-xs font-bold text-primary italic">Tel: {app.phone}</Text>}
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );

    if (error) return <ErrorState title="Errore" description="Problema nel caricamento" onRetry={loadData} />;
    if (fetchLoading) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#462282" /></View>;
    if (!activity) return <View className="flex-1 justify-center items-center"><Text>Attività non trovata</Text></View>;

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ParallaxScrollView
                headerBackgroundColor={{ light: 'white', dark: 'black' }}
                headerImage={
                    <View style={{ width: '100%', height: 300 }}>
                        <Image source={{ uri: activity?.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={StyleSheet.absoluteFill} />
                    </View>
                }
            >
                <View className="flex-1 bg-white -mt-12 rounded-t-[40px] px-8 pt-12 pb-40">
                    <View className="absolute -top-6 left-0 right-0 items-center z-10">
                        <View className="shadow-lg shadow-black/20">
                            <View className="px-6 py-3 rounded-full flex-row items-center gap-2 bg-white">
                                <View className={`w-2.5 h-2.5 rounded-full ${activity?.status === "IN_CORSO" ? "bg-amber-500" :
                                    activity?.status === "APERTA" ? "bg-emerald-500" : "bg-slate-400"
                                    }`} />
                                <Text className="text-xs font-black uppercase tracking-widest text-primary">
                                    {activity?.status?.replace("_", " ") || "Dettaglio"}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {renderContent()}
                </View>
            </ParallaxScrollView>

            {/* Sticky Header */}
            <View className="absolute top-0 left-0 right-0 pt-16 px-5 z-50 flex-row justify-between">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-black/40 items-center justify-center">
                    <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View className="flex-row gap-3">
                    <TouchableOpacity onPress={handleShare} className="w-10 h-10 rounded-full bg-black/40 items-center justify-center">
                        <Share2 size={20} color="white" />
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity onPress={() => router.push(`/(npo)/edit-activity/${activity.id}` as any)} className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-lg">
                            <Pencil size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Bottom Bar */}
            <View className="absolute bottom-0 left-0 right-0 bg-white py-5 px-8 rounded-t-[40px] shadow-lg flex-row items-center justify-between border-t border-slate-50">
                <View>
                    <Text className="text-[10px] text-secondary/40 font-bold">STATO</Text>
                    <Text className="text-accent font-bold text-base">{activity.status === "COMPLETATA" ? "Chiusa" : `${Math.max(0, activity.slots - currentIscritti.length)} posti`}</Text>
                </View>

                {isOwner ? (
                    <TouchableOpacity className="bg-slate-100 px-6 py-4 rounded-2xl"><Text className="font-bold">Gestione</Text></TouchableOpacity>
                ) : isEnrolled ? (
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={async () => {
                            const prev = localIscrittiOverride;
                            setLocalIscrittiOverride((current) => (current ?? activity.iscritti).filter(i => i !== user?.id));
                            try { await unenrollFromActivity(activity.id); } catch (e) { setLocalIscrittiOverride(prev); }
                        }} className="bg-red-50 p-4 rounded-2xl"><Text className="text-red-500 font-bold">Annulla</Text></TouchableOpacity>
                        <View className="bg-emerald-50 px-6 py-4 rounded-2xl"><Text className="text-emerald-700 font-bold">Iscritto</Text></View>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(volunteer)/review-application", params: { activityId: activity.id, type: "ACTIVITY" } } as any)}
                        disabled={isFull}
                        className={`px-10 py-4 rounded-2xl ${isFull ? "bg-slate-300" : "bg-accent"}`}
                    >
                        <Text className="text-white font-black">{isFull ? "Pieno" : "Iscriviti"}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Debug (Old Android only) */}
            {isOldAndroid && (
                <View style={{ position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 10, zIndex: 999 }}>
                    <Text style={{ color: '#0f0', fontSize: 10 }}>ANDROID 9 DIAG</Text>
                    {debugLogs.map((l, i) => <Text key={i} style={{ color: '#fff', fontSize: 8 }}>{l}</Text>)}
                </View>
            )}
        </View>
    );
}
