/**
 * Avviso "attivita' con pochi iscritti" della home dell'ente (02/11/2026, decisione di Francesco):
 * porta dritto all'invito, non al report. Logica pura, senza UI.
 */

/** Stessa finestra del "Salvataggio Last Minute" (hooks/useNPOInsights.ts): i follower si invitano solo entro 48 ore (D08). */
export const LAST_MINUTE_HOURS = 48;

export function isLastMinute(dateTime: string | undefined, now: Date = new Date()): boolean {
    if (!dateTime) return false;
    const start = new Date(dateTime).getTime();
    if (Number.isNaN(start)) return false;
    const hours = (start - now.getTime()) / 3_600_000;
    return hours > 0 && hours < LAST_MINUTE_HOURS;
}

/** Scheda attivita' con la finestra "Invita i tuoi volontari" gia' aperta. */
export function inviteVolunteersHref(activityId: string): string {
    return `/activity/${activityId}?invite=volunteers`;
}

/** Salvataggio Last Minute: tab Follower con l'attivita' da rinforzare. */
export function inviteFollowersRoute(activityId: string) {
    return { pathname: "/(npo)/(tabs)/volunteers", params: { tab: "FOLLOWERS", activityMatch: activityId } } as const;
}
