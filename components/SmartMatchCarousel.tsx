import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, MapPin, Calendar, ChevronRight, Zap, Heart, Bookmark, EyeOff, Flame, RefreshCw } from 'lucide-react-native';
import { OldSmartMatchResult } from '../types';
import { GemmaAvatar } from './GemmaAvatar';
import { useAuth } from '../context/AuthContext';
import { useSmartMatchView } from '../hooks/smart-match/useSmartMatchView';
import { colors } from "@/theme";

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <View
            style={{
                width: 300,
                marginRight: 16,
                backgroundColor: '#f1f5f9',
                borderRadius: 24,
                padding: 20,
                overflow: 'hidden',
            }}
        >
            {/* Badge skeleton */}
            <View style={{ width: 90, height: 20, backgroundColor: '#e2e8f0', borderRadius: 999, marginBottom: 16 }} />
            {/* Title skeleton */}
            <View style={{ width: '85%', height: 18, backgroundColor: '#e2e8f0', borderRadius: 8, marginBottom: 8 }} />
            <View style={{ width: '60%', height: 18, backgroundColor: '#e2e8f0', borderRadius: 8, marginBottom: 16 }} />
            {/* Meta skeleton */}
            <View style={{ width: '70%', height: 12, backgroundColor: '#e2e8f0', borderRadius: 6, marginBottom: 6 }} />
            <View style={{ width: '55%', height: 12, backgroundColor: '#e2e8f0', borderRadius: 6, marginBottom: 16 }} />
            {/* Reason badge skeleton */}
            <View style={{ width: '95%', height: 32, backgroundColor: '#e2e8f0', borderRadius: 12 }} />
        </View>
    );
}

