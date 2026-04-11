const ANONYMOUS_USER_KEY = "anonymous";
const UNKNOWN_ROLE_KEY = "unknown";

export const applicationKeys = {
    all: ["applications"] as const,
    lists: (userId?: string, role?: string) => [
        ...applicationKeys.all,
        "list",
        userId ?? ANONYMOUS_USER_KEY,
        role ?? UNKNOWN_ROLE_KEY,
    ] as const,
    list: (userId?: string, role?: string) => [...applicationKeys.lists(userId, role), "all"] as const,
};
