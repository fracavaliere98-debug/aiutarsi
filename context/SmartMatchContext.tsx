import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    useMemo,
} from 'react';
import * as Location from 'expo-location';
import { supabase } from '../utils/supabase';
import { GeminiMatch, geminiMatchService } from '../services/GeminiMatchService';
import { activityService } from '../services/ActivityService';
import { useAuth } from './AuthContext';
import { Activity, User } from '../types';

// Helper function for Haversine distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmartMatchContextType {
    matches: GeminiMatch[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    lastUpdated: Date | null;
}

// ── Context ───────────────────────────────────────────────────────────────────
const SmartMatchContext = createContext<SmartMatchContextType>({
    matches: [],
    isLoading: false,
    error: null,
    refresh: async () => { },
    lastUpdated: null,
});

export const useSmartMatch = () => useContext(SmartMatchContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export function SmartMatchProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [matches, setMatches] = useState<GeminiMatch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const isFetchingRef = useRef(false);

    const fetchMatches = useCallback(async () => {
        // Guard: only volunteers with a completed profile
        if (!user || user.role !== 'VOLUNTEER' || !user.profileCompleted) {
            console.log('[SmartMatchContext] Skipping — user:', user?.role, 'profileCompleted:', user?.profileCompleted);
            return;
        }

        // Guard: prevent concurrent fetches
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            // Guard: check if user has an embedding (pgvector)
            if (!user.embedding) {
                console.log('[SmartMatchContext] User has no embedding yet — waiting for auto-generation');
                setError('Analisi del profilo in corso... riprova tra pochi secondi.');
                setIsLoading(false);
                isFetchingRef.current = false;
                return;
            }

            console.log('[SmartMatchContext] Fetching matches via pgvector RPC...');

            // 1. Chiamata all'RPC match_activities del database
            const { data, error: rpcError } = await supabase.rpc('match_activities', {
                query_embedding: user.embedding,
                match_threshold: 0.35,
                match_count: 5,
                user_lat: user.locationCoords?.lat || null,
                user_lng: user.locationCoords?.lng || null
            });

            if (rpcError) throw rpcError;

            // 2. Map RPC results to match the UI interface
            const mappedMatches: GeminiMatch[] = (data || []).map((item: any) => {
                // Spatio-temporal reasoning logic
                let reason = "Alta affinità semantica con il tuo profilo.";
                const reasons: string[] = [];

                // 1. Keyword check (Skills/Interests)
                if (user.skills && item.description) {
                    const matchingSkill = user.skills.find(s =>
                        item.title.toLowerCase().includes(s.toLowerCase()) ||
                        item.description.toLowerCase().includes(s.toLowerCase())
                    );
                    if (matchingSkill) reasons.push(`Match per la tua competenza in ${matchingSkill}`);
                }

                if (user.interests && item.description && reasons.length < 2) {
                    const matchingInterest = user.interests.find(i =>
                        item.title.toLowerCase().includes(i.toLowerCase()) ||
                        item.description.toLowerCase().includes(i.toLowerCase())
                    );
                    if (matchingInterest) reasons.push(`Affinità con il tuo interesse per ${matchingInterest}`);
                }

                // 2. Distance check
                if (user.locationCoords && item.location_lat && item.location_lng) {
                    const dist = calculateDistance(
                        user.locationCoords.lat,
                        user.locationCoords.lng,
                        item.location_lat,
                        item.location_lng
                    );
                    if (dist < 5) {
                        reasons.push("A pochi passi da te");
                    } else if (dist < 15) {
                        reasons.push(`A soli ${dist.toFixed(1)} km da te`);
                    }
                }

                // 3. Time check
                if (item.date_start) {
                    const start = new Date(item.date_start);
                    const now = new Date();
                    const diffDays = (start.getTime() - now.getTime()) / (1000 * 3600 * 24);
                    if (diffDays > 0 && diffDays < 3) {
                        reasons.push("Ideale per questa settimana");
                    }
                }

                if (reasons.length > 0) {
                    reason = reasons.slice(0, 2).join(" • ");
                }

                return {
                    id: item.id,
                    score: item.match_percentage, // Use the weighted percentage from RPC
                    reason: reason, // Dynamic reason
                    activity: {
                        id: item.id,
                        npoId: item.npo_id,
                        npoName: item.npo_name || "Organizzazione",
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        dateTime: item.date_start, // Map date_start to dateTime
                        endDateTime: item.date_end,
                        location: {
                            address: item.location_address,
                            coords: {
                                lat: item.location_lat,
                                lng: item.location_lng
                            }
                        },
                        imageUrl: item.image_url,
                        isUrgent: item.is_urgent,
                        status: item.status,
                        matchPercentage: Math.round(item.similarity * 100),
                        // Default values for fields not returned by RPC but expected by Activity type
                        iscritti: [],
                        slots: 0,
                        skills: []
                    } as Activity
                };
            });

            console.log(`[SmartMatchContext] Found ${mappedMatches.length} semantic matches`);
            setMatches(mappedMatches);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error('[SmartMatchContext] Error fetching matches:', err);
            setError('Impossibile caricare i suggerimenti. Riprova tra poco.');
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [user]);

    // Invalidate cache and refetch on refresh
    const refresh = useCallback(async () => {
        if (user?.id) {
            await geminiMatchService.invalidateCache(user.id);
        }
        await fetchMatches();
    }, [user?.id, fetchMatches]);

    // Auto-fetch when a volunteer user loads the context
    useEffect(() => {
        if (user?.role === 'VOLUNTEER' && user?.profileCompleted) {
            fetchMatches();
        }
    }, [user?.id, user?.role, user?.profileCompleted]);

    // Re-fetch when the volunteer updates their bio/skills/interests
    const profileKey = [user?.bio, user?.skills?.join(','), user?.interests?.join(',')].join('|');
    const prevProfileKey = useRef(profileKey);
    useEffect(() => {
        if (prevProfileKey.current !== profileKey && user?.role === 'VOLUNTEER') {
            prevProfileKey.current = profileKey;
            // Invalidate cache so the update triggers a fresh AI call
            if (user?.id) geminiMatchService.invalidateCache(user.id);
            fetchMatches();
        }
    }, [profileKey]);

    const value = useMemo(
        () => ({ matches, isLoading, error, refresh, lastUpdated }),
        [matches, isLoading, error, refresh, lastUpdated]
    );

    return (
        <SmartMatchContext.Provider value={value}>
            {children}
        </SmartMatchContext.Provider>
    );
}
