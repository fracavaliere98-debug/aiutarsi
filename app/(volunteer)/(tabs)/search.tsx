import {
    View, Text, TextInput, TouchableOpacity, Image, RefreshControl,
    ActivityIndicator, ScrollView, Modal, Platform, Share
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Colors } from "../../../constants/Colors";
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
import { useSmartMatch } from "../../../context/SmartMatchContext";
import { INTERESTS } from "../../../constants/Interests";

import { SKILLS } from "../../../constants/Skills";

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
                                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.accent }}>Reset</Text>
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
                                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>Entro {pendingFilters.radiusKm}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {RADIUS_OPTIONS.map(r => (
                                    <TouchableOpacity key={r}
                                        onPress={() => setPendingFilters(f => ({ ...f, radiusKm: r }))}
                                        style={{
                                            paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99,
                                            backgroundColor: pendingFilters.radiusKm === r ? Colors.primary : '#f1f5f9',
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
                                    backgroundColor: pendingFilters.onlyAvailable ? `${Colors.primary}10` : '#f8f9ff',
                                    padding: 14, borderRadius: 16,
                                    borderWidth: 1.5, borderColor: pendingFilters.onlyAvailable ? Colors.primary : '#e2e8f0',
                                }}>
                                <CheckCircle2 size={22} color={pendingFilters.onlyAvailable ? Colors.primary : '#94a3b8'} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '800', fontSize: 14, color: '#1e1b4b' }}>Solo con posti disponibili</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }}>Mostra solo attività con slot liberi</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setPendingFilters(f => ({ ...f, onlyUrgent: !f.onlyUrgent }))}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    backgroundColor: pendingFilters.onlyUrgent ? `${Colors.accent}10` : '#f8f9ff',
                                    padding: 14, borderRadius: 16,
                                    borderWidth: 1.5, borderColor: pendingFilters.onlyUrgent ? Colors.accent : '#e2e8f0',
                                }}>
                                <Zap size={22} color={pendingFilters.onlyUrgent ? Colors.accent : '#94a3b8'} />
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
                                                backgroundColor: isSelected ? Colors.primary : '#f1f5f9',
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
                                                backgroundColor: isSelected ? Colors.accent : '#f1f5f9',
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
                            style={{ backgroundColor: Colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Applica Filtri</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Esplora (Search) Screen ──────────────────────────────────────────────────
export default function SearchScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const { matches, likeMatch, saveMatch, hideMatch, markMatchSeen } = useSmartMatch();

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

    const smartMatchMap = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
    // Base order remains chronological; top AI matches are lifted above it.
    const sortedActivities = useMemo(
        () => [...paginatedActivities].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
        [paginatedActivities]
    );
    const topMatchActivities = useMemo(() => {
        return sortedActivities
            .filter((activity) => {
                const match = smartMatchMap.get(activity.id);
                return match?.confidence === 'top' || (typeof match?.score === 'number' && match.score >= 85);
            })
            .sort((a, b) => {
                const scoreDiff = (smartMatchMap.get(b.id)?.score ?? 0) - (smartMatchMap.get(a.id)?.score ?? 0);
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
        const aiMatch = smartMatchMap.get(item.id);
        const displayScore = typeof aiMatch?.score === 'number' ? aiMatch.score : (item.matchPercentage ?? 0);
        const displayBadge = aiMatch?.confidenceLabel || 'Gemma';
        const aiChips = aiMatch?.chips?.slice(0, 3) || [];
        const isTopGemma = aiMatch?.confidence === 'top';
        const isInTopSection = topMatchIds.has(item.id);
        const previousItem = index > 0 ? listActivities[index - 1] : null;
        const showTopSectionHeader = isInTopSection && index === 0;
        const showAllActivitiesHeader = !isInTopSection && !!topMatchActivities.length && !!previousItem && topMatchIds.has(previousItem.id);


        return (
            <View>
                {showTopSectionHeader && (
                    <View style={{
                        backgroundColor: '#fff4f7',
                        borderRadius: 18,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#ffd6e4',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <Sparkles size={15} color={Colors.accent} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#be185d', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>
                                Top match per te
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '600' }}>
                                Le attività con il fit migliore secondo Gemma
                            </Text>
                        </View>
                    </View>
                )}

                {showAllActivitiesHeader && (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 4,
                        marginBottom: 14,
                    }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Tutte le attivita
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
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
                    className="mb-5"
                    style={{ opacity: isDimmed ? 0.35 : 1, transform: [{ scale: isExpanded ? 1.02 : 1 }] }}
                >
                    <View className={`w-full bg-white rounded-3xl relative overflow-hidden p-0 border border-slate-100 ${isExpanded ? 'shadow-2xl' : 'shadow-md'}`}>
                    {/* Image section */}
                    <View className={`${isExpanded ? 'h-[180px]' : 'h-[150px]'} bg-slate-200 w-full relative`}>
                        <Image
                            source={{ uri: item.imageUrl || `https://dummyimage.com/600x300/e2e8f0/462282&text=${item.category}` }}
                            className="w-full h-full"
                        />
                        {/* Dark gradient overlay at top for badge readability */}
                        <View className="absolute top-0 left-0 right-0 h-24 bg-black/30" />

                        {/* Top Badges */}
                        <View className="absolute top-4 left-4 flex-col gap-2 z-20">
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                alignSelf: 'flex-start',
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                gap: 5,
                                backgroundColor: isTopGemma ? Colors.accent : Colors.primary,
                            }} className="shadow-md border border-white/20">
                                <Sparkles size={12} color="#ffffff" fill="#ffffff" />
                                <Text
                                    style={{
                                        color: '#ffffff',
                                        fontSize: 12,
                                        fontWeight: '800',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    {aiMatch ? displayBadge : `${displayScore}% MATCH`}
                                </Text>
                            </View>
                            {item.isUrgent && (
                                <View className="bg-rose-600 px-2.5 py-1 rounded-full self-start shadow-md">
                                    <Text className="text-white text-[10px] font-black uppercase">URGENTE</Text>
                                </View>
                            )}
                        </View>

                        {/* Heart Icon */}
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation?.();
                                if (aiMatch) void likeMatch(aiMatch);
                            }}
                            className="absolute top-4 right-4 bg-black/20 p-2.5 rounded-full z-20 backdrop-blur-md"
                        >
                            <Heart size={16} color="white" strokeWidth={2.5} fill={aiMatch?.liked ? 'white' : 'transparent'} />
                        </TouchableOpacity>
                    </View>

                    {/* Content section */}
                    <View className="p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <View className={`${catColors.bg} px-2.5 py-1 rounded-md`}>
                                    <Text className={`${catColors.text} text-[9px] font-black uppercase tracking-wider`}>{item.category || "CATEGORIA"}</Text>
                                </View>
                                {displayScore > 0 && (
                                    <View style={{ backgroundColor: isTopGemma ? '#fff1f7' : '#eef2ff', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }}>
                                        <Text style={{ color: isTopGemma ? Colors.accent : Colors.primary, fontSize: 10, fontWeight: '900' }}>
                                            {displayScore}% fit
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <Text className={`font-black text-[#1e1b4b] leading-tight mb-1.5 ${isExpanded ? 'text-xl' : 'text-lg'}`} numberOfLines={isExpanded ? undefined : 2}>
                            {item.title}
                        </Text>

                        <View className="flex-row items-center gap-1.5 mb-2.5">
                            <Text className="text-indigo-800 font-bold text-xs">{item.npoName}</Text>
                            {isExpanded && <CheckCircle2 size={13} color="#4f46e5" strokeWidth={2.5} />}
                        </View>

                        {!!aiMatch?.reason && (
                            <View style={{
                                backgroundColor: isTopGemma ? '#fff4f7' : '#f8f9ff',
                                borderRadius: 16,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: isTopGemma ? '#ffd6e4' : '#e8eaf0',
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                    <Sparkles size={12} color={isTopGemma ? Colors.accent : Colors.primary} />
                                    <Text style={{ color: isTopGemma ? Colors.accent : Colors.primary, fontSize: 11, fontWeight: '900' }}>
                                        {displayBadge}{displayScore > 0 ? ` · ${displayScore}%` : ''}
                                    </Text>
                                </View>
                                <Text style={{ color: '#475569', fontSize: 12, lineHeight: 18, fontWeight: '600' }} numberOfLines={isExpanded ? 3 : 2}>
                                    {aiMatch.reason}
                                </Text>
                            </View>
                        )}

                        {!!aiChips.length && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {aiChips.map((chip) => (
                                    <View key={`${item.id}-${chip}`} style={{ backgroundColor: '#eef2ff', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }}>
                                        <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: '800' }}>{chip}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View className="gap-1.5 mb-1">
                            <View className="flex-row items-center gap-2">
                                <MapPin size={12} color="#64748b" />
                                <Text className="text-slate-500 font-medium text-[11px] flex-1" numberOfLines={1}>{item.location?.address || 'Indirizzo non specificato'}</Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                                <Calendar size={12} color="#64748b" />
                                <Text className="text-slate-500 font-medium text-[11px]">
                                    {new Date(item.dateTime).toLocaleDateString("it-IT", { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())} • {new Date(item.dateTime).toLocaleTimeString("it-IT", { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <View className="mt-3 pt-3 border-t border-slate-100">
                                <Text className="text-slate-500 text-xs leading-5 mb-4" numberOfLines={3}>
                                    {item.description}
                                </Text>
                                <View className="flex-row items-center gap-3">
                                    <TouchableOpacity
                                        onPress={() => router.push(`/activity/${item.id}` as any)}
                                        className="bg-primary flex-1 py-3.5 rounded-2xl items-center shadow-md">
                                        <Text className="text-white font-black text-[13px]">Dettagli Attività</Text>
                                    </TouchableOpacity>
                                    {aiMatch && (
                                        <TouchableOpacity
                                            onPress={() => void saveMatch(aiMatch)}
                                            className="bg-indigo-50 p-3.5 rounded-2xl items-center justify-center">
                                            <Bookmark size={18} color={Colors.primary} fill={aiMatch.saved ? Colors.primary : 'transparent'} />
                                        </TouchableOpacity>
                                    )}
                                    {aiMatch && (
                                        <TouchableOpacity
                                            onPress={() => void hideMatch(aiMatch)}
                                            className="bg-slate-100 p-3.5 rounded-2xl items-center justify-center">
                                            <EyeOff size={18} color="#475569" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        onPress={async () => {
                                            try {
                                                await Share.share({
                                                    message: `👐 ${item.title}\nPartecipa a questa attività su AiutarSì!\n\n📱 Apri directement nell'app:\naiutarsiapp://activity/${item.id}\n\n🌐 Oppure visualizza sul web:\nhttps://aiutarsi.app/activity/${item.id}`,
                                                });
                                            } catch (error) {
                                                console.error("Error sharing:", error);
                                            }
                                        }}
                                        className="bg-slate-100 p-3.5 rounded-2xl items-center justify-center">
                                        <Share2 size={18} color="#1e1b4b" />
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
                        borderColor: isSearchFocused ? Colors.primary : '#e8eaf0',
                    }}>
                        <Search size={16} color={Colors.primary} style={{ marginRight: 8, flexShrink: 0 }} />
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
                        <MapIcon size={18} color={Colors.primary} />
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
                                backgroundColor: chip.count > 0 ? Colors.primary : '#f0f2fa',
                                paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                            }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: chip.count > 0 ? 'white' : Colors.primary }}>{chip.label}</Text>
                            {chip.count > 0 && (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 99, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{chip.count}</Text>
                                </View>
                            )}
                            <ChevronDown size={11} color={chip.count > 0 ? 'white' : Colors.primary} />
                        </TouchableOpacity>
                    ))}

                    {/* Date chip — opens CalendarPicker in range mode */}
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            backgroundColor: filters.dateFrom ? Colors.primary : '#f0f2fa',
                            paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                        }}>
                        <Calendar size={11} color={filters.dateFrom ? 'white' : Colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.dateFrom ? 'white' : Colors.primary }}>
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
                            <ChevronDown size={11} color={Colors.primary} />
                        )}
                    </TouchableOpacity>

                    {/* Disponibili chip */}
                    <TouchableOpacity
                        onPress={() => setFilters(f => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                        style={{ backgroundColor: filters.onlyAvailable ? Colors.primary : '#f0f2fa', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyAvailable ? 'white' : Colors.primary }}>Disponibili</Text>
                    </TouchableOpacity>
                    {/* Urgenti chip */}
                    <TouchableOpacity
                        onPress={() => setFilters(f => ({ ...f, onlyUrgent: !f.onlyUrgent }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: filters.onlyUrgent ? Colors.accent : '#f0f2fa', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99 }}>
                        <Zap size={11} color={filters.onlyUrgent ? 'white' : Colors.accent} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyUrgent ? 'white' : Colors.accent }}>Urgenti</Text>
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
                        {searchLoading && <View style={{ padding: 16, alignItems: 'center' }}><ActivityIndicator size="small" color={Colors.primary} /></View>}
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
                                                <Calendar size={16} color={Colors.primary} />
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
                        backgroundColor: `${Colors.primary}15`,
                        borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
                        borderWidth: 1.5, borderColor: `${Colors.primary}40`,
                        flex: 1,
                    }}>
                        <MapPin size={13} color={Colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary, flex: 1 }} numberOfLines={1}>
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
                        tintColor={Colors.accent}
                        colors={[Colors.accent]}
                        progressViewOffset={12}
                    />
                }
                ListFooterComponent={() => (
                    <View className="py-8 items-center">
                        {isLoadingMore ? (
                            <ActivityIndicator color={Colors.accent} size="small" />
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
