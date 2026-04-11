import { ActivityFilters } from "./types";

const ANONYMOUS_USER_KEY = "anonymous";

export const activityKeys = {
    all: ["activities"] as const,
    lists: (userId?: string) => [...activityKeys.all, "list", userId ?? ANONYMOUS_USER_KEY] as const,
    list: (userId?: string) => [...activityKeys.lists(userId), "all"] as const,
    paginatedLists: (userId?: string) => [...activityKeys.all, "paginated-list", userId ?? ANONYMOUS_USER_KEY] as const,
    paginatedList: (userId: string | undefined, filters: ActivityFilters) => [...activityKeys.paginatedLists(userId), filters] as const,
    details: () => [...activityKeys.all, "detail"] as const,
    detail: (activityId: string) => [...activityKeys.details(), activityId] as const,
    reviews: () => [...activityKeys.all, "reviews"] as const,
    volunteerReviews: () => [...activityKeys.all, "volunteer-reviews"] as const,
    applications: (userId?: string) => [...activityKeys.all, "applications", userId ?? ANONYMOUS_USER_KEY] as const,
};
