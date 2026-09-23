import {
    View, Text, TextInput, TouchableOpacity, Image, RefreshControl,
    ActivityIndicator, ScrollView, Modal, Platform, Share, StyleSheet
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useState, useEffect, useRef, useMemo } from "react";
import {
    Search, MapPin, Calendar, X, Map as MapIcon,
    Heart, ChevronDown, CheckCircle2, Share2, Sparkles, Zap, Bookmark, EyeOff
} from "lucide-react-native";
import { AppActivity } from "../../../types";
import { useRouter } from "expo-router";
import { useActivities } from "../../../hooks/useActivities";
import { activityService } from "../../../services/ActivityService";
import { supabase } from "../../../utils/supabase";
import { UserAvatar } from "../../../components/UserAvatar";
import { StandardLayout } from "../../../components/StandardLayout";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { EmptyState } from "../../../components/EmptyState";
import { useToast } from "../../../context/ToastContext";
import { CalendarPicker } from "../../../components/CalendarPicker";
import { useAuth } from "../../../context/AuthContext";
import { INTERESTS } from "../../../constants/Interests";
import { useSmartMatchActivityScoresView, useSmartMatchView } from "../../../hooks/smart-match/useSmartMatchView";

import { SKILLS } from "../../../constants/Skills";
import { colors, radius, spacing, fontWeight, shadows, typography, withAlpha } from "@/theme";
import { StatusPill } from "../../../components/ui";

const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

interface FilterState {
    interests: string[];
    skills: string[];
    onlyAvailable: boolean;
    onlyUrgent: boolean;
    dateFrom: string;
    dateTo: string;
    radiusKm: number;
}

const DEFAULT_FILTERS: FilterState = {
    interests: [],
    skills: [],
    onlyAvailable: false,
    onlyUrgent: false,
    dateFrom: '',
    dateTo: '',
    radiusKm: 20,
};

