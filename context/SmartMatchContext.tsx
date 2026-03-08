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
import { activityService } from '../services/ActivityService';
import { useAuth } from './AuthContext';
import { OldActivity, OldUser, OldSmartMatchResult } from '../types';

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
    matches: OldSmartMatchResult[];
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
    const [matches, setMatches] = useState<OldSmartMatchResult[]>([]);
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
            console.log('[SmartMatchContext] Fetching matches via unified ActivityService...');

            // 1. Chiamata al servizio (che usa get_activities_with_match sotto cofano)
            const { activities } = await activityService.getActivities({
                userId: user.id,
                limit: 15, // buffer in caso alcune siano già prenotate
                centerLat: user.locationCoords?.lat || undefined,
                centerLng: user.locationCoords?.lng || undefined,
                statuses: ['APERTA', 'IN_CORSO'],
            });

            // 2. Filtriamo le attività a cui è già iscritto
            const { data: enrollments } = await supabase
                .from('activity_participants')
                .select('activity_id')
                .eq('user_id', user.id);

            const enrolledIds = new Set((enrollments || []).map(e => e.activity_id));

            // 3. Mappiamo nel formato atteso dalla UI (generando la 'reason')
            const mappedMatches: OldSmartMatchResult[] = activities
                .filter(a => !enrolledIds.has(a.id))
                .slice(0, 5) // prendiamo le migliori 5
                .map((a: any) => {
                    let reason = "Alta affinità con il tuo profilo.";
                    const reasons: string[] = [];

                    if (user.skills && a.description) {
                        const matchingSkill = user.skills.find(s =>
                            a.title.toLowerCase().includes(s.toLowerCase()) ||
                            a.description.toLowerCase().includes(s.toLowerCase())
                        );
                        if (matchingSkill) reasons.push(`Competenza in ${matchingSkill}`);
                    }
                    if (user.interests && user.interests.includes(a.category) && reasons.length < 2) {
                        reasons.push(`Interesse per ${a.category}`);
                    }
                    if (user.locationCoords && a.location?.coords?.lat) {
                        const dist = calculateDistance(user.locationCoords.lat, user.locationCoords.lng, a.location.coords.lat, a.location.coords.lng);
                        if (dist < 5) reasons.push("A pochi passi");
                        else if (dist < 15) reasons.push(`A ${dist.toFixed(0)} km`);
                    }
                    if (a.isUrgent) reasons.push("Ubicazione Urgente");

                    if (reasons.length > 0) reason = reasons.slice(0, 2).join(" • ");

                    return {
                        id: a.id,
                        score: a.matchPercentage || 0,
                        reason: reason,
                        // AppActivity is backwards compatible enough for what SmartMatchCarousel needs
                        activity: a as any
                    };
                });

            console.log(`[SmartMatchContext] Found ${mappedMatches.length} unified matches.`);
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
        await fetchMatches();
    }, [fetchMatches]);

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
