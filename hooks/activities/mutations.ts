import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activityKeys } from "./keys";
import { AppActivity, AppActivityApplication, OldReview, OldVolunteerReview } from "../../types";
import { activityService } from "../../services/ActivityService";

async function invalidateActivityQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    options?: { activityId?: string; userId?: string }
) {
    const invalidations = [
        queryClient.invalidateQueries({ queryKey: activityKeys.all }),
    ];

    if (options?.activityId) {
        invalidations.push(
            queryClient.invalidateQueries({ queryKey: activityKeys.detail(options.activityId) })
        );
    }

    if (options?.userId) {
        invalidations.push(
            queryClient.invalidateQueries({ queryKey: activityKeys.applications(options.userId) }),
            queryClient.invalidateQueries({ queryKey: activityKeys.lists(options.userId) }),
            queryClient.invalidateQueries({ queryKey: activityKeys.paginatedLists(options.userId) })
        );
    }

    await Promise.all(invalidations);
}

export function useCreateActivityMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (activityData: Omit<AppActivity, "id">) => activityService.createActivity(activityData),
        onSuccess: async (activity) => {
            await invalidateActivityQueries(queryClient, { activityId: activity.id, userId: activity.npoId });
        },
    });
}

export function useUpdateActivityMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (activity: AppActivity) => activityService.updateActivity(activity),
        onSuccess: async (activity) => {
            await invalidateActivityQueries(queryClient, { activityId: activity.id, userId: activity.npoId });
        },
    });
}

export function useDeleteActivityMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (activityId: string) => activityService.deleteActivity(activityId),
        onSuccess: async (_, activityId) => {
            await invalidateActivityQueries(queryClient, { activityId });
        },
    });
}

export function useEnrollInActivityMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ activityId, message, phone }: { activityId: string; message?: string; phone?: string }) => {
            if (!userId) {
                throw new Error("Missing user id");
            }
            return activityService.joinActivity(activityId, userId, message, phone);
        },
        onSuccess: (_, variables) => {
            void invalidateActivityQueries(queryClient, { activityId: variables.activityId, userId });
        },
    });
}

export function useUnenrollFromActivityMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (activityId: string) => {
            if (!userId) {
                throw new Error("Missing user id");
            }
            await activityService.withdrawApplication(activityId, userId);
            return true;
        },
        onSuccess: async (_, activityId) => {
            await invalidateActivityQueries(queryClient, { activityId, userId });
        },
    });
}

export function useApplyToActivityMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (applicationData: Omit<AppActivityApplication, "id">) => {
            const targetUserId = userId ?? applicationData.volunteerId;
            if (!targetUserId) {
                throw new Error("Missing user id");
            }
            return activityService.submitActivityApplication({
                ...applicationData,
                volunteerId: targetUserId,
            });
        },
        onSuccess: async (_, applicationData) => {
            await invalidateActivityQueries(queryClient, { activityId: applicationData.activityId, userId: userId ?? applicationData.volunteerId });
        },
    });
}

export function useSubmitReviewMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reviewData: Omit<OldReview, "id" | "date"> & { date: string }) => activityService.submitReview(reviewData),
        onSuccess: async (_, variables) => {
            await invalidateActivityQueries(queryClient, { activityId: variables.activityId });
        },
    });
}

export function useSubmitVolunteerReviewsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reviewsData: Omit<OldVolunteerReview, "id" | "date">[]) => activityService.submitVolunteerReviews(reviewsData),
        onSuccess: async () => {
            await invalidateActivityQueries(queryClient);
        },
    });
}

export function useApproveActivityApplicationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ activityId, volunteerId }: { activityId: string; volunteerId: string }) =>
            activityService.updateActivityApplicationStatus(activityId, volunteerId, "APPROVED"),
        onSuccess: async (_, variables) => {
            await invalidateActivityQueries(queryClient, { activityId: variables.activityId });
        },
    });
}

export function useRejectActivityApplicationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ activityId, volunteerId }: { activityId: string; volunteerId: string }) =>
            activityService.updateActivityApplicationStatus(activityId, volunteerId, "REJECTED"),
        onSuccess: async (_, variables) => {
            await invalidateActivityQueries(queryClient, { activityId: variables.activityId });
        },
    });
}
