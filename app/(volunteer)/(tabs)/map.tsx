import {
    View, Text, TouchableOpacity, Platform, Modal,
    ScrollView, TextInput, Image, ActivityIndicator, KeyboardAvoidingView
} from "react-native";
import { WebView } from "react-native-webview";
import { UserAvatar } from "../../../components/UserAvatar";
import { PageHeader } from "../../../components/PageHeader";
import { ScreenWrapper } from "../../../components/ScreenWrapper";
import {
    ArrowRight, Search, SlidersHorizontal, X, MapPin, Target, Calendar,
    Clock, Users, Globe, BookOpen, Dog, Palette, Heart, Code,
    MessageSquare, Lightbulb, PenTool, BarChart, HardHat, Camera,
    ChevronDown, CheckCircle2, Zap, TreePine, Bell
} from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Activity } from "../../../types";
import { useNotifications } from "../../../context/NotificationContext";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { activityService } from "../../../services/ActivityService";
import * as Location from "expo-location";
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';

// ─── Shared helpers ─────────────────────────────────────────────────────────
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

import { supabase } from "../../../utils/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
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

// Helper to get icon for category
const getCategoryIcon = (category: string) => {
    const interest = INTERESTS.find(i => i.id === category) || { icon: MapPin };
    return interest.icon;
};

// ─── Conditional MapView ──────────────────────────────────────────────────────
let MapView: any;
let Marker: any;
let PROVIDER_DEFAULT: any;
let Circle: any;
let UrlTile: any;

if (Platform.OS !== 'web') {
    try {
        const MapModule = require("react-native-maps");
        MapView = MapModule.default || MapModule;
        Marker = MapModule.Marker;
        Circle = MapModule.Circle;
        UrlTile = MapModule.UrlTile;
        PROVIDER_DEFAULT = MapModule.PROVIDER_DEFAULT;
    } catch (e) {
        console.warn("Native MapView could not be loaded");
    }
}

