import {
    View, Text, TextInput, TouchableOpacity, Image, RefreshControl,
    ActivityIndicator, ScrollView, Modal, Platform
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Colors } from "../../../constants/Colors";
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search, MapPin, Calendar, X, Map as MapIcon,
    Bell, Zap, Globe, BookOpen, Dog, Palette, Heart, Code,
    MessageSquare, Lightbulb, PenTool, BarChart, HardHat, Camera,
    ChevronDown, CheckCircle2, Users, TreePine, SlidersHorizontal
} from "lucide-react-native";
import { OldActivity } from "../../../types";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { useActivities } from "../../../hooks/useActivities";
import { activityService } from "../../../services/ActivityService";
import { supabase } from "../../../utils/supabase";
import { UserAvatar } from "../../../components/UserAvatar";
import { StandardLayout } from "../../../components/StandardLayout";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { SoftCard } from "../../../components/SoftCard";
import { EmptyState } from "../../../components/EmptyState";
import { useToast } from "../../../context/ToastContext";
import { CalendarPicker } from "../../../components/CalendarPicker";

// ─── Shared constants (keep in sync with map.tsx) ────────────────────────────
const INTERESTS = [
    { id: "Sociale", label: "Sociale", icon: Users },
    { id: "Ambiente", label: "Ambiente", icon: TreePine },
    { id: "Educazione", label: "Educazione", icon: BookOpen },
    { id: "Animali", label: "Animali", icon: Dog },
    { id: "Arte & Cultura", label: "Arte", icon: Palette },
    { id: "Salute", label: "Salute", icon: Heart },
];

const SKILLS = [
    { id: "Comunicazione", label: "Comunicazione", icon: MessageSquare },
    { id: "Informatica", label: "Informatica", icon: Code },
    { id: "Primo Soccorso", label: "Primo Soccorso", icon: Heart },
    { id: "Creatività", label: "Creatività", icon: PenTool },
    { id: "Organizzazione", label: "Organizzazione", icon: Lightbulb },
    { id: "Analisi Dati", label: "Analisi Dati", icon: BarChart },
    { id: "Lavoro Manuale", label: "Lavoro Manuale", icon: HardHat },
    { id: "Fotografia", label: "Fotografia", icon: Camera },
];

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
            { headers: { 'OldUser-Agent': 'AiutarSiApp/1.0' } }
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
                                    const isSelected = pendingFilters.interests.includes(item.id);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity key={item.id}
                                            onPress={() => setPendingFilters(f => ({
                                                ...f,
                                                interests: isSelected ? f.interests.filter(i => i !== item.id) : [...f.interests, item.id]
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
    const { user } = useAuth();
    const { showToast } = useToast();

    // Search state
    const [searchText, setSearchText] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    // Geo-center set when user picks a "Luogo" suggestion
    const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label: string } | null>(null);
    // Categorized search suggestions
    const [suggestedActivities, setSuggestedActivities] = useState<OldActivity[]>([]);
    const [suggestedNpos, setSuggestedNpos] = useState<{ id: string; name: string }[]>([]);
    const [suggestedPlaces, setSuggestedPlaces] = useState<{ id: number; label: string; lat: number; lng: number }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [refreshing, setRefreshing] = useState(false);

    // Filter state
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);

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

    // Active filter count
    const activeFilterCount = [
        filters.interests.length > 0,
        filters.skills.length > 0,
        filters.onlyAvailable,
        filters.onlyUrgent,
        !!filters.dateFrom,
        filters.radiusKm !== DEFAULT_FILTERS.radiusKm,
    ].filter(Boolean).length;

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
                        .select('id, npo_name')
                        .eq('role', 'NPO')
                        .ilike('npo_name', `%${searchText.trim()}%`)
                        .limit(3)
                        .then(({ data }) => (data || []).map((r: any) => ({ id: r.id, name: r.npo_name || '' }))),
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

    const renderActivityItem = ({ item }: { item: OldActivity }) => (
        <TouchableOpacity
            onPress={() => router.push(`/activity/${item.id}` as any)}
            activeOpacity={0.9}
            className="mb-4"
        >
            <SoftCard className="w-full relative overflow-hidden p-0">
                <View className="h-[120px] bg-slate-200 w-full relative">
                    <View className="absolute top-3 right-3 bg-accent px-4 py-1.5 rounded-full shadow-xl z-20 flex-row items-center gap-1.5 border border-white/20">
                        <Zap size={14} color="white" fill="white" />
                        <Text className="text-white font-black text-xs">{item.matchPercentage}% Match</Text>
                    </View>
                    {item.isUrgent && (
                        <View className="absolute top-3 left-3 bg-red-500 px-3 py-1 rounded-full z-20 shadow-lg">
                            <Text className="text-white text-[10px] font-black uppercase">Urgente</Text>
                        </View>
                    )}
                    <Image
                        source={{ uri: item.imageUrl || `https://dummyimage.com/600x300/e2e8f0/462282&text=${item.category}` }}
                        className="w-full h-full"
                    />
                </View>
                <View className="p-4 flex-1">
                    <Text className="text-secondary/70 font-bold uppercase text-[9px] mb-0.5">{item.npoName}</Text>
                    <Text className="text-lg font-black text-primary leading-tight mb-1" numberOfLines={1}>{item.title}</Text>
                    <View className="flex-row items-center gap-4 mb-2">
                        <View className="flex-row items-center gap-1.5">
                            <MapPin size={12} color={Colors.secondary} />
                            <Text className="text-secondary font-medium text-[10px]">{item.location.address}</Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                            <Calendar size={12} color={Colors.secondary} />
                            <Text className="text-secondary font-medium text-[10px]">{new Date(item.dateTime).toLocaleDateString("it-IT")}</Text>
                        </View>
                    </View>
                    <Text numberOfLines={2} className="text-secondary/60 text-xs leading-4">{item.description}</Text>
                </View>
            </SoftCard>
        </TouchableOpacity>
    );


    return (
        <StandardLayout label="Scopri" title="Esplora Attività" rightElement={<VolunteerHeaderActions />} bg="bg-background-light">
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
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                                            <Calendar size={16} color={Colors.primary} />
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
                                        }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 12,
                                            paddingHorizontal: 16, paddingVertical: 10,
                                            borderBottomWidth: idx < suggestedNpos.length - 1 ? 1 : 0,
                                            borderBottomColor: '#f1f5f9',
                                        }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${Colors.accent}15`, alignItems: 'center', justifyContent: 'center' }}>
                                            <Users size={16} color={Colors.accent} />
                                        </View>
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
                data={paginatedActivities}
                keyExtractor={(item) => item.id}
                renderItem={renderActivityItem}
                onEndReached={() => { if (!isLoadingMore && hasMore) fetchNextPage(); }}
                onEndReachedThreshold={0.5}
                // @ts-ignore estimatedItemSize is a valid FlashList prop
                estimatedItemSize={260}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
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
