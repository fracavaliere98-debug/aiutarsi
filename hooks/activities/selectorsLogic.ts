/**
 * Logica pura (nessun hook, nessun react-query) estratta dai calcoli dentro gli useMemo di
 * hooks/activities/selectors.ts per poterla testare in Node puro. Comportamento invariato,
 * solo isolato per essere testabile (vedi scripts/test_activities_selectors_contract.ts).
 */
import type { AppActivity, AppUser, OldReview } from "../../types";

export interface VolunteerStats {
    totalHours: number;
    completedMissions: number;
    activeMissions: number;
    upcomingMissions: number;
}

const EMPTY_VOLUNTEER_STATS: VolunteerStats = {
    totalHours: 0,
    completedMissions: 0,
    activeMissions: 0,
    upcomingMissions: 0,
};

/**
 * Statistiche volontario: ore totali (solo su attività completate, calcolate dalla durata
 * dateTime→endDateTime), conteggio missioni per stato. Solo il ruolo VOLUNTEER ha statistiche;
 * chiunque altro (incluso "non ancora caricato") ottiene tutti zeri.
 */
export function computeVolunteerStats(activities: AppActivity[], user: AppUser | null | undefined): VolunteerStats {
    if (!user || user.role !== "VOLUNTEER") {
        return EMPTY_VOLUNTEER_STATS;
    }

    const myActivities = activities.filter((activity) => activity.iscritti.includes(user.id));
    const completed = myActivities.filter((activity) => activity.status === "COMPLETATA");
    const active = myActivities.filter((activity) => activity.status === "IN_CORSO");
    const upcoming = myActivities.filter((activity) => activity.status === "APERTA");
    const totalHours = completed.reduce((sum, activity) => {
        const start = new Date(activity.dateTime).getTime();
        const end = new Date(activity.endDateTime).getTime();
        const durationHours = (end - start) / (1000 * 60 * 60);
        return sum + (isNaN(durationHours) ? 0 : durationHours);
    }, 0);

    return {
        totalHours: Math.round(totalHours),
        completedMissions: completed.length,
        activeMissions: active.length,
        upcomingMissions: upcoming.length,
    };
}

export function filterReviewsByVolunteer(reviews: OldReview[], userId: string | undefined): OldReview[] {
    return userId ? reviews.filter((review) => review.volunteerId === userId) : [];
}

/** Media stelle di un ente, arrotondata a 1 decimale; 0 se l'ente non ha ancora recensioni. */
export function computeNPORating(reviews: OldReview[], npoId: string | undefined): number {
    if (!npoId) return 0;
    const npoReviews = reviews.filter((review) => review.npoId === npoId);
    if (npoReviews.length === 0) return 0;
    const sum = npoReviews.reduce((acc, review) => acc + review.stars, 0);
    return parseFloat((sum / npoReviews.length).toFixed(1));
}

export function filterActivitiesByOwner(activities: AppActivity[], userId: string | undefined): AppActivity[] {
    return userId ? activities.filter((activity) => activity.npoId === userId) : [];
}
