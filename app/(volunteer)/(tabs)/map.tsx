import {
    View, Text, TouchableOpacity, Platform, Modal,
    ScrollView, TextInput, Image, ActivityIndicator
} from "react-native";
import { WebView } from "react-native-webview";
import { PageHeader } from "../../../components/PageHeader";
import { VolunteerHeaderActions } from "../../../components/VolunteerHeaderActions";
import { ScreenWrapper } from "../../../components/ScreenWrapper";
import { UserAvatar } from "../../../components/UserAvatar";
import {
    ArrowRight, Search, X, MapPin, Target, Calendar, Plus, Minus,
    Clock, Users, ChevronDown, CheckCircle2, Zap, LayoutList
} from "lucide-react-native";
import { Colors } from "../../../constants/Colors";
import { useRouter, useLocalSearchParams } from "expo-router";
import { OldActivity, AppActivity } from "../../../types";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { activityService } from "../../../services/ActivityService";
import * as Location from "expo-location";
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase } from "../../../utils/supabase";
import { useQuery } from '@tanstack/react-query';
import { CalendarPicker } from "../../../components/CalendarPicker";
import { requestForegroundLocationPermission } from "../../../utils/permissions";
import { INTERESTS } from "../../../constants/Interests";
import { getLegacyActivityMatchSnapshot } from "../../../utils/smartMatchLegacy";

import { SKILLS } from "../../../constants/Skills";

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

const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

