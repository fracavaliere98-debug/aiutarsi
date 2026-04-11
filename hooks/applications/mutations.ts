import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppUser, OldApplication } from "../../types";
import { npoService } from "../../services/NPOService";
import { applicationKeys } from "./keys";
import { useAddNotificationMutation } from "../notifications/mutations";

async function invalidateApplicationQueries(
    queryClient: ReturnType<typeof useQueryClient>,
    options?: { userId?: string; role?: string }
) {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        ...(options?.userId
            ? [queryClient.invalidateQueries({ queryKey: applicationKeys.list(options.userId, options.role) })]
            : []),
    ]);
}

export function useApplyToNPOMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();
    const addNotificationMutation = useAddNotificationMutation();

    return useMutation({
        mutationFn: async ({ npoId, npoName, message }: { npoId: string; npoName: string; message: string }) => {
            if (!user || user.role !== "VOLUNTEER") {
                throw new Error("Unauthorized");
            }

            const application = await npoService.submitApplication({
                npoId,
                npoName,
                volunteerId: user.id,
                volunteerName: user.name,
                volunteerAvatar: user.avatar,
                message,
                skills: user.skills || [],
                status: "PENDING",
                appliedDate: new Date().toISOString(),
            });

            await addNotificationMutation.mutateAsync({
                userId: npoId,
                type: "APPLICATION_RECEIVED",
                title: "Nuova Candidatura! 📋",
                message: `${user.name} si è candidato come volontario`,
                applicationId: application.id,
                npoId,
            });

            return application;
        },
        onSuccess: async () => {
            await invalidateApplicationQueries(queryClient, { userId: user?.id, role: user?.role });
        },
    });
}

export function useApproveApplicationMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();
    const addNotificationMutation = useAddNotificationMutation();

    return useMutation({
        mutationFn: async (application: OldApplication) => {
            if (!user || user.role !== "NPO" || application.npoId !== user.id) {
                throw new Error("Invalid application");
            }

            await npoService.updateApplicationStatus(application.id, "APPROVED");
            await addNotificationMutation.mutateAsync({
                userId: application.volunteerId,
                type: "APPLICATION_APPROVED",
                title: "Candidatura Approvata! 🎉",
                message: `${application.npoName} ha approvato la tua candidatura`,
                applicationId: application.id,
                npoId: application.npoId,
            });

            return true;
        },
        onSuccess: async () => {
            await invalidateApplicationQueries(queryClient, { userId: user?.id, role: user?.role });
        },
    });
}

export function useRejectApplicationMutation(user?: AppUser | null) {
    const queryClient = useQueryClient();
    const addNotificationMutation = useAddNotificationMutation();

    return useMutation({
        mutationFn: async (application: OldApplication) => {
            if (!user || user.role !== "NPO" || application.npoId !== user.id) {
                throw new Error("Invalid application");
            }

            await npoService.updateApplicationStatus(application.id, "REJECTED");
            await addNotificationMutation.mutateAsync({
                userId: application.volunteerId,
                type: "APPLICATION_REJECTED",
                title: "Candidatura Rifiutata",
                message: `${application.npoName} ha rifiutato la tua candidatura`,
                applicationId: application.id,
                npoId: application.npoId,
            });

            return true;
        },
        onSuccess: async () => {
            await invalidateApplicationQueries(queryClient, { userId: user?.id, role: user?.role });
        },
    });
}

export function useResetApplicationsQueryState(user?: AppUser | null) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await queryClient.setQueryData(applicationKeys.list(user?.id, user?.role), []);
        },
    });
}
