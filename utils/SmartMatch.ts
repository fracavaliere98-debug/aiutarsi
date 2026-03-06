import { OldActivity, OldUser } from "../types";

/**
 * Calculates the compatibility percentage between a volunteer and an activity.
 * Criteria:
 * - Interests/Category Match: 35%
 * - Skills Overlap: 40% (Exact match or keyword fallback)
 * - Proximity (Distance): 15%
 * - Urgency: 10%
 */
export const calculateSmartMatch = (user: OldUser | null, activity: OldActivity, semanticSimilarity?: number): number => {
    if (!user || user.role !== "VOLUNTEER") return 0;

    let score = 0;

    // 1. Semantic Similarity (75%) - IF PROVIDED
    if (semanticSimilarity !== undefined) {
        score += (semanticSimilarity * 75);
    } else {
        // Legacy fallback (Explore tab logic)
        let legacySemanticScore = 0;

        // Interests (35%)
        const userInterests = user.interests?.map(i => i.toLowerCase()) || [];
        if (userInterests.includes(activity.category.toLowerCase())) {
            legacySemanticScore += 35;
        }

        // Skills (40%)
        const activitySkills = activity.skills?.map(s => s.toLowerCase()) || [];
        const userSkills = user.skills?.map(s => s.toLowerCase()) || [];
        const skillsOverlap = userSkills.filter(s => activitySkills.includes(s));

        if (skillsOverlap.length > 0) {
            legacySemanticScore += Math.min(40, skillsOverlap.length * 20);
        } else {
            const description = activity.description?.toLowerCase() || "";
            if (userSkills.some(skill => description.includes(skill))) {
                legacySemanticScore += 20;
            }
        }
        score += legacySemanticScore;
    }

    // 2. Proximity (15%)
    if (user.locationCoords && activity.location.coords) {
        const R = 6371; // km
        const dLat = (activity.location.coords.lat - user.locationCoords.lat) * Math.PI / 180;
        const dLon = (activity.location.coords.lng - user.locationCoords.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(user.locationCoords.lat * Math.PI / 180) * Math.cos(activity.location.coords.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance < 5) score += 15;
        else if (distance < 15) score += 10;
        else if (distance < 50) score += 5;
    }

    // 3. Urgency/Time (10%)
    if (activity.isUrgent) {
        score += 6;
    }

    if (activity.dateTime) {
        const actDate = new Date(activity.dateTime);
        const diffDays = (actDate.getTime() - Date.now()) / (1000 * 3600 * 24);
        if (diffDays > 0 && diffDays <= 2) {
            score += 4;
        } else if (diffDays <= 7) {
            score += 2;
        }
    }

    return Math.round(Math.min(100, score));
};
