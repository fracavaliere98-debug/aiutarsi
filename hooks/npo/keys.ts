const ANONYMOUS_NPO_KEY = "anonymous";

export const npoFollowerKeys = {
    all: ["npo-followers"] as const,
    list: (npoId?: string) => [...npoFollowerKeys.all, npoId ?? ANONYMOUS_NPO_KEY] as const,
};

/** Inviti mirati alle attività (tabella npo_activity_invites) e volontari consigliati (D08). */
export const npoInviteKeys = {
    all: ["npo-activity-invites"] as const,
    mine: (npoId?: string) => [...npoInviteKeys.all, "mine", npoId ?? ANONYMOUS_NPO_KEY] as const,
    suggested: (activityId?: string) => [...npoInviteKeys.all, "suggested", activityId ?? "none"] as const,
};
