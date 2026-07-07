import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Calendar, Zap, Heart, Bookmark, EyeOff, Flame, RefreshCw } from 'lucide-react-native';
import { OldSmartMatchResult } from '../types';
import { GemmaAvatar } from './GemmaAvatar';
import { useAuth } from '../context/AuthContext';
import { useSmartMatchView } from '../hooks/smart-match/useSmartMatchView';
import { colors } from "@/theme";

// Card sizing shared between the skeleton, the card itself and the carousel scroll math.
const CARD_WIDTH = 168;
const CARD_GAP = 12;
const CARD_SNAP_INTERVAL = CARD_WIDTH + CARD_GAP; // 180

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <View
            style={{
                width: CARD_WIDTH,
                marginRight: CARD_GAP,
                borderRadius: 20,
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#f1f5f9',
                overflow: 'hidden',
            }}
        >
            {/* Banner skeleton */}
            <View style={{ width: '100%', height: 50, backgroundColor: '#e2e8f0' }} />
            <View style={{ padding: 12 }}>
                {/* Reason tag skeleton */}
                <View style={{ width: '60%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
                {/* Title skeleton */}
                <View style={{ width: '90%', height: 12, backgroundColor: '#e2e8f0', borderRadius: 6, marginBottom: 6 }} />
                <View style={{ width: '70%', height: 12, backgroundColor: '#e2e8f0', borderRadius: 6, marginBottom: 10 }} />
                {/* Meta skeleton */}
                <View style={{ width: '50%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginBottom: 12 }} />
                {/* Actions skeleton */}
                <View style={{ width: '100%', height: 28, backgroundColor: '#e2e8f0', borderRadius: 14 }} />
            </View>
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
                width: CARD_WIDTH,
                marginRight: CARD_GAP,
                borderRadius: 20,
                backgroundColor: '#ffffff',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isTopMatch ? 0.16 : 0.08,
                shadowRadius: 10,
                elevation: isTopMatch ? 6 : 3,
            }}
        >
            <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
                {/* Top gradient banner */}
                <View style={{ position: 'relative' }}>
                    <LinearGradient
                        colors={isTopMatch ? [colors.primary, colors.accent] : ['#7c3aed', '#a78bfa']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: '100%', height: 50 }}
                    />
                    {activity.isUrgent ? (
                        <View
                            style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255,255,255,0.25)',
                            }}
                        >
                            <Flame size={12} color="#ffffff" />
                        </View>
                    ) : null}
                    {/* Floating score badge */}
                    <View
                        style={{
                            position: 'absolute',
                            bottom: -10,
                            right: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: '#ffffff',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 3,
                        }}
                    >
                        <Sparkles size={10} color={scoreColor} />
                        <Text style={{ color: scoreColor, fontSize: 11, fontWeight: '800' }}>
                            {match.score}%
                        </Text>
                    </View>
                </View>

                {/* Card body */}
                <View style={{ padding: 12, paddingTop: 16 }}>
                    {/* Reason tag */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                        <GemmaAvatar size={14} />
                        <Text
                            style={{
                                color: colors.primary,
                                fontSize: 9,
                                fontWeight: '800',
                                letterSpacing: 0.3,
                                textTransform: 'uppercase',
                                flex: 1,
                            }}
                            numberOfLines={1}
                        >
                            {match.confidenceLabel || 'Consiglio di Gemma'}
                        </Text>
                    </View>

                    {/* OldActivity Title */}
                    <Text
                        style={{
                            color: colors.primary,
                            fontSize: 13,
                            fontWeight: '800',
                            lineHeight: 16,
                            marginBottom: 8,
                        }}
                        numberOfLines={2}
                    >
                        {activity.title}
                    </Text>

                    {/* Date */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                        <Calendar size={10} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600' }}>
                            {dateStr} · {timeStr}
                        </Text>
                    </View>

                    {/* Actions + CTA */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onLike(match);
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#fff1f7',
                                }}
                            >
                                <Heart size={14} color={colors.accent} fill={match.liked ? colors.accent : 'transparent'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onSave(match);
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#eef2ff',
                                }}
                            >
                                <Bookmark size={14} color={colors.info} fill={match.saved ? colors.info : 'transparent'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onHide(match);
                                }}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#f8fafc',
                                }}
                            >
                                <EyeOff size={14} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                            Scopri →
                        </Text>
                    </View>
                </View>
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
        const index = Math.round(x / CARD_SNAP_INTERVAL); // card width + gap
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
                snapToInterval={CARD_SNAP_INTERVAL} // card width + gap
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
