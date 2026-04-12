export const smartMatchKeys = {
    all: ['smart-match'] as const,
    lists: () => [...smartMatchKeys.all, 'lists'] as const,
    list: (userId?: string, profileFingerprint?: string) =>
        [...smartMatchKeys.lists(), userId ?? 'anonymous', profileFingerprint ?? 'default'] as const,
    activity: (userId: string | undefined, activityId: string, profileFingerprint?: string) =>
        [...smartMatchKeys.all, 'activity', userId ?? 'anonymous', activityId, profileFingerprint ?? 'default'] as const,
    activityScores: (userId?: string, activityIds?: string[], profileFingerprint?: string) =>
        [
            ...smartMatchKeys.all,
            'activity-scores',
            userId ?? 'anonymous',
            profileFingerprint ?? 'default',
            ...(activityIds ?? []),
        ] as const,
};
