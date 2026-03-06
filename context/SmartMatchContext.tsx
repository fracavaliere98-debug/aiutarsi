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
            // Guard: check if user has an embedding (pgvector)
            if (!user.embedding) {
                console.log('[SmartMatchContext] OldUser has no embedding yet — waiting for auto-generation');
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
            const mappedMatches: OldSmartMatchResult[] = (data || []).map((item: any) => {
                // ... same mapping logic as before ...
                let reason = "Alta affinità semantica con il tuo profilo.";
                const reasons: string[] = [];
                // ... (rest of the mapping logic) ...
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
                if (user.locationCoords && item.location_lat && item.location_lng) {
                    const dist = calculateDistance(user.locationCoords.lat, user.locationCoords.lng, item.location_lat, item.location_lng);
                    if (dist < 5) reasons.push("A pochi passi da te");
                    else if (dist < 15) reasons.push(`A soli ${dist.toFixed(1)} km da te`);
                }
                if (item.date_start) {
                    const start = new Date(item.date_start);
                    const now = new Date();
                    const diffDays = (start.getTime() - now.getTime()) / (1000 * 3600 * 24);
                    if (diffDays > 0 && diffDays < 3) reasons.push("Ideale per questa settimana");
                }
                if (reasons.length > 0) reason = reasons.slice(0, 2).join(" • ");

                return {
                    id: item.id,
                    score: item.match_percentage,
                    reason: reason,
                    activity: {
                        id: item.id,
                        npoId: item.npo_id,
                        npoName: item.npo_name || "Organizzazione",
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        dateTime: item.date_start,
                        endDateTime: item.date_end,
                        location: {
                            address: item.location_address,
                            coords: { lat: item.location_lat, lng: item.location_lng }
                        },
                        imageUrl: item.image_url,
                        isUrgent: item.is_urgent,
                        status: item.status,
                        matchPercentage: Math.round(item.similarity * 100),
                        iscritti: [],
                        slots: 0,
                        skills: []
                    } as OldActivity
                };
            });

            // 3. Filter out activities the user is already enrolled in
            const { data: enrollments } = await supabase
                .from('activity_participants')
                .select('activity_id')
                .eq('user_id', user.id);

            const enrolledIds = new Set((enrollments || []).map(e => e.activity_id));

            // 4. Get completed categories for weighting boost
            const { data: completedActivities } = await supabase
                .from('activity_participants')
                .select('activities(category)')
                .eq('user_id', user.id)
                .eq('status', 'COMPLETATA');

            const completedCategories = new Set(
                (completedActivities || [])
                    .map((ca: any) => ca.activities?.category)
                    .filter(Boolean)
            );

            const finalMatches: OldSmartMatchResult[] = mappedMatches
                .filter(m => !enrolledIds.has(m.id))
                .map(m => {
                    const activity = m.activity;
                    if (!activity) return m;

                    // Boost similarity if category matches a completed one
                    let boostedScore = activity.matchPercentage || 50;
                    if (activity.category && completedCategories.has(activity.category)) {
                        boostedScore = Math.min(99, Math.round(boostedScore * 1.15));
                        return {
                            ...m,
                            activity: {
                                ...activity,
                                matchPercentage: boostedScore
                            } as OldActivity,
                            reason: `Visto il tuo interesse passato per ${activity.category} • ${m.reason}`
                        };
                    }
                    return m;
                })
                .sort((a, b) => (b.activity?.matchPercentage || 0) - (a.activity?.matchPercentage || 0));

            console.log(`[SmartMatchContext] Found ${mappedMatches.length} semantic matches, boosted ${completedCategories.size} categories, filtered to ${finalMatches.length}`);
            setMatches(finalMatches);
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
