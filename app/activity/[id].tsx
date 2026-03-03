import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
    View, Text, TouchableOpacity, Image, ScrollView,
    Share, Platform, Dimensions, ActivityIndicator, Linking
} from "react-native";
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
    ArrowLeft, Share2, Pencil, MapPin, Calendar,
    RefreshCw, ChevronRight, Users, Star, CheckCircle2, Zap, FileText, MessageSquare
} from "lucide-react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { ErrorState } from "../../components/ErrorState";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "../../utils/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

// Conditional import for map opening
const openMapsUrl = (lat: number, lng: number, label?: string) => {
    const encoded = encodeURIComponent(label || '');
    const url = Platform.OS === 'ios'
        ? `maps:?q=${encoded}&ll=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`;
    Linking.openURL(url).catch(() => {
        // Fallback to Google Maps
        Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
};

const { width: SCREEN_W } = Dimensions.get('window');

const SKILLS_LABELS: Record<string, string> = {
    comms: "Comunicazione",
    tech: "Informatica",
    medical: "Primo Soccorso",
    creative: "Creatività",
    planning: "Organizzazione",
    data: "Analisi Dati",
    manual: "Lavoro Manuale",
    photo: "Fotografia",
    empathy: "Empatia",
    logistics: "Logistica",
    teamwork: "Lavoro di squadra",
};

// Human-readable recurrence label derived from the start date
const getRecurrenceLabel = (recurrence: string | undefined, dateTime: string | undefined): string | null => {
    if (!recurrence || recurrence === 'NONE' || !dateTime) return null;
    const d = new Date(dateTime);
    if (recurrence === 'WEEKLY') {
        const dayName = d.toLocaleDateString('it-IT', { weekday: 'long' });
        return `OGNI ${dayName.toUpperCase()}`;
    }
    if (recurrence === 'MONTHLY') {
        const day = d.getDate();
        return `OGNI ${day} DEL MESE`;
    }
    return null;
};

const STATUS_CONFIG = {
    APERTA: { label: 'Aperta', bg: '#dcfce7', text: '#16a34a', dot: '#16a34a' },
    IN_CORSO: { label: 'In Corso', bg: '#fef9c3', text: '#ca8a04', dot: '#ca8a04' },
    COMPLETATA: { label: 'Completata', bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
    CANCELLATA: { label: 'Cancellata', bg: '#fee2e2', text: '#dc2626', dot: '#dc2626' },
};

export default function ActivityDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user, users } = useAuth();
    const { showToast } = useToast();
    const {
        activities, reviews, unenrollFromActivity, error, loadData,
        activityApplications, volunteerReviews
    } = useActivities();
    const { handleActivityShare } = useGamification();

    const activityId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    const activityFromContext = activities.find(a => a.id === activityId);

    const [fetchedActivity, setFetchedActivity] = useState<Activity | null>(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [localIscrittiOverride, setLocalIscrittiOverride] = useState<string[] | null>(null);

    useEffect(() => {
        if (!activityFromContext && activityId) {
            setFetchLoading(true);
            activityService.getActivityById(activityId)
                .then(act => { setFetchedActivity(act); setFetchLoading(false); })
                .catch(() => setFetchLoading(false));
        }
    }, [activityId, activityFromContext]);

    const activity = activityFromContext ?? fetchedActivity;

    useEffect(() => {
        if (!activity) return;
        const channel = supabase
            .channel(`activity_detail_${activity.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activities', filter: `id=eq.${activity.id}` },
                () => setLocalIscrittiOverride(null))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activity?.id]);

    useFocusEffect(useCallback(() => { setLocalIscrittiOverride(null); }, []));

    const isOwner = useMemo(() => {
        if (!user || user.role !== "NPO" || !activity) return false;
        return user.id.trim() === activity.npoId.trim();
    }, [user, activity]);

    const isOtherNPO = user?.role === 'NPO' && !isOwner;

    const currentIscritti = localIscrittiOverride ?? activity?.iscritti ?? [];
    const isEnrolled = !!user && currentIscritti.includes(user.id);
    const isFull = activity ? currentIscritti.length >= activity.slots : false;

    const npoUser = useMemo(() => {
        if (!activity?.npoId) return null;
        return users.find(u => u.id === activity.npoId);
    }, [users, activity?.npoId]);

    const currentUserApplication = useMemo(() => {
        if (!user || !activity) return null;
        return activityApplications.find(app => app.activityId === activity.id && app.volunteerId === user.id);
    }, [activityApplications, activity, user]);

    const isPending = currentUserApplication?.status === "PENDING";

    const hasReviewed = !!user && !!activity &&
        reviews.some(r => r.activityId === activityId && r.volunteerId === user.id);

    const daysSinceEnd = useMemo(() => {
        if (!activity?.endDateTime) return 0;
        return Math.floor((Date.now() - new Date(activity.endDateTime).getTime()) / 86400000);
    }, [activity?.endDateTime]);

    const canLeaveReview = user?.role === 'VOLUNTEER' && isEnrolled &&
        activity?.status === 'COMPLETATA' && !hasReviewed && daysSinceEnd <= 10;

    // ─── Share ──────────────────────────────────────────────────────────────
    const handleShare = async () => {
        if (!activity) return;
        try {
            await Share.share({
                title: activity.title,
                message: `👐 ${activity.title}\nPartecipa a questa attività su AiutarSi!\nhttps://aiutarsi.app/activity/${activity.id}`,
                url: `https://aiutarsi.app/activity/${activity.id}`, // iOS only
            });
            handleActivityShare(activity.id);
        } catch (e) { /* user cancelled */ }
    };

    // ─── Computed display values ─────────────────────────────────────────────
    const statusCfg = STATUS_CONFIG[activity?.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.APERTA;
    const recurrenceLabel = getRecurrenceLabel(activity?.recurrence, activity?.dateTime);

    const formattedDateRange = useMemo(() => {
        if (!activity?.dateTime) return '—';
        const start = new Date(activity.dateTime);
        const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        const startTime = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const endTime = activity.endDateTime
            ? new Date(activity.endDateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
            : null;
        const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        return endTime ? `${capitalized}, ${startTime} – ${endTime}` : `${capitalized}, ${startTime}`;
    }, [activity?.dateTime, activity?.endDateTime]);

    const locationShortName = useMemo(() => {
        const addr = activity?.location?.address;
        if (!addr) return 'Posizione';
        const parts = addr.split(',');
        return parts[0]?.trim() || addr;
    }, [activity?.location?.address]);

    const slotsLeft = Math.max(0, (activity?.slots ?? 0) - currentIscritti.length);

    // ─── Guards ──────────────────────────────────────────────────────────────
    if (error) return <ErrorState title="Errore" description="Problema nel caricamento" onRetry={loadData} />;
    if (fetchLoading) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );
    if (!activity) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
            <Text style={{ color: Colors.secondary }}>Attività non trovata</Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* ── Hero Image ───────────────────────────────────────── */}
                <View style={{ width: SCREEN_W, height: 260, position: 'relative' }}>
                    <Image
                        source={{ uri: activity.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.title)}&size=800&background=D81B60&color=fff` }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.45)']}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
                    />
                    {/* Status badge – bottom right of image */}
                    <View style={{
                        position: 'absolute', bottom: 14, right: 14,
                        backgroundColor: statusCfg.bg,
                        paddingHorizontal: 12, paddingVertical: 6,
                        borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6
                    }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusCfg.dot }} />
                        <Text style={{ color: statusCfg.text, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {statusCfg.label}
                        </Text>
                    </View>
                </View>

                {/* ── Content ─────────────────────────────────────────── */}
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

                    {/* Badges row: category + recurrence */}
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
                        {activity.category && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                                <Star size={12} color="white" fill="white" />
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {activity.category}
                                </Text>
                            </View>
                        )}
                        {recurrenceLabel && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#c7d2fe' }}>
                                <RefreshCw size={11} color="#4f46e5" />
                                <Text style={{ color: '#4338ca', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                    {recurrenceLabel}
                                </Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* Title */}
                    <Animated.Text
                        entering={FadeInDown.delay(150).springify()}
                        style={{ fontSize: 28, fontWeight: '900', color: Colors.primary, lineHeight: 34, marginBottom: 20, textAlign: 'center' }}
                    >
                        {activity.title}
                    </Animated.Text>

                    {/* NPO organizer */}
                    <Animated.View entering={FadeInDown.delay(180).springify()} style={{ marginBottom: 20, alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => isOwner ? router.push('/(npo)/(tabs)/profile') : router.push(`/npo-profile/${activity.npoId}` as any)}
                            activeOpacity={0.7}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        >
                            <Image
                                source={{ uri: npoUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.npoName || 'NPO')}&background=random` }}
                                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'white' }}
                            />
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.primary, textAlign: 'center' }}>
                                    {npoUser?.npoName || npoUser?.name || activity.npoName || 'Ente Solidale'}
                                </Text>
                                <Text style={{ fontSize: 12, color: Colors.secondary, textAlign: 'center' }}>Organizzatore</Text>
                            </View>
                            <CheckCircle2 size={16} color={Colors.accent} fill={Colors.accent} />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Info Card: date/time + location */}
                    <Animated.View entering={FadeInDown.delay(220).springify()} style={{
                        backgroundColor: '#f8fafc', borderRadius: 20, marginBottom: 24,
                        borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden'
                    }}>
                        {/* Date & Time row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
                            <View style={{ width: 38, height: 38, backgroundColor: '#ede9fe', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                <Calendar size={18} color={Colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>DATA E ORA</Text>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>{formattedDateRange}</Text>
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 16 }} />

                        {/* Location row – tappable */}
                        <TouchableOpacity
                            activeOpacity={activity.location?.coords?.lat ? 0.7 : 1}
                            disabled={!activity.location?.coords?.lat}
                            onPress={() => {
                                if (activity.location?.coords?.lat) {
                                    openMapsUrl(activity.location.coords.lat, activity.location.coords.lng, locationShortName);
                                }
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
                        >
                            <View style={{ width: 38, height: 38, backgroundColor: '#ffe4e6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                <MapPin size={18} color="#e11d48" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>LUOGO</Text>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>{locationShortName}</Text>
                                {activity.location?.address && locationShortName !== activity.location.address && (
                                    <Text style={{ fontSize: 12, color: '#64748b' }} numberOfLines={1}>{activity.location.address}</Text>
                                )}
                            </View>
                            {activity.location?.coords?.lat && (
                                <ChevronRight size={18} color={Colors.secondary} />
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Skills */}
                    {activity.skills && activity.skills.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(280).springify()} style={{ marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>Competenze Richieste</Text>
                            </View>
                            {/* Auto-sizing chips that wrap naturally */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {activity.skills.map(s => (
                                    <View
                                        key={s}
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            paddingVertical: 10, paddingHorizontal: 16,
                                            borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>
                                            {SKILLS_LABELS[s] || s}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* Description */}
                    <Animated.View entering={FadeInDown.delay(340).springify()} style={{ marginBottom: 28 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary, marginBottom: 10 }}>Descrizione Attività</Text>
                        <Text style={{ fontSize: 15, color: '#475569', lineHeight: 24 }}>{activity.description}</Text>
                    </Animated.View>

                    {/* Volunteers participating – icon + avatars inline, no title */}
                    <Animated.View entering={FadeInDown.delay(400).springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <Users size={20} color={Colors.primary} />
                        {currentIscritti.length === 0 ? (
                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>Nessun volontario ancora</Text>
                        ) : (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {currentIscritti.slice(0, 8).map((volId, idx) => {
                                        const v = users.find(u => u.id === volId);
                                        return (
                                            <View key={volId} style={{ marginRight: -10, zIndex: 20 - idx }}>
                                                <Image
                                                    source={{ uri: v?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(v?.name || 'U')}&background=random` }}
                                                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'white' }}
                                                />
                                            </View>
                                        );
                                    })}
                                    {currentIscritti.length > 8 && (
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center', marginLeft: 14 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.secondary }}>+{currentIscritti.length - 8}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ marginLeft: currentIscritti.length > 8 ? 18 : 14, fontSize: 13, color: '#64748b', fontWeight: '600' }}>
                                    {currentIscritti.length} iscritto{currentIscritti.length !== 1 ? 'i' : ''}
                                </Text>
                            </>
                        )}
                    </Animated.View>

                    {/* NPO Owner: enrolled volunteers list */}
                    {isOwner && currentIscritti.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(460).springify()} style={{
                            backgroundColor: '#f8fafc', borderRadius: 20, padding: 20,
                            borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
                        }}>
                            <Text style={{ fontSize: 17, fontWeight: '900', color: Colors.primary, marginBottom: 12 }}>Gestione Volontari</Text>
                            {currentIscritti.map(volId => {
                                const v = users.find(u => u.id === volId);
                                const app = activityApplications.find(a => a.activityId === activity.id && a.volunteerId === volId);
                                if (!v) return null;
                                return (
                                    <TouchableOpacity
                                        key={volId}
                                        onPress={() => router.push(`/(npo)/volunteer-profile/${volId}` as any)}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' }}
                                        activeOpacity={0.7}
                                    >
                                        <UserAvatar name={v.name} avatarUrl={v.avatar} size={40} />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={{ fontWeight: '700', color: Colors.primary, fontSize: 14 }}>{v.name}</Text>
                                            <Text style={{ color: '#64748b', fontSize: 12 }}>{v.email}</Text>
                                        </View>
                                        <ChevronRight size={16} color={Colors.secondary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </Animated.View>
                    )}
                    {/* ── Community Reviews ─────────────────────────────── */}
                    <Animated.View entering={FadeInDown.delay(500).springify()} style={{ marginBottom: 20 }}>
                        {(() => {
                            // Collect reviews: direct match, or same-title+NPO for recurring
                            const directReviews = reviews.filter(r => r.activityId === activity.id);
                            const allRelevantReviews = activity.recurrence && activity.recurrence !== 'NONE'
                                ? reviews.filter(r => {
                                    const a = activities.find(act => act.id === r.activityId);
                                    return a && a.npoId === activity.npoId && a.title === activity.title;
                                })
                                : directReviews;

                            const last5 = [...allRelevantReviews]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .slice(0, 5);

                            const avgStars = last5.length > 0
                                ? (last5.reduce((sum, r) => sum + r.stars, 0) / last5.length)
                                : null;

                            return (
                                <>
                                    {/* Section header */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: Colors.primary }}>Cosa ne pensa la Community</Text>
                                        {avgStars !== null && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#fde68a' }}>
                                                <Star size={13} color="#f59e0b" fill="#f59e0b" />
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400e' }}>
                                                    {avgStars.toFixed(1)} / 5
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {last5.length === 0 ? (
                                        /* No reviews yet – CTA to NPO profile */
                                        <TouchableOpacity
                                            onPress={() => router.push(`/npo-profile/${activity.npoId}?tab=recensioni` as any)}
                                            activeOpacity={0.8}
                                            style={{
                                                backgroundColor: '#f8fafc',
                                                borderRadius: 20, padding: 20,
                                                borderWidth: 1, borderColor: '#e2e8f0',
                                                borderStyle: 'dashed',
                                                alignItems: 'center', gap: 10
                                            }}
                                        >
                                            <MessageSquare size={32} color="#cbd5e1" />
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748b', textAlign: 'center' }}>
                                                {activity.recurrence && activity.recurrence !== 'NONE'
                                                    ? "Questa è la prima occorrenza dell'attività, ancora nessuna recensione."
                                                    : "Questa attività non è ancora stata recensita."}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Leggi le recensioni generali della NPO organizzatrice</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.accent }}>Vedi recensioni NPO</Text>
                                                <ChevronRight size={14} color={Colors.accent} />
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <>
                                            {/* Horizontal review cards */}
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                contentContainerStyle={{ paddingBottom: 8, gap: 12 }}
                                                style={{ marginHorizontal: -20 }}
                                                contentInset={{ left: 20, right: 20 }}
                                                contentOffset={{ x: -20, y: 0 }}
                                            >
                                                <View style={{ width: 20 }} />
                                                {last5.map(review => {
                                                    const reviewer = users.find(u => u.id === review.volunteerId);
                                                    return (
                                                        <View
                                                            key={review.id}
                                                            style={{
                                                                width: SCREEN_W * 0.78,
                                                                backgroundColor: 'white',
                                                                borderRadius: 20,
                                                                padding: 18,
                                                                borderWidth: 1,
                                                                borderColor: '#e2e8f0',
                                                                shadowColor: '#000',
                                                                shadowOpacity: 0.04,
                                                                shadowRadius: 8,
                                                                elevation: 2,
                                                            }}
                                                        >
                                                            {/* Reviewer info */}
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                                                    {reviewer?.avatar
                                                                        ? <Image source={{ uri: reviewer.avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} />
                                                                        : <Users size={18} color={Colors.primary} />
                                                                    }
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={{ fontWeight: '800', color: Colors.primary, fontSize: 14 }}>
                                                                        {reviewer?.name || 'Volontario'}
                                                                    </Text>
                                                                    <Text style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.3 }}>Volontario</Text>
                                                                </View>
                                                                {/* Stars */}
                                                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                                                    {[1, 2, 3, 4, 5].map(i => (
                                                                        <Star key={i} size={13}
                                                                            color={i <= review.stars ? '#f59e0b' : '#e2e8f0'}
                                                                            fill={i <= review.stars ? '#f59e0b' : '#e2e8f0'}
                                                                        />
                                                                    ))}
                                                                </View>
                                                            </View>
                                                            {/* Comment */}
                                                            <Text style={{ fontSize: 14, color: '#475569', lineHeight: 21, fontStyle: 'italic', marginBottom: 12 }}
                                                                numberOfLines={4}
                                                            >
                                                                &quot;{review.comment}&quot;
                                                            </Text>
                                                            {/* Date */}
                                                            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600', textAlign: 'right' }}>
                                                                {new Date(review.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                                <View style={{ width: 20 }} />
                                            </ScrollView>

                                            {/* Link to NPO full reviews */}
                                            <TouchableOpacity
                                                onPress={() => router.push(`/npo-profile/${activity.npoId}?tab=recensioni` as any)}
                                                activeOpacity={0.7}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 14 }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.accent }}>Tutte le recensioni della NPO</Text>
                                                <ChevronRight size={15} color={Colors.accent} />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </Animated.View>

                </View>
            </ScrollView>

            {/* ── Sticky Top Header ────────────────────────────────────── */}
            <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ArrowLeft size={20} color="white" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Share2 size={20} color="white" />
                        </TouchableOpacity>
                        {isOwner && (
                            <TouchableOpacity
                                onPress={() => router.push(`/(npo)/edit-activity/${activity.id}` as any)}
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}
                            >
                                <Pencil size={18} color={Colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>

            {/* ── Bottom Action Bar ─────────────────────────────────────── */}
            <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: 'white', paddingTop: 14, paddingBottom: 28, paddingHorizontal: 20,
                borderTopWidth: 1, borderTopColor: '#f1f5f9',
                shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.primary }}>
                        {activity.status === 'COMPLETATA' ? '0 posti' : `${slotsLeft} posti`}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 1 }}>
                        SU {activity.slots} VOLONTARI TOTALI
                    </Text>
                </View>

                {/* CTA Button */}
                {isOwner ? (
                    activity.status === 'COMPLETATA' ? (
                        <TouchableOpacity
                            onPress={() => router.push(`/(npo)/review-volunteers/${activity.id}` as any)}
                            style={{ backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>Gestisci</Text>
                            <ChevronRight size={18} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28, alignItems: 'center' }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 13 }}>Disponibile a fine attività</Text>
                        </View>
                    )
                ) : isOtherNPO ? (
                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 22, paddingVertical: 16, borderRadius: 28 }}>
                        <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 15 }}>Solo volontari</Text>
                    </View>
                ) : isEnrolled ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={async () => {
                                const prev = localIscrittiOverride;
                                setLocalIscrittiOverride(c => (c ?? activity.iscritti).filter(i => i !== user?.id));
                                try { await unenrollFromActivity(activity.id); }
                                catch { setLocalIscrittiOverride(prev); }
                            }}
                            style={{ backgroundColor: '#fff0f0', paddingHorizontal: 18, paddingVertical: 16, borderRadius: 28, borderWidth: 1, borderColor: '#fecaca' }}
                        >
                            <Text style={{ color: '#dc2626', fontWeight: '700' }}>Annulla</Text>
                        </TouchableOpacity>
                        <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 18, paddingVertical: 16, borderRadius: 28, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={16} color="#16a34a" fill="#16a34a" />
                            <Text style={{ color: '#16a34a', fontWeight: '800' }}>Iscritto</Text>
                        </View>
                    </View>
                ) : canLeaveReview ? (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(volunteer)/review-application', params: { activityId: activity.id, type: 'FEEDBACK' } } as any)}
                        style={{ backgroundColor: Colors.accent, paddingHorizontal: 22, paddingVertical: 16, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                        <Star size={16} color="white" />
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>Lascia feedback</Text>
                    </TouchableOpacity>
                ) : user?.role === 'VOLUNTEER' ? (
                    <TouchableOpacity
                        onPress={() => !isFull && activity.status !== 'COMPLETATA' && router.push({ pathname: "/(volunteer)/review-application", params: { activityId: activity.id, type: "ACTIVITY" } } as any)}
                        disabled={isFull || activity.status === 'COMPLETATA'}
                        style={{
                            backgroundColor: (isFull || activity.status === 'COMPLETATA') ? '#e2e8f0' : Colors.accent,
                            paddingHorizontal: 26, paddingVertical: 16, borderRadius: 28,
                            flexDirection: 'row', alignItems: 'center', gap: 8
                        }}
                    >
                        <Text style={{ color: (isFull || activity.status === 'COMPLETATA') ? '#94a3b8' : 'white', fontWeight: '900', fontSize: 16 }}>
                            {isFull ? 'Pieno' : activity.status === 'COMPLETATA' ? 'Chiusa' : 'Candidati Ora'}
                        </Text>
                        {!isFull && activity.status !== 'COMPLETATA' && <ChevronRight size={18} color="white" />}
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}
