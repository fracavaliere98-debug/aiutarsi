import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { OldApplication } from "../types";
import { npoService } from "../services/NPOService";

interface ApplicationContextType {
    applications: OldApplication[];
    applyToNPO: (npoId: string, npoName: string, message: string) => Promise<boolean>;
    approveApplication: (applicationId: string) => Promise<boolean>;
    rejectApplication: (applicationId: string) => Promise<boolean>;
    getNPOApplications: (npoId: string) => OldApplication[];
    getVolunteerApplications: (volunteerId: string) => OldApplication[];
    hasAppliedToNPO: (volunteerId: string, npoId: string) => boolean;
    resetApplications: () => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextType>({
    applications: [],
    applyToNPO: async () => false,
    approveApplication: async () => false,
    rejectApplication: async () => false,
    getNPOApplications: () => [],
    getVolunteerApplications: () => [],
    hasAppliedToNPO: () => false,
    resetApplications: async () => { },
});

export const useApplications = () => useContext(ApplicationContext);

export const ApplicationProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const queryClient = useQueryClient();

    // Migrato a useQuery
    const { data: applications = [] } = useQuery({
        queryKey: ['applications', user?.id],
        enabled: !!user?.id,
        queryFn: async () => {
            if (user!.role === 'NPO') {
                return npoService.getApplicationsForNPO(user!.id);
            } else if (user!.role === 'VOLUNTEER') {
                return npoService.getApplicationsForVolunteer(user!.id);
            }
            return [];
        },
        staleTime: 30_000,
    });

    // Migrato a useMutation
    const applyToNPOMutation = useMutation({
        mutationFn: async ({ npoId, npoName, message }: { npoId: string, npoName: string, message: string }) => {
            if (!user || user.role !== "VOLUNTEER") throw new Error("Unauthorized");
            const newApplication: OldApplication = {
                id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                npoId,
                npoName,
                volunteerId: user.id,
                volunteerName: user.name,
                volunteerAvatar: user.avatar,
                message,
                skills: user.skills || [],
                status: "PENDING",
                appliedDate: new Date().toISOString(),
            };
            await npoService.submitApplication(newApplication);

            addNotification({
                userId: npoId,
                type: "APPLICATION_RECEIVED",
                title: "Nuova Candidatura! 📋",
                message: `${user.name} si è candidato come volontario`,
                applicationId: newApplication.id,
            });
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
    });

    const approveMutation = useMutation({
        mutationFn: async (applicationId: string) => {
            const app = applications.find(a => a.id === applicationId);
            if (!app || app.npoId !== user?.id) throw new Error("Invalid app");
            await npoService.updateApplicationStatus(applicationId, "APPROVED");
            addNotification({
                userId: app.volunteerId,
                type: "APPLICATION_APPROVED",
                title: "Candidatura Approvata! 🎉",
                message: `${app.npoName} ha approvato la tua candidatura`,
                npoId: app.npoId,
            });
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async (applicationId: string) => {
            const app = applications.find(a => a.id === applicationId);
            if (!app || app.npoId !== user?.id) throw new Error("Invalid app");
            await npoService.updateApplicationStatus(applicationId, "REJECTED");
            addNotification({
                userId: app.volunteerId,
                type: "APPLICATION_REJECTED",
                title: "Candidatura Rifiutata",
                message: `${app.npoName} ha rifiutato la tua candidatura`,
                npoId: app.npoId,
            });
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
    });

    const applyToNPO = useCallback(async (npoId: string, npoName: string, message: string) => {
        try {
            return await applyToNPOMutation.mutateAsync({ npoId, npoName, message });
        } catch { return false; }
    }, [applyToNPOMutation]);

    const approveApplication = useCallback(async (applicationId: string) => {
        try {
            return await approveMutation.mutateAsync(applicationId);
        } catch { return false; }
    }, [approveMutation]);

    const rejectApplication = useCallback(async (applicationId: string) => {
        try {
            return await rejectMutation.mutateAsync(applicationId);
        } catch { return false; }
    }, [rejectMutation]);

    const getNPOApplications = useCallback((npoId: string) => applications.filter(a => a.npoId === npoId), [applications]);
    const getVolunteerApplications = useCallback((volunteerId: string) => applications.filter(a => a.volunteerId === volunteerId), [applications]);
    const hasAppliedToNPO = useCallback((volunteerId: string, npoId: string) => applications.some(a => a.volunteerId === volunteerId && a.npoId === npoId && (a.status === "PENDING" || a.status === "APPROVED")), [applications]);
    const resetApplications = useCallback(async () => {
        queryClient.setQueryData(['applications', user?.id], []);
    }, [queryClient, user]);

    const value = {
        applications,
        applyToNPO,
        approveApplication,
        rejectApplication,
        getNPOApplications,
        getVolunteerApplications,
        hasAppliedToNPO,
        resetApplications,
    };

    return (
        <ApplicationContext.Provider value={value}>
            {children}
        </ApplicationContext.Provider>
    );
};
