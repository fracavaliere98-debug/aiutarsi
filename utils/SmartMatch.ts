import { Activity, User } from "../types";

/**
 * Calculates the compatibility percentage between a volunteer and an activity.
 * Criteria:
 * - Interests/Category Match: 35%
 * - Skills Overlap: 40% (Exact match or keyword fallback)
 * - Proximity (Distance): 15%
 * - Urgency: 10%
 */
export const calculateSmartMatch = (user: User | null, activity: Activity): number => {
    if (!user || user.role !== "VOLUNTEER") return 0;

    let score = 0;

    // 1. Interests (35%) - Category Match
    const userInterests = user.interests?.map(i => i.toLowerCase()) || [];
    if (userInterests.includes(activity.category.toLowerCase())) {
        score += 35;
    }

    // 2. Skills (40%) - Skill Overlap + Keywords
    const activitySkills = activity.skills.map(s => s.toLowerCase());
    const userSkills = user.skills?.map(s => s.toLowerCase()) || [];

    // Exact skill match
    const skillsOverlap = userSkills.filter(s => activitySkills.includes(s));
    if (skillsOverlap.length > 0) {
        // Scaled: 1 skill = 20pts, 2+ skills = 40pts
        score += Math.min(40, skillsOverlap.length * 20);
    } else {
        // Fallback: description keyword search
        const description = activity.description.toLowerCase();
        const matchedKeywords = userSkills.filter(skill =>
            description.includes(skill)
        );
        if (matchedKeywords.length > 0) {
            score += 20;
        }
    }

    // 3. Proximity (15%)
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
    } else if (activity.location.address?.toLowerCase()?.includes("bari")) {
        // Fallback for demo data
        score += 10;
    }

    // 4. Urgency
    if (activity.isUrgent) {
        score += 15; // Manual flag bonus
    }

    const actDate = new Date(activity.dateTime);
    const daysUntil = (actDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil > 0 && daysUntil <= 2) {
        score += 10;
    } else if (daysUntil <= 7) {
        score += 5;
    }

    return Math.min(100, score);
};