// ─── Local Marker Component (to handle stable state) ──────────────────────────
const ActivityMarker = ({ activity, isSelected, isEnrolled, markerColor, CatIcon, onPress, MarkerComp }: any) => {
    const [tracksView, setTracksView] = useState(true);

    useEffect(() => {
        setTracksView(true);
        const timer = setTimeout(() => {
            // Only stop tracking if NOT selected, to keep selection animations/states active
            if (!isSelected) setTracksView(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, [isSelected]);

    return (
        <MarkerComp
            key={activity.id}
            coordinate={{
                latitude: activity.location?.coords?.lat ?? 0,
                longitude: activity.location?.coords?.lng ?? 0
            }}
            onPress={onPress}
            anchor={{ x: 0.5, y: 0.9 }}
            tracksViewChanges={tracksView}
        >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && (
                    <View style={{
                        position: 'absolute',
                        width: 50, height: 50,
                        borderRadius: 25,
                        backgroundColor: `${markerColor}30`,
                        borderWidth: 2, borderColor: markerColor,
                        transform: [{ scale: 1.2 }],
                        zIndex: -1
                    }} />
                )}

                <View style={{
                    width: isSelected ? 42 : 36,
                    height: isSelected ? 42 : 36,
                    backgroundColor: markerColor,
                    borderRadius: 12,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
                    borderWidth: 2, borderColor: 'white',
                    transform: [{ scale: isSelected ? 1.1 : 1 }],
                }}>
                    <CatIcon size={isSelected ? 20 : 18} color="white" strokeWidth={2.5} />
                </View>

                {/* Pin Tip */}
                <View style={{
                    width: 0, height: 0,
                    borderLeftWidth: 6, borderLeftColor: 'transparent',
                    borderRightWidth: 6, borderRightColor: 'transparent',
                    borderTopWidth: 8, borderTopColor: 'white',
                    marginTop: -1, zIndex: 5
                }} />
                <View style={{
                    width: 0, height: 0,
                    borderLeftWidth: 4, borderLeftColor: 'transparent',
                    borderRightWidth: 4, borderRightColor: 'transparent',
                    borderTopWidth: 6, borderTopColor: markerColor,
                    marginTop: -7, zIndex: 6
                }} />

                {activity.isUrgent && !isSelected && (
                    <View style={{
                        position: 'absolute', top: -8, right: -8,
                        backgroundColor: Colors.accent,
                        borderRadius: 99, padding: 3,
                        borderWidth: 1.5, borderColor: 'white'
                    }}>
                        <Zap size={10} color="white" strokeWidth={3} />
                    </View>
                )}
            </View>
        </MarkerComp>
    );
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ActivityWithDistance = Activity & { distanceMeters?: number };

interface SearchCenter {
    lat: number;
    lng: number;
    label: string; // "Posizione attuale" or searched address
}

interface FilterState {
    interests: string[];
    skills: string[];
    onlyAvailable: boolean;
    onlyUrgent: boolean;
    dateFrom: string;
    radiusKm: number;
}

const DEFAULT_FILTERS: FilterState = {
    interests: [],
    skills: [],
    onlyAvailable: false,
    onlyUrgent: false,
    dateFrom: '',
    radiusKm: 20,
};

// ─── Shared Filter Modal ──────────────────────────────────────────────────────
export function FilterModal({
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
    const reset = () => setPendingFilters(DEFAULT_FILTERS);

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
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
                    }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e1b4b' }}>Filtra Attività</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity onPress={reset}>
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
                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b' }}>Raggio d'azione</Text>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>Entro {pendingFilters.radiusKm}km</Text>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {RADIUS_OPTIONS.map((r) => (
                                    <TouchableOpacity
                                        key={r}
                                        onPress={() => setPendingFilters(f => ({ ...f, radiusKm: r }))}
                                        style={{
                                            paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99,
                                            backgroundColor: pendingFilters.radiusKm === r ? Colors.primary : '#f1f5f9',
                                            borderWidth: pendingFilters.radiusKm === r ? 0 : 1, borderColor: '#e2e8f0',
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
                                onChangeText={(v) => setPendingFilters(f => ({ ...f, dateFrom: v }))}
                                placeholder="AAAA-MM-GG (es. 2025-03-01)"
                                placeholderTextColor="#94a3b8"
                                style={{
                                    backgroundColor: '#f8f9ff', borderRadius: 14, paddingHorizontal: 16,
                                    paddingVertical: 12, fontSize: 14, fontWeight: '600', color: '#1e1b4b',
                                    borderWidth: 1, borderColor: '#e2e8f0',
                                }}
                            />
                        </View>

                        {/* Disponibilità + Urgenza */}
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

                        {/* Interests */}
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Categoria / Interessi</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {INTERESTS.map((item) => {
                                    const isSelected = pendingFilters.interests.includes(item.id);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
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

                        {/* Skills */}
                        <View>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Competenze richieste</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {SKILLS.map((item) => {
                                    const isSelected = pendingFilters.skills.includes(item.id);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
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

// ─── Main Map Component ───────────────────────────────────────────────────────
export default function VolunteerMap() {
    const router = useRouter();
    const params = useLocalSearchParams<{ focusLat?: string; focusLng?: string; focusActivityId?: string }>();
    const { user } = useAuth();
    const { unreadCount } = useNotifications();
    const mapRef = useRef<any>(null);

    // Location & search center
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingActivities, setLoadingActivities] = useState(false);

    // Activities
    const [activities, setActivities] = useState<ActivityWithDistance[]>([]);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState<{ id: number; label: string; lat: number; lng: number }[]>([]);
    const [suggestedActivities, setSuggestedActivities] = useState<Activity[]>([]);
    const [suggestedNpos, setSuggestedNpos] = useState<{ id: string; name: string }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Filter state
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);

    // Selected activity
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

    // ── Location Init ───────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    if (isMounted) setLocation(loc);
                }
            } catch (e) {
                console.warn('Location error:', e);
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    // ── Deep-link focus (from activity detail tap) ───────────────────────
    useEffect(() => {
        if (loading) return;
        const focusLat = params.focusLat ? parseFloat(params.focusLat) : NaN;
        const focusLng = params.focusLng ? parseFloat(params.focusLng) : NaN;
        if (isNaN(focusLat) || isNaN(focusLng)) return;
        setSearchCenter({ lat: focusLat, lng: focusLng, label: 'Attività selezionata' });
        if (mapRef.current && Platform.OS !== 'web') {
            setTimeout(() => {
                mapRef.current?.animateToRegion({
                    latitude: focusLat, longitude: focusLng,
                    latitudeDelta: 0.02, longitudeDelta: 0.02,
                }, 600);
            }, 400);
        }
        if (params.focusActivityId) {
            setTimeout(() => setSelectedActivity(params.focusActivityId!), 1200);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // ── Active center coords ────────────────────────────────────────────────
    // If user searched a place use that, else fall back to device location
    const centerLat = searchCenter?.lat ?? location?.coords.latitude ?? 45.4642;
    const centerLng = searchCenter?.lng ?? location?.coords.longitude ?? 9.1900;
    const centerLabel = searchCenter?.label ?? "Posizione attuale";

    // ── Fetch activities when center or radius changes ──────────────────────
    const fetchActivities = useCallback(async (lat: number, lng: number, radius: number) => {
        setLoadingActivities(true);
        try {
            const results = await activityService.getActivitiesByRadius(lat, lng, radius);
            setActivities(results);
        } catch (e) {
            console.error('[Map] Fetch error:', e);
        } finally {
            setLoadingActivities(false);
        }
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchActivities(centerLat, centerLng, filters.radiusKm);
        }
    }, [loading, centerLat, centerLng, filters.radiusKm]);

    // ── Filter logic ────────────────────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        return activities.filter(act => {
            if (act.status === 'CANCELLATA' || act.status === 'COMPLETATA' || act.status === 'IN_CORSO') return false;
            if (filters.onlyUrgent && !act.isUrgent) return false;
            if (filters.onlyAvailable && act.iscritti.length >= act.slots) return false;
            if (filters.interests.length > 0 && !filters.interests.includes(act.category)) return false;
            if (filters.skills.length > 0 && !act.skills.some(s => filters.skills.includes(s))) return false;
            if (filters.dateFrom) {
                if (new Date(act.dateTime) < new Date(filters.dateFrom)) return false;
            }
            return true;
        });
    }, [activities, filters]);

    // ── Filter helpers ──────────────────────────────────────────────────────
    const activeFilterCount = useMemo(() => {
        let c = 0;
        if (filters.interests.length > 0) c++;
        if (filters.skills.length > 0) c++;
        if (filters.onlyAvailable) c++;
        if (filters.onlyUrgent) c++;
        if (filters.dateFrom) c++;
        if (filters.radiusKm !== DEFAULT_FILTERS.radiusKm) c++;
        return c;
    }, [filters]);

    const openFilters = () => { setPendingFilters(filters); setIsFilterModalVisible(true); };
    const applyFilters = () => {
        setFilters(pendingFilters);
        setIsFilterModalVisible(false);
        fetchActivities(centerLat, centerLng, pendingFilters.radiusKm);
    };

    // ── Map helpers ─────────────────────────────────────────────────────────
    const centerOnUser = () => {
        if (location && mapRef.current && Platform.OS !== 'web') {
            mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            });
            // Reset to user's location as search center
            setSearchCenter(null);
            setSearchQuery("");
        }
    };

    // ── Live search suggestions ──────────────────────────────────────────────
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (searchQuery.length < 2) {
            setSuggestedActivities([]);
            setSuggestedNpos([]);
            setSearchSuggestions([]);
            return;
        }
        searchTimer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const [actResults, npoRows, placeResults] = await Promise.all([
                    // Activities matching the query
                    activityService.getActivities({ searchText: searchQuery.trim(), limit: 3, offset: 0 })
                        .then(r => r.activities.slice(0, 3)),
                    // NPOs — search profiles with role=NPO
                    supabase
                        .from('profiles')
                        .select('id, npo_name')
                        .eq('role', 'NPO')
                        .ilike('npo_name', `%${searchQuery.trim()}%`)
                        .limit(3)
                        .then(({ data }) => (data || []).map((r: any) => ({ id: r.id, name: r.npo_name || '' }))),
                    // Places from Nominatim
                    fetchNominatim(searchQuery),
                ]);
                setSuggestedActivities(actResults);
                setSuggestedNpos(npoRows);
                setSearchSuggestions(placeResults.slice(0, 3));
            } catch { /* silently fail */ } finally {
                setSearchLoading(false);
            }
        }, 500);
    }, [searchQuery]);

    // ── Search: when user picks an address ──────────────────────────────────
    const handleSearchSelect = useCallback((label: string, lat: number, lng: number) => {
        const shortLabel = label.split(',').slice(0, 2).join(',').trim();
        setSearchQuery(shortLabel);
        setIsSearchFocused(false);
        setSearchSuggestions([]);
        // Update the center — this automatically re-triggers fetchActivities via useEffect
        setSearchCenter({ lat, lng, label: shortLabel });
        if (mapRef.current && Platform.OS !== 'web') {
            mapRef.current.animateToRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            });
        }
    }, []);

    const clearSearch = () => {
        setSearchQuery("");
        setIsSearchFocused(false);
        setSearchCenter(null);
        setSearchSuggestions([]);
    };

    // ── Format distance ─────────────────────────────────────────────────────
    const formatDistance = (meters?: number) => {
        if (!meters) return null;
        return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)} km`;
    };

    // ── Map rendering ───────────────────────────────────────────────────────
    const renderMap = () => {
        if (Platform.OS === 'web') {
            const delta = 0.03;
            return (
                <View style={{ flex: 1, backgroundColor: '#e5e7eb' }}>
                    <iframe
                        width="100%" height="100%"
                        frameBorder="0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - delta}%2C${centerLat - delta}%2C${centerLng + delta}%2C${centerLat + delta}&layer=mapnik&marker=${centerLat}%2C${centerLng}`}
                        style={{ border: 'none', position: 'absolute', top: 0, left: 0 } as any}
                        title="Map"
                    />
                </View>
            );
        }

        /* We build the marker data explicitly for injection into WebView */
        const mapMarkers = (filteredActivities || []).map(act => {
            const isSelected = selectedActivity === act.id;
            const isEnrolled = user?.id ? (act.iscritti || []).includes(user.id) : false;
            const markerColor = act.isUrgent ? Colors.accent : isEnrolled ? '#22c55e' : Colors.primary;
            return {
                id: act.id,
                lat: act.location?.coords?.lat || 0,
                lng: act.location?.coords?.lng || 0,
                color: markerColor,
                title: act.title ? act.title.replace(/'/g, "\\'") : ''
            };
        }).filter(m => m.lat !== 0 && m.lng !== 0);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
            <style>
                body { padding: 0; margin: 0; background: #f1f5f9; }
                #map { width: 100vw; height: 100vh; background: #f1f5f9; }
                .leaflet-control-zoom { display: none; }
                .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                
                .pin-outer {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    transition: transform 0.2s;
                }
                .pin-inner {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                // Initialize map
                var map = L.map('map', {
                    zoomControl: false,
                    attributionControl: true
                }).setView([${centerLat}, ${centerLng}], 13);
                
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OSM contributors'
                }).addTo(map);

                // Add Radius Circle
                L.circle([${centerLat}, ${centerLng}], {
                    color: '${Colors.primary}',
                    fillColor: '${Colors.primary}',
                    fillOpacity: 0.12,
                    weight: 1,
                    radius: ${filters.radiusKm * 1000}
                }).addTo(map);

                // Render markers
                var markers = ${JSON.stringify(mapMarkers)};
                markers.forEach(function(m) {
                    var customIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div class='pin-outer'><div class='pin-inner' style='background-color:" + m.color + ";'></div></div>",
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });

                    var marker = L.marker([m.lat, m.lng], {icon: customIcon}).addTo(map);
                    marker.on('click', function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_CLICK', id: m.id }));
                    });
                });

                // Inject user location natively
                ${location ? `
                L.circleMarker([${location.coords.latitude}, ${location.coords.longitude}], {
                    radius: 8,
                    fillColor: "#3b82f6",
                    color: "#ffffff",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);
                ` : `
                // Try guessing it via browser API only if native location is missing
                map.locate({setView: false, maxZoom: 16});
                map.on('locationfound', function(e) {
                    L.circleMarker(e.latlng, {
                        radius: 8,
                        fillColor: "#3b82f6",
                        color: "#ffffff",
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 1
                    }).addTo(map);
                });
                `}

                // Clear selection on map click
                map.on('click', function(e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_CLICK' }));
                });
            </script>
        </body>
        </html>
        `;

        return (
            <View style={{ flex: 1, width: '100%', height: '100%' }}>
                <WebView
                    source={{ html: htmlContent }}
                    style={{ flex: 1, backgroundColor: '#f1f5f9' }}
                    onMessage={(event: any) => {
                        try {
                            const data = JSON.parse(event.nativeEvent.data);
                            if (data.type === 'MARKER_CLICK') {
                                setSelectedActivity(selectedActivity === data.id ? null : data.id);
                            } else if (data.type === 'MAP_CLICK') {
                                setSelectedActivity(null);
                            }
                        } catch (e) { }
                    }}
                    scrollEnabled={false}
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    originWhitelist={['*']}
                />
            </View>
        );
    };

    // ───────────────────────────────────────────────────────────────────────
    // OVERLAY HEIGHT for the header control box
    // We'll compute a rough height for the rounded-box overlay
    const HEADER_TOP = Platform.OS === 'ios' ? 54 : 34;

    const HeaderActions = (
        <View className="flex-row items-center gap-3">
            <TouchableOpacity
                onPress={() => router.push("/(volunteer)/notifications" as any)}
                className="bg-white/10 p-2.5 rounded-xl border border-white/20 relative"
            >
                <Bell size={20} color="white" />
                {unreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2 border-primary">
                        <Text className="text-white text-[10px] font-black">{unreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => router.push("/(volunteer)/profile" as any)}
            >
                <UserAvatar size={40} fontSize={14} useAuthFallback={true} />
            </TouchableOpacity>
        </View>
    );

    return (
        <ScreenWrapper bg="bg-f6f6f8" withPadding={false} edges={["top"]}>
            <PageHeader
                label="Esplora"
                title="Mappa"
                containerStyle={{ marginBottom: 0, zIndex: 10 }}
                rightElement={HeaderActions}
            />

            <View style={{ flex: 1, position: 'relative' }}>
                {/* Full-screen map behind everything */}
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                    {renderMap()}
                </View>

                {/* ── Rounded Overlay Box (search + chips + radius) ── */}
                <View style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    right: 12,
                    zIndex: 100,
                }}>
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 24,
                        paddingHorizontal: 14,
                        paddingTop: 12,
                        paddingBottom: 14,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.10,
                        shadowRadius: 18,
                        elevation: 10,
                    }}>
                        {/* Search Row */}
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
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
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
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={clearSearch}>
                                        <X size={14} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Filter button */}
                            <TouchableOpacity
                                onPress={openFilters}
                                style={{
                                    backgroundColor: activeFilterCount > 0 ? Colors.primary : '#f8f9ff',
                                    borderRadius: 14, width: 42, height: 42,
                                    alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: activeFilterCount > 0 ? 'transparent' : '#e8eaf0',
                                    flexDirection: 'row', gap: 4,
                                }}>
                                <SlidersHorizontal size={18} color={activeFilterCount > 0 ? 'white' : Colors.primary} />
                                {activeFilterCount > 0 && (
                                    <View style={{ position: 'absolute', top: 5, right: 5, backgroundColor: Colors.accent, borderRadius: 99, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>{activeFilterCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Address search dropdown — overlaps below the box */}
                        {/* chips row */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                            {[
                                { id: 'interessi', label: 'Interessi', count: filters.interests.length },
                                { id: 'competenze', label: 'Competenze', count: filters.skills.length },
                            ].map(chip => (
                                <TouchableOpacity
                                    key={chip.id}
                                    onPress={openFilters}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 5,
                                        backgroundColor: chip.count > 0 ? Colors.primary : '#f0f2fa',
                                        paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                                    }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: chip.count > 0 ? 'white' : Colors.primary }}>
                                        {chip.label}
                                    </Text>
                                    {chip.count > 0 && (
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 99, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{chip.count}</Text>
                                        </View>
                                    )}
                                    <ChevronDown size={11} color={chip.count > 0 ? 'white' : Colors.primary} />
                                </TouchableOpacity>
                            ))}

                            {/* Disponibili toggle */}
                            <TouchableOpacity
                                onPress={() => setFilters(f => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 4,
                                    backgroundColor: filters.onlyAvailable ? Colors.primary : '#f0f2fa',
                                    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                                }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyAvailable ? 'white' : Colors.primary }}>Disponibili</Text>
                            </TouchableOpacity>

                            {/* Urgenti toggle */}
                            <TouchableOpacity
                                onPress={() => setFilters(f => ({ ...f, onlyUrgent: !f.onlyUrgent }))}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 4,
                                    backgroundColor: filters.onlyUrgent ? Colors.accent : '#f0f2fa',
                                    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99,
                                }}>
                                <Zap size={11} color={filters.onlyUrgent ? 'white' : Colors.accent} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: filters.onlyUrgent ? 'white' : Colors.accent }}>Urgenti</Text>
                            </TouchableOpacity>
                        </ScrollView>

                    </View>

                    {/* Suggestions dropdown — absolute, overlaps map content */}
                    {isSearchFocused && (searchSuggestions.length > 0 || suggestedActivities.length > 0 || suggestedNpos.length > 0 || searchLoading) && (
                        <View style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 6,
                            backgroundColor: 'white',
                            borderRadius: 18,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 14,
                            overflow: 'hidden',
                            zIndex: 999,
                        }}>
                            {searchLoading && (
                                <View style={{ padding: 16, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                </View>
                            )}
                            {!searchLoading && suggestedActivities.length > 0 && (
                                <>
                                    <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Attività</Text>
                                    {suggestedActivities.map((act, idx) => (
                                        <TouchableOpacity
                                            key={act.id}
                                            onPress={() => {
                                                setSearchQuery(act.title);
                                                setIsSearchFocused(false);
                                                setSuggestedActivities([]);

                                                // Instead of navigating, select the activity on map
                                                setSelectedActivity(act.id);

                                                if (act.location?.coords && mapRef.current && Platform.OS !== 'web') {
                                                    const lat = act.location.coords.lat;
                                                    const lng = act.location.coords.lng;
                                                    mapRef.current.animateToRegion({
                                                        latitude: lat,
                                                        longitude: lng,
                                                        latitudeDelta: 0.02, // Zoom in more for specific selection
                                                        longitudeDelta: 0.02,
                                                    }, 1000);
                                                }
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
                            {!searchLoading && suggestedNpos.length > 0 && (
                                <>
                                    <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Enti</Text>
                                    {suggestedNpos.map((npo, idx) => (
                                        <TouchableOpacity
                                            key={npo.id}
                                            onPress={() => {
                                                setSearchQuery(npo.name);
                                                setIsSearchFocused(false);
                                                setSuggestedNpos([]);

                                                // Handle NPO selection: find an activity of this NPO and focus it, 
                                                // or just zoom out to show the area if we don't have a single location.
                                                const firstAct = filteredActivities.find(a => a.npoName === npo.name);
                                                if (firstAct && firstAct.location?.coords && mapRef.current && Platform.OS !== 'web') {
                                                    setSelectedActivity(firstAct.id);
                                                    mapRef.current.animateToRegion({
                                                        latitude: firstAct.location.coords.lat,
                                                        longitude: firstAct.location.coords.lng,
                                                        latitudeDelta: 0.04,
                                                        longitudeDelta: 0.04,
                                                    }, 1000);
                                                }
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
                            {!searchLoading && searchSuggestions.length > 0 && (
                                <>
                                    <Text style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Luoghi</Text>
                                    {searchSuggestions.map((item, idx) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            onPress={() => handleSearchSelect(item.label, item.lat, item.lng)}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 12,
                                                paddingHorizontal: 16, paddingVertical: 12,
                                                borderBottomWidth: idx < searchSuggestions.length - 1 ? 1 : 0,
                                                borderBottomColor: '#f1f5f9',
                                            }}>
                                            <MapPin size={16} color={Colors.accent} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e1b4b' }} numberOfLines={1}>
                                                    {item.label.split(',')[0]}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '500' }} numberOfLines={1}>
                                                    {item.label.split(',').slice(1, 3).join(',').trim()}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    )}
                </View>

                {/* ── Right FABs ── */}
                <View style={{
                    position: 'absolute', right: 14, bottom: 105,
                    gap: 10, zIndex: 50,
                }}>
                    <TouchableOpacity
                        onPress={() => router.push("/(volunteer)/profile" as any)}
                        style={{
                            backgroundColor: 'white', borderRadius: 14, padding: 8,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
                        }}>
                        <UserAvatar size={26} fontSize={10} useAuthFallback />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={centerOnUser}
                        style={{
                            backgroundColor: 'white', borderRadius: 14, padding: 12,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
                        }}>
                        <Target size={22} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* ── Activity count badge ── */}
                {!selectedActivity && (
                    <Animated.View
                        entering={FadeIn}
                        exiting={FadeOut}
                        style={{
                            position: 'absolute', bottom: 28, alignSelf: 'center',
                            backgroundColor: Colors.primary,
                            paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99,
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
                        }}>
                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>
                            {loadingActivities ? 'Caricamento...' : `${filteredActivities.length} attività nella zona`}
                        </Text>
                    </Animated.View>
                )}

                {/* ── Selected Activity Bottom Sheet ── */}
                {selectedActivity && (() => {
                    const activity = filteredActivities.find(a => a.id === selectedActivity);
                    if (!activity) return null;
                    const dist = formatDistance((activity as any).distanceMeters);
                    return (
                        <Animated.View
                            entering={SlideInDown.duration(350).springify()}
                            exiting={SlideOutDown.duration(200)}
                            style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                backgroundColor: 'white',
                                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                                paddingHorizontal: 20, paddingTop: 16,
                                paddingBottom: 106,
                                shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
                                zIndex: 200,
                            }}>
                            <View style={{ width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 99, alignSelf: 'center', marginBottom: 16 }} />
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                                <View style={{ width: 72, height: 72, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                                    {activity.imageUrl
                                        ? <Image source={{ uri: activity.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        : <View style={{ flex: 1, backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}><MapPin size={22} color={Colors.primary} /></View>
                                    }
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e1b4b', flex: 1 }} numberOfLines={1}>{activity.title}</Text>
                                        {activity.isUrgent && (
                                            <View style={{ backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                                                <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>URGENTE</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8 }}>{activity.npoName}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{ backgroundColor: `${Colors.primary}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
                                            <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '800' }}>{activity.matchPercentage}% Match</Text>
                                        </View>
                                        {dist && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <MapPin size={11} color="#94a3b8" />
                                                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>{dist}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedActivity(null)} style={{ padding: 6, backgroundColor: '#f1f5f9', borderRadius: 99 }}>
                                    <X size={16} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                {[
                                    { Icon: Calendar, text: new Date(activity.dateTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) },
                                    { Icon: Clock, text: new Date(activity.dateTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
                                    { Icon: Users, text: `${activity.slots - activity.iscritti.length} posti` },
                                ].map(({ Icon, text }) => (
                                    <View key={text} style={{ flex: 1, backgroundColor: '#f8f9ff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Icon size={14} color={Colors.primary} />
                                        <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '700' }}>{text}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={() => router.push(`/activity/${activity.id}` as any)}
                                style={{ marginTop: 14, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Vedi Dettagli</Text>
                                <ArrowRight size={18} color="white" />
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })()}

                {/* ── Filter Modal ── */}
                <FilterModal
                    visible={isFilterModalVisible}
                    pendingFilters={pendingFilters}
                    setPendingFilters={setPendingFilters}
                    onClose={() => setIsFilterModalVisible(false)}
                    onApply={applyFilters}
                />
            </View>
        </ScreenWrapper>
    );
}