// Helper to get icon for category
const getCategoryIcon = (category: string) => {
    const interest = INTERESTS.find(i => i.label === category || i.id === category.toLowerCase()) || { icon: MapPin };
    return interest.icon;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ActivityWithDistance = OldActivity & { distanceMeters?: number };

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
                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b' }}>Raggio d&apos;azione</Text>
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
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 12 }}>Data (da → a)</Text>
                            <TextInput
                                value={pendingFilters.dateFrom}
                                onChangeText={(v) => setPendingFilters(f => ({ ...f, dateFrom: v }))}
                                placeholder="Da: AAAA-MM-GG"
                                placeholderTextColor="#94a3b8"
                                style={{
                                    backgroundColor: '#f8f9ff', borderRadius: 14, paddingHorizontal: 16,
                                    paddingVertical: 12, fontSize: 14, fontWeight: '600', color: '#1e1b4b',
                                    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8,
                                }}
                            />
                            <TextInput
                                value={pendingFilters.dateTo}
                                onChangeText={(v) => setPendingFilters(f => ({ ...f, dateTo: v }))}
                                placeholder="A: AAAA-MM-GG"
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
                                    const isSelected = pendingFilters.interests.includes(item.label);
                                    const Icon = item.icon;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
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
    const mapRef = useRef<any>(null);

    // Location & search center
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(null);
    const [loading, setLoading] = useState(true);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState<{ id: number; label: string; lat: number; lng: number }[]>([]);
    const [suggestedActivities, setSuggestedActivities] = useState<AppActivity[]>([]);
    const [suggestedNpos, setSuggestedNpos] = useState<{ id: string; name: string }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Filter state
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);

    // Date picker for quick chip
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Selected activity
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
    const [mapZoom, setMapZoom] = useState(13);

    // ── Location Init ───────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const granted = await requestForegroundLocationPermission({
                    title: 'Accesso alla posizione',
                    message: 'AiutarSi usa la tua posizione per centrare la mappa e mostrarti attivita vicino a te.',
                    settingsLabel: 'la posizione',
                });
                if (granted) {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    if (isMounted) setLocation(loc);
                }
            } catch (error) {
                console.warn('Location error:', error);
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
        setMapZoom(15);
        if (params.focusActivityId) {
            setTimeout(() => setSelectedActivity(params.focusActivityId!), 1200);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // ── Active center coords ────────────────────────────────────────────────
    // If user searched a place use that, else fall back to device location
    const centerLat = searchCenter?.lat ?? location?.coords.latitude ?? 45.4642;
    const centerLng = searchCenter?.lng ?? location?.coords.longitude ?? 9.1900;
    // ── Activities via useQuery (keyed on center + radius) ───────────────────
    // Placed AFTER centerLat/centerLng/filters are declared so TypeScript is happy.
    // Automatically re-fetches when center or radius changes. staleTime: 60s.
    const {
        data: rawActivities = [],
        isFetching: loadingActivities,
    } = useQuery({
        queryKey: ['map-activities', user?.id, centerLat, centerLng, filters.radiusKm],
        enabled: !loading,
        staleTime: 60_000,
        queryFn: async () => {
            const result = await activityService.getActivities({
                userId: user?.id,
                centerLat,
                centerLng,
                radiusKm: filters.radiusKm,
                statuses: ['APERTA', 'IN_CORSO'],
                limit: 100,
                offset: 0,
            });
            return result.activities.filter(act => ['APERTA', 'IN_CORSO'].includes(act.status));
        },
    });
    const activities = rawActivities as ActivityWithDistance[];

    // ── Filter logic ────────────────────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        return activities.filter(act => {
            if (filters.onlyUrgent && !act.isUrgent) return false;
            if (filters.onlyAvailable && act.iscritti.length >= act.slots) return false;
            if (filters.interests.length > 0 && !filters.interests.includes(act.category)) return false;
            if (filters.skills.length > 0 && !act.skills.some(s => filters.skills.includes(s))) return false;
            if (filters.dateFrom) {
                if (new Date(act.dateTime) < new Date(filters.dateFrom)) return false;
            }
            if (filters.dateTo) {
                if (new Date(act.dateTime) > new Date(filters.dateTo + 'T23:59:59')) return false;
            }
            return true;
        });
    }, [activities, filters]);

    // ── Filter helpers ──────────────────────────────────────────────────────
    const openFilters = () => { setPendingFilters(filters); setIsFilterModalVisible(true); };
    const applyFilters = () => {
        // Updating filters updates the queryKey, which auto-triggers a re-fetch.
        setFilters(pendingFilters);
        setIsFilterModalVisible(false);
    };

    // ── Map helpers ─────────────────────────────────────────────────────────
    const centerOnUser = () => {
        if (!location) return;
        if (mapRef.current && Platform.OS !== 'web') {
            mapRef.current.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
            });
        }
        setSelectedActivity(null);
        setSearchCenter(null);
        setSearchQuery("");
        setMapZoom(13);
    };

    const zoomIn = () => setMapZoom((z) => Math.min(18, z + 1));
    const zoomOut = () => setMapZoom((z) => Math.max(8, z - 1));

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
                        .select('id, npo_name, full_name, avatar_url, is_verified, verification_status')
                        .eq('role', 'NPO')
                        .or(`npo_name.ilike.%${searchQuery.trim()}%,full_name.ilike.%${searchQuery.trim()}%`)
                        .limit(3)
                        .then(({ data }) => (data || []).map((r: any) => ({ 
                            id: r.id, 
                            name: r.npo_name || r.full_name || '', 
                            avatarUrl: r.avatar_url,
                            is_verified: r.is_verified,
                            verification_status: r.verification_status
                        }))),
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
            const delta = Math.max(0.005, 0.2 / Math.pow(2, mapZoom - 10));
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
                }).setView([${centerLat}, ${centerLng}], ${mapZoom});
                
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
                        } catch { }
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
    return (
        <ScreenWrapper bg="bg-f6f6f8" withPadding={false} edges={["top"]}>
            <PageHeader
                label="Esplora"
                title="Mappa"
                containerStyle={{ marginBottom: 0, zIndex: 10 }}
                rightElement={<VolunteerHeaderActions />}
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

                            {/* "Torna alla lista" button — replaces filter icon, navigates to Esplora */}
                            <TouchableOpacity
                                onPress={() => router.push('/(volunteer)/(tabs)/search' as any)}
                                style={{
                                    backgroundColor: '#f8f9ff',
                                    borderRadius: 14, width: 42, height: 42,
                                    alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: '#e8eaf0',
                                }}>
                                <LayoutList size={18} color={Colors.primary} />
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

                            {/* Date chip — CalendarPicker range mode */}
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
                                        onPress={() => setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }))}
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    >
                                        <X size={11} color="white" />
                                    </TouchableOpacity>
                                ) : (
                                    <ChevronDown size={11} color={Colors.primary} />
                                )}
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
                                                setMapZoom(15);
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
                                                setMapZoom(14);
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
                        onPress={zoomIn}
                        style={{
                            backgroundColor: 'white', borderRadius: 14, width: 42, height: 42,
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
                        }}>
                        <Plus size={22} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={zoomOut}
                        style={{
                            backgroundColor: 'white', borderRadius: 14, width: 42, height: 42,
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
                        }}>
                        <Minus size={22} color={Colors.primary} />
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

                {/* ── OldActivity count badge ── */}
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

                {/* ── Selected OldActivity Bottom Sheet ── */}
                {selectedActivity && (() => {
                    const activity = filteredActivities.find(a => a.id === selectedActivity);
                    if (!activity) return null;
                    const dist = formatDistance((activity as any).distanceMeters);
                    const CategoryIcon = getCategoryIcon(activity.category);
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
                                <View style={{ width: 88, height: 88, borderRadius: 18, overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                                    {activity.imageUrl
                                        ? <Image source={{ uri: activity.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                        : <View style={{ flex: 1, backgroundColor: `${Colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}><MapPin size={22} color={Colors.primary} /></View>
                                    }
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e1b4b', flex: 1 }} numberOfLines={1}>{activity.title}</Text>
                                        {activity.isUrgent && (
                                            <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                                                <Zap size={13} color="white" />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8 }}>{activity.npoName}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f8f9ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
                                            <CategoryIcon size={12} color={Colors.primary} />
                                            <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '800' }}>{activity.category}</Text>
                                        </View>
                                        {getLegacyActivityMatchSnapshot(activity) > 0 && (
                                            <View style={{ backgroundColor: `${Colors.primary}15`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
                                                <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '800' }}>{getLegacyActivityMatchSnapshot(activity)}% Match</Text>
                                            </View>
                                        )}
                                        {dist && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
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

                {/* ── CalendarPicker for Date chip (range mode) ── */}
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
