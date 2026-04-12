import { AppUser, OldSmartMatchResult } from '../../types';

const norm = (value?: string | null) => (value || '').trim().toLowerCase();

function haversineKm(a?: { lat: number; lng: number }, b?: { lat: number; lng: number }) {
    if (!a || !b || !a.lat || !a.lng || !b.lat || !b.lng) return null;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function deriveSmartMatchChips(user: AppUser | null | undefined, activity: any, score: number) {
    const chips: string[] = [];
    const userSkills = (user?.skills || []).map((item: string) => norm(item));
    const activitySkills = (activity?.skills || []).map((item: string) => norm(item));
    const sharedSkills = activitySkills.filter((skill: string) => userSkills.includes(skill));
    if (sharedSkills.length > 0) chips.push(sharedSkills.length > 1 ? 'Competenze utili' : `Skill: ${sharedSkills[0]}`);

    const userInterests = (user?.interests || []).map((item: string) => norm(item));
    const category = norm(activity?.category);
    if (category && userInterests.some((interest: string) => category.includes(interest) || interest.includes(category))) {
        chips.push('In linea coi tuoi interessi');
    }

    const distanceKm = haversineKm(user?.locationCoords, activity?.location?.coords);
    if (distanceKm !== null && distanceKm <= 10) chips.push('Vicino a te');
    else if (distanceKm !== null && distanceKm <= 25) chips.push('Raggiungibile');

    if (activity?.isUrgent) chips.push('Urgente');

    const activityDate = activity?.dateTime ? new Date(activity.dateTime).getTime() : null;
    if (activityDate) {
        const diffDays = (activityDate - Date.now()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 3) chips.push('Nei prossimi giorni');
        else if (diffDays > 3 && diffDays <= 7) chips.push('Questa settimana');
    }

    if (score >= 80) chips.push('Alta compatibilità');
    else if (score >= 65) chips.push('Buon fit');

    return Array.from(new Set(chips)).slice(0, 3);
}

export function deriveSmartMatchConfidence(score: number): Pick<OldSmartMatchResult, 'confidence' | 'confidenceLabel' | 'nextStep'> {
    if (score >= 80) {
        return {
            confidence: 'top',
            confidenceLabel: 'Consiglio di Gemma',
            nextStep: 'Apri e valuta questa per prima',
        };
    }
    if (score >= 65) {
        return {
            confidence: 'good',
            confidenceLabel: 'Vale la pena',
            nextStep: 'Confrontala con le altre opportunità',
        };
    }
    return {
        confidence: 'explore',
        confidenceLabel: 'Da valutare',
        nextStep: 'Potrebbe interessarti se vuoi allargare il raggio',
    };
}

export function rerankSmartMatches(
    matches: OldSmartMatchResult[],
    user: AppUser,
    prefs: {
        hiddenActivityIds: string[];
        savedActivityIds: string[];
        seenActivityIds: string[];
        likedActivityIds: string[];
        likedCategories: string[];
        likedNpoIds: string[];
    },
    relations: { followedNpoIds: Set<string>; affiliatedNpoIds: Set<string> },
    options?: { ignoreHidden?: boolean; excludeEnrolledUserId?: string | null }
) {
    return matches
        .filter((match) => options?.ignoreHidden || !prefs.hiddenActivityIds.includes(match.id))
        .filter((match) => {
            const enrolledUserId = options?.excludeEnrolledUserId;
            if (!enrolledUserId) return true;
            const iscritti = match.activity?.iscritti || [];
            return !iscritti.includes(enrolledUserId);
        })
        .map((match) => {
            const activity = match.activity;
            let adjustedScore = match.score || 0;
            const npoId = activity?.npoId;

            if (prefs.savedActivityIds.includes(match.id)) adjustedScore += 8;
            if (prefs.likedActivityIds.includes(match.id)) adjustedScore += 10;
            if (activity?.category && prefs.likedCategories.includes(activity.category)) adjustedScore += 7;
            if (activity?.npoId && prefs.likedNpoIds.includes(activity.npoId)) adjustedScore += 6;
            if (prefs.seenActivityIds.includes(match.id)) adjustedScore -= 4;
            if (activity?.isUrgent) adjustedScore += 3;
            if (npoId && relations.affiliatedNpoIds.has(npoId)) adjustedScore += 10;
            else if (npoId && relations.followedNpoIds.has(npoId)) adjustedScore += 5;

            const chips = deriveSmartMatchChips(user, activity, adjustedScore);
            const confidence = deriveSmartMatchConfidence(adjustedScore);

            return {
                ...match,
                score: Math.max(0, Math.min(99, Math.round(adjustedScore))),
                chips,
                saved: prefs.savedActivityIds.includes(match.id),
                liked: prefs.likedActivityIds.includes(match.id),
                seen: prefs.seenActivityIds.includes(match.id),
                ...confidence,
            };
        })
        .sort((a, b) => b.score - a.score);
}