// ─── Nominatim helper ─────────────────────────────────────────────────────────
async function fetchNominatim(text: string): Promise<{ id: number; label: string; lat: number; lng: number }[]> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=it`,
            { headers: { 'User-Agent': 'AiutarSiApp/1.0' } }
        );
        const data = await res.json();
        return data.map((item: any) => ({
            id: item.place_id,
            label: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
        }));
    } catch { return []; }
}

// ─── Full Filter Modal ────────────────────────────────────────────────────────
function FilterModal({
    visible,
    pendingFilters,
    setPendingFilters,
    onClose,
    onApply,
}: {
    visible: boolean;
    pendingFilters: FilterState;
    setPendingFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void;
    onClose: () => void;
    onApply: () => void;
}) {
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <View style={{
                    backgroundColor: 'white',
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    maxHeight: '88%',
                    paddingBottom: Platform.OS === 'ios' ? 34 : 24
                }}>
                    <View style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
                    }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e1b4b' }}>Filtra Attività</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={() => setPendingFilters(DEFAULT_FILTERS)}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose}>
                                <X size={22} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 24 }}>
                        {/* Raggio */}
                        <View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b' }}>Raggio d&apos;azione</Text>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>Entro {pendingFilters.radiusKm}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {RADIUS_OPTIONS.map(r => (
                                    <TouchableOpacity key={r}
                                        onPress={() => setPendingFilters(f => ({ ...f, radiusKm: r }))}
                                        style={{
                                            paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99,
                                            backgroundColor: pendingFilters.radiusKm === r ? colors.primary : '#f1f5f9',
                                        }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: pendingFilters.radiusKm === r ? 'white' : '#64748b' }}>{r} km</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Data */}
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Data (da)</Text>
                            <TextInput
                                value={pendingFilters.dateFrom}
                                onChangeText={v => setPendingFilters(f => ({ ...f, dateFrom: v }))}
                                placeholder="AAAA-MM-GG (es. 2025-03-01)"
                                placeholderTextColor="#94a3b8"
                                style={{
                                    backgroundColor: '#f8f9ff', borderRadius: 14, paddingHorizontal: 16,
                                    paddingVertical: 12, fontSize: 14, fontWeight: '600', color: '#1e1b4b',
                                    borderWidth: 1, borderColor: '#e2e8f0',
                                }}
                            />
                        </View>

                        {/* Opzioni */}
                        <View style={{ gap: 10 }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 2 }}>Opzioni</Text>
                            <TouchableOpacity
                                onPress={() => setPendingFilters(f => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    backgroundColor: pendingFilters.onlyAvailable ? `${colors.primary}10` : '#f8f9ff',
                                    padding: 14, borderRadius: 16,
                                    borderWidth: 1.5, borderColor: pendingFilters.onlyAvailable ? colors.primary : '#e2e8f0',
                                }}>
                                <CheckCircle2 size={22} color={pendingFilters.onlyAvailable ? colors.primary : '#94a3b8'} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '800', fontSize: 14, color: '#1e1b4b' }}>Solo con posti disponibili</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }}>Mostra solo attività con slot liberi</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setPendingFilters(f => ({ ...f, onlyUrgent: !f.onlyUrgent }))}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    backgroundColor: pendingFilters.onlyUrgent ? `${colors.accent}10` : '#f8f9ff',
                                    padding: 14, borderRadius: 16,
                                    borderWidth: 1.5, borderColor: pendingFilters.onlyUrgent ? colors.accent : '#e2e8f0',
                                }}>
                                <Zap size={22} color={pendingFilters.onlyUrgent ? colors.accent : '#94a3b8'} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '800', fontSize: 14, color: '#1e1b4b' }}>Solo urgenti</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }}>Mostra solo attività marcate come urgenti</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Interessi */}
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Categoria / Interessi</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {INTERESTS.map(item => {
                                    const isSelected = pendingFilters.interests.includes(item.label);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity key={item.id}
                                            onPress={() => setPendingFilters(f => ({
                                                ...f,
                                                interests: isSelected ? f.interests.filter(i => i !== item.label) : [...f.interests, item.label]
                                            }))}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 6,
                                                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99,
                                                backgroundColor: isSelected ? colors.primary : '#f1f5f9',
                                            }}>
                                            <Icon size={13} color={isSelected ? 'white' : '#64748b'} />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? 'white' : '#64748b' }}>{item.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Competenze */}
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Competenze richieste</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {SKILLS.map(item => {
                                    const isSelected = pendingFilters.skills.includes(item.id);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity key={item.id}
                                            onPress={() => setPendingFilters(f => ({
                                                ...f,
                                                skills: isSelected ? f.skills.filter(s => s !== item.id) : [...f.skills, item.id]
                                            }))}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 6,
                                                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99,
                                                backgroundColor: isSelected ? colors.accent : '#f1f5f9',
                                            }}>
                                            <Icon size={13} color={isSelected ? 'white' : '#64748b'} />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? 'white' : '#64748b' }}>{item.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                        <TouchableOpacity
                            onPress={onApply}
                            style={{ backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Applica Filtri</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Card attività: stili token-based (vertical slice di migrazione al design
// system, vedi docs/design-system.md — sostituisce colori hex e className ad hoc
// usati prima in questa card con i token esistenti in theme/). Il resto della
// schermata (ricerca, filtri, mappa) resta con lo stile legacy esistente: non è
// nello scope di questa slice. ──────────────────────────────────────────────
const cardStyles = StyleSheet.create({
    topSectionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: withAlpha(colors.accent, 0.06),
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: withAlpha(colors.accent, 0.18),
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
    },
    topSectionTitle: {
        ...typography.label,
        color: colors.accent,
        textTransform: 'uppercase',
    },
    topSectionSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.borderMuted,
    },
    dividerLabel: {
        ...typography.overline,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    card: {
        width: '100%',
        backgroundColor: colors.white,
        borderRadius: radius.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderMuted,
        ...shadows.card(),
    },
    cardExpanded: {
        ...shadows.floating(),
    },
    imageWrap: {
        width: '100%',
        backgroundColor: colors.surfaceMuted,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 96,
        backgroundColor: withAlpha(colors.black, 0.3),
    },
    topLeftBadges: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: spacing.sm,
        zIndex: 20,
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
    },
    matchBadgeText: {
        ...typography.caption,
        color: colors.white,
        fontWeight: fontWeight.extrabold,
        textTransform: 'uppercase',
    },
    heartButton: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        backgroundColor: withAlpha(colors.black, 0.2),
        padding: spacing.sm,
        borderRadius: radius.circle,
        zIndex: 20,
    },
    content: {
        padding: spacing.lg,
    },
    title: {
        ...typography.cardTitle,
        color: colors.text,
        marginBottom: spacing['2xs'],
    },
    npoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    npoName: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: fontWeight.bold,
    },
    metaGroup: {
        gap: spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    metaText: {
        ...typography.caption,
        color: colors.textMuted,
        flex: 1,
    },
    expandedSection: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderMuted,
        gap: spacing.md,
    },
    reasonBox: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    reasonBoxTop: {
        backgroundColor: withAlpha(colors.accent, 0.06),
        borderColor: withAlpha(colors.accent, 0.18),
    },
    reasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    reasonLabel: {
        ...typography.label,
    },
    reasonText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    description: {
        ...typography.caption,
        color: colors.textMuted,
        lineHeight: 18,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    detailsButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: radius.xl,
        alignItems: 'center',
        ...shadows.card(),
    },
    detailsButtonText: {
        ...typography.bodySmall,
        color: colors.white,
        fontWeight: fontWeight.black,
    },
    iconButton: {
        backgroundColor: colors.surfaceSubtle,
        padding: spacing.md,
        borderRadius: radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

// ─── Esplora (Search) Screen ──────────────────────────────────────────────────
export default function SearchScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { likeMatch, saveMatch, hideMatch, markMatchSeen } = useSmartMatchView(user);

    // Search state
    const [searchText, setSearchText] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    // Geo-center set when user picks a "Luogo" suggestion
    const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label: string } | null>(null);
    // Categorized search suggestions
    const [suggestedActivities, setSuggestedActivities] = useState<AppActivity[]>([]);
    const [suggestedNpos, setSuggestedNpos] = useState<{ id: string; name: string }[]>([]);
    const [suggestedPlaces, setSuggestedPlaces] = useState<{ id: number; label: string; lat: number; lng: number }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [refreshing, setRefreshing] = useState(false);

    // Filter state
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Date picker visibility (for quick Date chip)
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ── React Query: fetch activities whenever filters change ─────────────────
    // No manual useEffect needed — queryKey change triggers refetch automatically.
    const {
        activities: paginatedActivities,
        hasNextPage: hasMore,
        isFetchingNextPage: isLoadingMore,
        isFetching: isLoadingActivities,
        isLoading,
        fetchNextPage,
        refetch,
    } = useActivities({
        category: filters.interests.length === 1 ? filters.interests[0] : undefined,
        searchText: debouncedSearch,
        skills: filters.skills.length > 0 ? filters.skills : undefined,
        onlyUrgent: filters.onlyUrgent || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        centerLat: searchCenter?.lat,
        centerLng: searchCenter?.lng,
        radiusKm: searchCenter ? filters.radiusKm : undefined,
        statuses: ['APERTA', 'IN_CORSO'],
    });

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Nominatim + activities + NPOs lookup for categorized suggestions
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (searchText.length < 2) {
            setSuggestedActivities([]);
            setSuggestedNpos([]);
            setSuggestedPlaces([]);
            return;
        }
        searchTimer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const [actResults, npoRows, placeResults] = await Promise.all([
                    // Activities matching the query
                    activityService.getActivities({ searchText: searchText.trim(), limit: 3, offset: 0 })
                        .then(r => r.activities.slice(0, 3)),
                    // NPOs — search profiles with role=NPO
                    supabase
                        .from('profiles')
                        .select('id, npo_name, full_name, avatar_url, is_verified, verification_status')
                        .eq('role', 'NPO')
                        .or(`npo_name.ilike.%${searchText.trim()}%,full_name.ilike.%${searchText.trim()}%`)
                        .limit(3)
                        .then(({ data }) => (data || []).map((r: any) => ({ 
                            id: r.id, 
                            name: r.npo_name || r.full_name || '', 
                            avatarUrl: r.avatar_url,
                            is_verified: r.is_verified,
                            verification_status: r.verification_status
                        }))),
                    // Places from Nominatim
                    fetchNominatim(searchText),
                ]);
                setSuggestedActivities(actResults);
                setSuggestedNpos(npoRows);
                setSuggestedPlaces(placeResults.slice(0, 3));
            } catch { /* silently fail */ } finally {
                setSearchLoading(false);
            }
        }, 500);
    }, [searchText]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        showToast('success', 'Risultati aggiornati!');
        setRefreshing(false);
    };

    const openFilters = () => { setPendingFilters(filters); setIsFilterModalVisible(true); };
    const applyFilters = () => { setFilters(pendingFilters); setIsFilterModalVisible(false); };

    // Base order remains chronological; top AI matches are lifted above it.
    const sortedActivities = useMemo(
        () => [...paginatedActivities].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
        [paginatedActivities]
    );
    const { scoreMap: smartMatchMap } = useSmartMatchActivityScoresView(user, sortedActivities, {
        enabled: sortedActivities.length > 0,
    });
    const topMatchActivities = useMemo(() => {
        return sortedActivities
            .filter((activity) => {
                const match = smartMatchMap.get(activity.id);
                const score = typeof match?.score === 'number' ? match.score : 0;
                return match?.confidence === 'top' || score >= 75;
            })
            .sort((a, b) => {
                const scoreDiff =
                    ((smartMatchMap.get(b.id)?.score ?? 0) -
                        (smartMatchMap.get(a.id)?.score ?? 0));
                if (scoreDiff !== 0) return scoreDiff;
                return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
            })
            .slice(0, 4);
    }, [smartMatchMap, sortedActivities]);
    const topMatchIds = useMemo(() => new Set(topMatchActivities.map((activity) => activity.id)), [topMatchActivities]);
    const listActivities = useMemo(() => {
        if (!topMatchActivities.length) return sortedActivities;
        return [
            ...topMatchActivities,
            ...sortedActivities.filter((activity) => !topMatchIds.has(activity.id)),
        ];
    }, [sortedActivities, topMatchActivities, topMatchIds]);

    const getCategoryColors = (cat?: string) => {
        switch ((cat || '').toUpperCase()) {
            case 'AMBIENTE': return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
            case 'SOCIALE': return { bg: 'bg-blue-100', text: 'text-blue-700' };
            case 'ANIMALI': return { bg: 'bg-orange-100', text: 'text-orange-700' };
            case 'SALUTE': return { bg: 'bg-rose-100', text: 'text-rose-700' };
            case 'EDUCAZIONE': return { bg: 'bg-purple-100', text: 'text-purple-700' };
            case 'ARTE & CULTURA': return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
            default: return { bg: 'bg-slate-100', text: 'text-slate-700' };
        }
    };

    const renderActivityItem = ({ item, index }: { item: AppActivity; index: number }) => {
        const isExpanded = expandedId === item.id;
        const isFocusedMode = expandedId !== null;
        const isDimmed = isFocusedMode && !isExpanded;
        const catColors = getCategoryColors(item.category);
        // Fonte unica del match per questa card: lo stesso oggetto alimenta punteggio,
        // etichetta, motivazione, chip e le azioni sotto (like/salva/nascondi) — prima
        // le azioni leggevano da un secondo dataset (le "top 15" vicine) che non conteneva
        // sempre l'attivita' corrente: il tap su cuore/salva/nascondi non faceva nulla per
        // molte card. aiMatch esiste invece per ogni attivita' visibile in Esplora.
        const aiMatch = smartMatchMap.get(item.id);
        const displayScore = typeof aiMatch?.score === 'number' ? aiMatch.score : 0;
        const displayBadge = aiMatch?.confidenceLabel || 'Gemma';
        const aiChips = aiMatch?.chips?.slice(0, 3) || [];
        const isTopGemma = aiMatch?.confidence === 'top';
        const isEnrolled = !!user?.id && item.iscritti.includes(user.id);
        const isInTopSection = topMatchIds.has(item.id);
        const previousItem = index > 0 ? listActivities[index - 1] : null;
        const showTopSectionHeader = isInTopSection && index === 0;
        const showAllActivitiesHeader = !isInTopSection && !!topMatchActivities.length && !!previousItem && topMatchIds.has(previousItem.id);

        return (
            <View>
                {showTopSectionHeader && (
                    <View style={cardStyles.topSectionBanner}>
                        <Sparkles size={15} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                            <Text style={cardStyles.topSectionTitle}>Top match per te</Text>
                            <Text style={cardStyles.topSectionSubtitle}>Le attività con il fit migliore secondo Gemma</Text>
                        </View>
                    </View>
                )}

                {showAllActivitiesHeader && (
                    <View style={cardStyles.dividerRow}>
                        <View style={cardStyles.dividerLine} />
                        <Text style={cardStyles.dividerLabel}>Tutte le attivita</Text>
                        <View style={cardStyles.dividerLine} />
                    </View>
                )}

                <TouchableOpacity
                    onPress={() => {
                        const nextExpanded = isExpanded ? null : item.id;
                        setExpandedId(nextExpanded);
                        if (nextExpanded && aiMatch && !aiMatch.seen) {
                            void markMatchSeen(aiMatch);
                        }
                    }}
                    activeOpacity={0.9}
                    testID={`activity-card-${index}`}
                    style={{
                        opacity: isDimmed ? 0.35 : 1,
                        transform: [{ scale: isExpanded ? 1.02 : 1 }],
                        marginBottom: spacing.xl,
                    }}
                >
                    <View style={[cardStyles.card, isExpanded && cardStyles.cardExpanded]}>
                        {/* Image section */}
                        <View style={[cardStyles.imageWrap, { height: isExpanded ? 180 : 150 }]}>
                            <Image
                                source={{ uri: item.imageUrl || `https://dummyimage.com/600x300/e2e8f0/462282&text=${item.category}` }}
                                style={cardStyles.image}
                            />
                            <View style={cardStyles.imageOverlay} />

                            {/* Un solo segnale di match sull'immagine: la percentuale, leggibile
                                subito anche da chi non sa cosa sia "Gemma". L'etichetta qualitativa
                                e la motivazione compaiono solo nella vista espansa (tap sulla card),
                                cosi' lo stesso numero non viene ripetuto in piu' punti della card. */}
                            <View style={cardStyles.topLeftBadges}>
                                {displayScore > 0 && (
                                    <View style={[cardStyles.matchBadge, { backgroundColor: isTopGemma ? colors.accent : colors.primary }]}>
                                        <Sparkles size={12} color={colors.white} fill={colors.white} />
                                        <Text style={cardStyles.matchBadgeText}>{displayScore}% match</Text>
                                    </View>
                                )}
                                {item.isUrgent && <StatusPill label="Urgente" tone="danger" />}
                                {isEnrolled && <StatusPill label="Iscritto" tone="success" />}
                            </View>

                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    if (aiMatch) void likeMatch(aiMatch);
                                }}
                                style={cardStyles.heartButton}
                                accessibilityRole="button"
                                accessibilityLabel={aiMatch?.liked ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
                            >
                                <Heart size={16} color={colors.white} strokeWidth={2.5} fill={aiMatch?.liked ? colors.white : 'transparent'} />
                            </TouchableOpacity>
                        </View>

                        {/* Content section */}
                        <View style={cardStyles.content}>
                            <View className={`${catColors.bg} px-2.5 py-1 rounded-md self-start mb-3`}>
                                <Text className={`${catColors.text} text-[9px] font-black uppercase tracking-wider`}>{item.category || "CATEGORIA"}</Text>
                            </View>

                            <Text style={cardStyles.title} numberOfLines={isExpanded ? undefined : 2}>
                                {item.title}
                            </Text>

                            <View style={cardStyles.npoRow}>
                                <Text style={cardStyles.npoName}>{item.npoName}</Text>
                                {isExpanded && <CheckCircle2 size={13} color={colors.primary} strokeWidth={2.5} />}
                            </View>

                            <View style={cardStyles.metaGroup}>
                                <View style={cardStyles.metaRow}>
                                    <MapPin size={12} color={colors.textMuted} />
                                    <Text style={cardStyles.metaText} numberOfLines={1}>{item.location?.address || 'Indirizzo non specificato'}</Text>
                                </View>
                                <View style={cardStyles.metaRow}>
                                    <Calendar size={12} color={colors.textMuted} />
                                    <Text style={cardStyles.metaText}>
                                        {new Date(item.dateTime).toLocaleDateString("it-IT", { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())} • {new Date(item.dateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>

                            {/* Divulgazione progressiva: il "perche' ti consiglio questa", le chip
                                e la descrizione compaiono solo al tap. La prima impressione della
                                card resta leggibile; chi vuole approfondire apre. */}
                            {isExpanded && (
                                <View style={cardStyles.expandedSection}>
                                    {!!aiMatch?.reason && (
                                        <View style={[cardStyles.reasonBox, isTopGemma && cardStyles.reasonBoxTop]}>
                                            <View style={cardStyles.reasonHeader}>
                                                <Sparkles size={12} color={isTopGemma ? colors.accent : colors.primary} />
                                                <Text style={[cardStyles.reasonLabel, { color: isTopGemma ? colors.accent : colors.primary }]}>
                                                    {displayBadge}
                                                </Text>
                                            </View>
                                            <Text style={cardStyles.reasonText} numberOfLines={3}>{aiMatch.reason}</Text>
                                        </View>
                                    )}

                                    {!!aiChips.length && (
                                        <View style={cardStyles.chipsRow}>
                                            {aiChips.map((chip) => (
                                                <StatusPill key={`${item.id}-${chip}`} label={chip} tone="info" />
                                            ))}
                                        </View>
                                    )}

                                    <Text style={cardStyles.description} numberOfLines={3}>
                                        {item.description}
                                    </Text>

                                    <View style={cardStyles.actionsRow}>
                                        <TouchableOpacity
                                            onPress={() => router.push(`/activity/${item.id}` as any)}
                                            style={cardStyles.detailsButton}
                                        >
                                            <Text style={cardStyles.detailsButtonText}>Dettagli Attività</Text>
                                        </TouchableOpacity>
                                        {aiMatch && (
                                            <TouchableOpacity
                                                onPress={() => void saveMatch(aiMatch)}
                                                style={cardStyles.iconButton}
                                                accessibilityRole="button"
                                                accessibilityLabel={aiMatch.saved ? "Rimuovi dai salvati" : "Salva attività"}
                                            >
                                                <Bookmark size={18} color={colors.primary} fill={aiMatch.saved ? colors.primary : 'transparent'} />
                                            </TouchableOpacity>
                                        )}
                                        {aiMatch && (
                                            <TouchableOpacity
                                                onPress={() => void hideMatch(aiMatch)}
                                                style={cardStyles.iconButton}
                                                accessibilityRole="button"
                                                accessibilityLabel="Nascondi questa attività"
                                            >
                                                <EyeOff size={18} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={async () => {
                                                try {
                                                    await Share.share({
                                                        message: `👐 ${item.title}\nPartecipa a questa attività su AiutarSì!\n\n📱 Apri direttamente nell'app:\naiutarsiapp://activity/${item.id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/activity/${item.id}`,
                                                    });
                                                } catch (error) {
                                                    console.error("Error sharing:", error);
                                                }
                                            }}
                                            style={cardStyles.iconButton}
                                            accessibilityRole="button"
                                            accessibilityLabel="Condividi questa attività"
                                        >
                                            <Share2 size={18} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <StandardLayout 
            label="Scopri" 
            title="Esplora Attività" 
            rightElement={<VolunteerHeaderActions />} 
            bg="bg-background-light"
            hideBack={true}
            noScroll
        >
            {/* ── Search + Filter Box (rounded card, matches Map UI) ── */}
            <View style={{
                backgroundColor: 'white',
                borderRadius: 22,
                paddingHorizontal: 12,
                paddingVertical: 12,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.07,
                shadowRadius: 12,
                elevation: 5,
                zIndex: 50,
            }}>
                {/* Search row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#f8f9ff',
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderWidth: isSearchFocused ? 1.5 : 1,
                        borderColor: isSearchFocused ? colors.primary : '#e8eaf0',
                    }}>
                        <Search size={16} color={colors.primary} style={{ marginRight: 8, flexShrink: 0 }} />
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            placeholder="Cerca attività, enti o luoghi"
                            placeholderTextColor="#94a3b8"
                            returnKeyType="search"
                            style={{
                                flex: 1,
                                fontSize: 14,
                                fontWeight: '500',
                                color: '#1e1b4b',
                                padding: 0,
                                margin: 0,
                            }}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => {
                                setSearchText("");
                                setSearchCenter(null);
                                setSuggestedActivities([]);
                                setSuggestedNpos([]);
                                setSuggestedPlaces([]);
                            }}>
                                <X size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Map icon — navigates to map view */}
                    <TouchableOpacity
                        onPress={() => router.push('/(volunteer)/(tabs)/map' as any)}
                        style={{
                            backgroundColor: '#f8f9ff',
                            borderRadius: 14, width: 42, height: 42,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: '#e8eaf0',
                        }}>
                        <MapIcon size={18} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Quick filter chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                    {/* Interessi / Competenze chips open FilterModal */}
                    {[{ id: 'interessi', label: 'Interessi', count: filters.interests.length },
                    { id: 'competenze', label: 'Competenze', count: filters.skills.length }].map(chip => (
                        <TouchableOpacity key={chip.id} onPress={openFilters}
                            style={{
                                flexDirection: 'row', alignItems: 'center', gap: 5,
                                backgroundColor: chip.count > 0 ? colors.primary : '#f0f2fa',
                                paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                            }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: chip.count > 0 ? 'white' : colors.primary }}>{chip.label}</Text>
                            {chip.count > 0 && (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 99, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{chip.count}</Text>
                                </View>
                            )}
                            <ChevronDown size={11} color={chip.count > 0 ? 'white' : colors.primary} />
                        </TouchableOpacity>
                    ))}

                    {/* Date chip — opens CalendarPicker in range mode */}
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            backgroundColor: filters.dateFrom ? colors.primary : '#f0f2fa',
                            paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                        }}>
                        <Calendar size={11} color={filters.dateFrom ? 'white' : colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.dateFrom ? 'white' : colors.primary }}>
                            {filters.dateFrom && filters.dateTo
                                ? `${filters.dateFrom.slice(5).replace('-', '/')} → ${filters.dateTo.slice(5).replace('-', '/')}`
                                : filters.dateFrom
                                    ? filters.dateFrom.slice(5).replace('-', '/')
                                    : 'Data'}
                        </Text>
                        {filters.dateFrom ? (
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation?.(); setFilters(f => ({ ...f, dateFrom: '', dateTo: '' })); }}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            >
                                <X size={11} color="white" />
                            </TouchableOpacity>
                        ) : (
                            <ChevronDown size={11} color={colors.primary} />
                        )}
                    </TouchableOpacity>

                    {/* Disponibili chip */}
                    <TouchableOpacity
                        onPress={() => setFilters(f => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                        style={{ backgroundColor: filters.onlyAvailable ? colors.primary : '#f0f2fa', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyAvailable ? 'white' : colors.primary }}>Disponibili</Text>
                    </TouchableOpacity>
                    {/* Urgenti chip */}
                    <TouchableOpacity
                        onPress={() => setFilters(f => ({ ...f, onlyUrgent: !f.onlyUrgent }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: filters.onlyUrgent ? colors.accent : '#f0f2fa', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99 }}>
                        <Zap size={11} color={filters.onlyUrgent ? 'white' : colors.accent} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyUrgent ? 'white' : colors.accent }}>Urgenti</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* CalendarPicker modal for Date quick chip — range mode */}
                <CalendarPicker
                    visible={showDatePicker}
                    value={filters.dateFrom}
                    valueTo={filters.dateTo}
                    rangeMode
                    onClose={() => setShowDatePicker(false)}
                    onSelect={(from: string, to: string) => {
                        setFilters(f => ({ ...f, dateFrom: from, dateTo: to }));
                        setShowDatePicker(false);
                    }}
                />

                {/* Categorized search suggestions dropdown — relative to this container */}
                {isSearchFocused && (suggestedActivities.length > 0 || suggestedNpos.length > 0 || suggestedPlaces.length > 0 || searchLoading) && (
                    <View style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        backgroundColor: 'white', borderRadius: 18, zIndex: 200, marginTop: 6,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 14,
                        overflow: 'hidden',
                    }}>
                        {searchLoading && <View style={{ padding: 16, alignItems: 'center' }}><ActivityIndicator size="small" color={colors.primary} /></View>}
                        {/* Activities section */}
                        {!searchLoading && suggestedActivities.length > 0 && (
                            <>
                                <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Attività</Text>
                                {suggestedActivities.map((act, idx) => (
                                    <TouchableOpacity
                                        key={act.id}
                                        onPress={() => {
                                            setSearchText(act.title);
                                            setIsSearchFocused(false);
                                            setSuggestedActivities([]);
                                            router.push(`/activity/${act.id}` as any);
                                        }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 12,
                                            paddingHorizontal: 16, paddingVertical: 10,
                                            borderBottomWidth: idx < suggestedActivities.length - 1 ? 1 : 0,
                                            borderBottomColor: '#f1f5f9',
                                        }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                                            {act.imageUrl ? (
                                                <Image source={{ uri: act.imageUrl }} style={{ width: '100%', height: '100%' }} />
                                            ) : (
                                                <Calendar size={16} color={colors.primary} />
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e1b4b' }} numberOfLines={1}>{act.title}</Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }} numberOfLines={1}>{act.npoName}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                        {/* NPOs section */}
                        {!searchLoading && suggestedNpos.length > 0 && (
                            <>
                                <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Enti</Text>
                                {suggestedNpos.map((npo, idx) => (
                                    <TouchableOpacity
                                        key={npo.id}
                                        onPress={() => {
                                            setSearchText(npo.name);
                                            setIsSearchFocused(false);
                                            setSuggestedNpos([]);
                                            router.push(`/npo-profile/${npo.id}` as any);
                                        }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 12,
                                            paddingHorizontal: 16, paddingVertical: 10,
                                            borderBottomWidth: idx < suggestedNpos.length - 1 ? 1 : 0,
                                            borderBottomColor: '#f1f5f9',
                                        }}>
                                        <UserAvatar
                                            size={32}
                                            fontSize={12}
                                            name={npo.name}
                                            avatarUrl={(npo as any).avatarUrl}
                                            role="NPO"
                                            isVerified={(npo as any).is_verified}
                                            verificationStatus={(npo as any).verification_status}
                                        />
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e1b4b', flex: 1 }} numberOfLines={1}>{npo.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                        {/* Places section */}
                        {!searchLoading && suggestedPlaces.length > 0 && (
                            <>
                                <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Luoghi</Text>
                                {suggestedPlaces.map((place, idx) => (
                                    <TouchableOpacity
                                        key={place.id}
                                        onPress={() => {
                                            setSearchText(place.label.split(',').slice(0, 2).join(',').trim());
                                            setSearchCenter({ lat: place.lat, lng: place.lng, label: place.label.split(',')[0].trim() });
                                            setIsSearchFocused(false);
                                            setSuggestedPlaces([]);
                                        }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 12,
                                            paddingHorizontal: 16, paddingVertical: 10,
                                            borderBottomWidth: idx < suggestedPlaces.length - 1 ? 1 : 0,
                                            borderBottomColor: '#f1f5f9',
                                        }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                            <MapPin size={16} color="#64748b" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e1b4b' }} numberOfLines={1}>{place.label.split(',')[0]}</Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }} numberOfLines={1}>{place.label.split(',').slice(1, 3).join(',').trim()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                    </View>
                )}
            </View>

            {/* Active geo-radius chip */}
            {searchCenter && (
                <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    marginBottom: 12, paddingHorizontal: 4,
                }}>
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: `${colors.primary}15`,
                        borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
                        borderWidth: 1.5, borderColor: `${colors.primary}40`,
                        flex: 1,
                    }}>
                        <MapPin size={13} color={colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, flex: 1 }} numberOfLines={1}>
                            Entro {filters.radiusKm}km da {searchCenter.label}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setSearchCenter(null); setSearchText(''); }}
                        style={{
                            backgroundColor: '#f1f5f9', borderRadius: 99,
                            width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
                        }}>
                        <X size={14} color="#64748b" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Activities List */}
            <FlashList
                testID="activity-list"
                data={listActivities}
                keyExtractor={(item) => item.id}
                renderItem={renderActivityItem}
                style={{ flex: 1 }}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onEndReached={() => { if (!isLoadingMore && hasMore) fetchNextPage(); }}
                onEndReachedThreshold={0.5}
                // @ts-ignore estimatedItemSize is a valid FlashList prop
                estimatedItemSize={260}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                        progressViewOffset={12}
                    />
                }
                ListFooterComponent={() => (
                    <View className="py-8 items-center">
                        {isLoadingMore ? (
                            <ActivityIndicator color={colors.accent} size="small" />
                        ) : !hasMore && paginatedActivities.length > 0 ? (
                            <View className="items-center">
                                <View className="h-[1px] w-20 bg-gray-200 mb-2" />
                                <Text className="text-secondary/40 text-[10px] font-medium uppercase tracking-widest">Hai visto tutto</Text>
                            </View>
                        ) : null}
                    </View>
                )}
                ListEmptyComponent={
                    !isLoading && !isLoadingActivities ? (
                        <EmptyState
                            emoji="🔍"
                            title="Nessun'attività trovata"
                            description="Prova a cambiare i filtri o la ricerca per trovare nuove opportunità."
                            actionLabel="Resetta Filtri"
                            onAction={() => { setSearchText(""); setFilters(DEFAULT_FILTERS); }}
                        />
                    ) : null
                }
            />

            <FilterModal
                visible={isFilterModalVisible}
                pendingFilters={pendingFilters}
                setPendingFilters={setPendingFilters}
                onClose={() => setIsFilterModalVisible(false)}
                onApply={applyFilters}
            />
        </StandardLayout>
    );
}