function MatchCard({
    match,
    index,
    onSave,
    onHide,
    onLike,
    onSeen,
}: {
    match: OldSmartMatchResult;
    index: number;
    onSave: (match: OldSmartMatchResult) => Promise<unknown>;
    onHide: (match: OldSmartMatchResult) => Promise<unknown>;
    onLike: (match: OldSmartMatchResult) => Promise<unknown>;
    onSeen: (match: OldSmartMatchResult) => Promise<unknown>;
}) {
    const router = useRouter();
    const activity = match.activity;
    if (!activity) return null;

    const dateObj = new Date(activity.dateTime);
    const dateStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    const timeStr = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Score color gradient
    const scoreColor =
        match.score >= 85
            ? '#cd057f' // accent pink
            : match.score >= 70
                ? '#7c3aed' // violet
                : '#2563eb'; // blue

    const isTopMatch = index === 0 || match.confidence === 'top';
    const onOpen = async () => {
        await onSeen(match);
        router.push(`/activity/${activity.id}` as any);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onOpen}
            style={{
                width: 300,
                marginRight: 16,
                backgroundColor: isTopMatch ? colors.primary : '#ffffff',
                borderRadius: 24,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isTopMatch ? 0.18 : 0.08,
                shadowRadius: 12,
                elevation: isTopMatch ? 8 : 3,
                borderWidth: isTopMatch ? 0 : 1,
                borderColor: '#f1f5f9',
            }}
        >
            {/* Score Badge */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    backgroundColor: isTopMatch ? 'rgba(255,255,255,0.15)' : `${scoreColor}15`,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    marginBottom: 14,
                    gap: 5,
                }}
            >
                <Sparkles size={12} color={isTopMatch ? '#ffffff' : scoreColor} />
                <Text
                    style={{
                        color: isTopMatch ? '#ffffff' : scoreColor,
                        fontSize: 12,
                        fontWeight: '800',
                    }}
                >
                    {match.score}%
                </Text>
            </View>

            {/* NPO Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text
                    style={{
                        color: isTopMatch ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        flex: 1,
                        marginRight: 8,
                    }}
                    numberOfLines={1}
                >
                    {activity.npoName}
                </Text>
                {activity.isUrgent ? (
                    <View
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isTopMatch ? 'rgba(255,255,255,0.16)' : '#fff1f2',
                        }}
                    >
                        <Flame size={14} color={isTopMatch ? '#ffffff' : '#ef4444'} />
                    </View>
                ) : null}
            </View>

            {/* OldActivity Title */}
            <Text
                style={{
                    color: isTopMatch ? '#ffffff' : colors.primary,
                    fontSize: 17,
                    fontWeight: '900',
                    lineHeight: 22,
                    marginBottom: 12,
                }}
                numberOfLines={2}
            >
                {activity.title}
            </Text>

            {/* Date & Location */}
            <View style={{ gap: 5, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Calendar size={13} color={isTopMatch ? 'rgba(255,255,255,0.7)' : colors.textSecondary} />
                    <Text
                        style={{
                            color: isTopMatch ? 'rgba(255,255,255,0.75)' : colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '600',
                        }}
                    >
                        {dateStr} · {timeStr}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MapPin size={13} color={isTopMatch ? 'rgba(255,255,255,0.7)' : colors.textSecondary} />
                    <Text
                        style={{
                            color: isTopMatch ? 'rgba(255,255,255,0.75)' : colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '600',
                        }}
                        numberOfLines={1}
                    >
                        {activity.location.address}
                    </Text>
                </View>
            </View>

            {/* Compact Gemma cue */}
            <View
                style={{
                    backgroundColor: isTopMatch ? 'rgba(255,255,255,0.12)' : '#f8f4ff',
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    borderWidth: isTopMatch ? 1 : 0,
                    borderColor: 'rgba(255,255,255,0.2)',
                    justifyContent: 'space-between',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <GemmaAvatar size={20} />
                    <Text
                        style={{
                            color: isTopMatch ? 'rgba(255,255,255,0.9)' : colors.primary,
                            fontSize: 11,
                            fontWeight: '700',
                        }}
                    >
                        {match.confidenceLabel || 'Consiglio di Gemma'}
                    </Text>
                </View>
                <ChevronRight size={14} color={isTopMatch ? 'rgba(255,255,255,0.7)' : colors.accent} />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                    onPress={(event) => {
                        event.stopPropagation();
                        onLike(match);
                    }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: isTopMatch ? 'rgba(255,255,255,0.14)' : '#fff1f7',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                    }}
                >
                    <Heart size={13} color={isTopMatch ? '#ffffff' : colors.accent} fill={match.liked ? (isTopMatch ? '#ffffff' : colors.accent) : 'transparent'} />
                    <Text style={{ color: isTopMatch ? '#ffffff' : colors.accent, fontSize: 11, fontWeight: '700' }}>Mi piace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={(event) => {
                        event.stopPropagation();
                        onSave(match);
                    }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: isTopMatch ? 'rgba(255,255,255,0.14)' : '#eef2ff',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                    }}
                >
                    <Bookmark size={13} color={isTopMatch ? '#ffffff' : colors.info} fill={match.saved ? (isTopMatch ? '#ffffff' : colors.info) : 'transparent'} />
                    <Text style={{ color: isTopMatch ? '#ffffff' : colors.info, fontSize: 11, fontWeight: '700' }}>Salva</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={(event) => {
                        event.stopPropagation();
                        onHide(match);
                    }}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: isTopMatch ? 'rgba(255,255,255,0.14)' : '#f8fafc',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                    }}
                >
                    <EyeOff size={13} color={isTopMatch ? '#ffffff' : colors.textSecondary} />
                    <Text style={{ color: isTopMatch ? '#ffffff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>Nascondi</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

export function SmartMatchCarousel() {
    const { user } = useAuth();
    const { matches, isLoading, error, refresh, lastUpdated, resetHiddenMatches, saveMatch, hideMatch, likeMatch, markMatchSeen } = useSmartMatchView(user);
    const router = useRouter();
    const [activeIndex, setActiveIndex] = React.useState(0);

    const handleScroll = (event: any) => {
        const x = event.nativeEvent.contentOffset.x;
        const index = Math.round(x / 316); // card width (300) + gap (16)
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    // Sort by score DESC and limit to 5
    const displayedMatches = React.useMemo(() => {
        return [...matches]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }, [matches]);

    // Header row
    const Header = (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <GemmaAvatar size={30} />
                <View>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: colors.primary }}>
                        Consigliato per te
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500' }}>
                        Proposta AI con Gemma
                    </Text>
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {lastUpdated && (
                    <TouchableOpacity onPress={() => void refresh()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <RefreshCw size={16} color={colors.accent} strokeWidth={2.2} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => router.push('/(volunteer)/smart-match' as any)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                        Vedi tutti
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Loading skeleton
    if (isLoading) {
        return (
            <View style={{ marginBottom: 32 }}>
                {Header}
                {/* Thinking indicator */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                        backgroundColor: '#fdf4ff',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignSelf: 'flex-start',
                    }}
                >
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>
                        Gemma sta analizzando il tuo profilo…
                    </Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -24 }}
                    contentContainerStyle={{ paddingHorizontal: 24 }}
                >
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </ScrollView>
            </View>
        );
    }

    // Daily quota exhausted — show informational state only when there are no fallback matches.
    if (error === 'quota_daily' && matches.length === 0) {
        return (
            <View style={{ marginBottom: 32 }}>
                {Header}
                <View
                    style={{
                        backgroundColor: '#fdf4ff',
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: `${colors.accent}30`,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: `${colors.accent}15`,
                            borderRadius: 12,
                            padding: 10,
                        }}
                    >
                        <Zap size={20} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700', marginBottom: 3 }}>
                            Quota AI esaurita per oggi
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                            I suggerimenti Gemma si ricaricano ogni 24h. Ricontrolla domani! ✨
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    // Generic error state
    if (error && matches.length === 0) {
        return (
            <View style={{ marginBottom: 32 }}>
                {Header}
                <TouchableOpacity
                    onPress={() => void refresh()}
                    style={{
                        backgroundColor: '#fff8f8',
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: '#fecaca',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: '700' }}>
                        Impossibile caricare i suggerimenti
                    </Text>
                    <Text style={{ fontSize: 12, color: '#f87171', fontWeight: '500' }}>
                        Tocca per riprovare
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Empty state
    if (matches.length === 0) {
        return (
            <View style={{ marginBottom: 32 }}>
                {Header}
                <View
                    style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: 16,
                        padding: 20,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        gap: 6,
                    }}
                >
                    <Sparkles size={28} color={colors.accent} />
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700' }}>
                        Nessun suggerimento disponibile
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                        Aggiorna il tuo profilo con bio e interessi per ricevere match personalizzati.
                    </Text>
                    <TouchableOpacity onPress={() => void resetHiddenMatches()} style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>
                            Ripristina attività nascoste
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Main carousel
    return (
        <View style={{ marginBottom: 32 }}>
            {Header}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={316} // card width + gap
                snapToAlignment="start"
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={16}
                style={{ marginHorizontal: -24 }}
                contentContainerStyle={{ paddingHorizontal: 24 }}
            >
                {displayedMatches.map((match, i) => (
                    <MatchCard
                        key={match.id}
                        match={match}
                        index={i}
                        onSave={saveMatch}
                        onHide={hideMatch}
                        onLike={likeMatch}
                        onSeen={markMatchSeen}
                    />
                ))}
            </ScrollView>
            {/* Dot indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 }}>
                {displayedMatches.map((_, i) => (
                    <View
                        key={i}
                        style={{
                            width: i === activeIndex ? 16 : 6,
                            height: 6,
                            borderRadius: 999,
                            backgroundColor: i === activeIndex ? colors.accent : '#e2e8f0',
                        }}
                    />
                ))}
            </View>
        </View>
    );
}
