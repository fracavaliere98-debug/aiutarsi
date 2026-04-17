export const gamificationKeys = {
    all: ["gamification"] as const,
    state: (userId?: string) => [...gamificationKeys.all, "state", userId ?? "anonymous"] as const,
};
