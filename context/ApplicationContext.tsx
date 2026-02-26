import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";
import { useGamification } from "./GamificationContext";
import { Application } from "../types";
import { npoService } from "../services/NPOService";

interface ApplicationContextType {
    applications: Application[];
    applyToNPO: (npoId: string, npoName: string, message: string) => Promise<boolean>;
    approveApplication: (applicationId: string) => Promise<boolean>;
    rejectApplication: (applicationId: string) => Promise<boolean>;
    getNPOApplications: (npoId: string) => Application[];
    getVolunteerApplications: (volunteerId: string) => Application[];
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
    const [applications, setApplications] = useState<Application[]>([]);
    const { user } = useAuth();
    const { addNotification } = useNotifications();

    // Load applications from Service based on User Role
    useEffect(() => {
        const loadApplications = async () => {
            if (!user) {
                setApplications([]);
                return;
            }

            try {
                let fetchedApps: Application[] = [];
                if (user.role === 'NPO') {
                    fetchedApps = await npoService.getApplicationsForNPO(user.id);
                } else if (user.role === 'VOLUNTEER') {
                    fetchedApps = await npoService.getApplicationsForVolunteer(user.id);
                }
                setApplications(fetchedApps);
            } catch (error) {
                console.error("Failed to load applications:", error);
            }
        };
        loadApplications();
    }, [user]); // Re-run when user changes

    // Gamification: Watch for approved applications
    const { handleNPOEnrollment, isLoaded: isGamificationLoaded } = useGamification();

    useEffect(() => {
        if (!user || user.role !== "VOLUNTEER" || !isGamificationLoaded) return;

        applications.forEach(app => {
            if (app.volunteerId === user.id && app.status === "APPROVED") {
                handleNPOEnrollment(app.npoId);
            }
        });
    }, [applications, user, handleNPOEnrollment, isGamificationLoaded]);

    // Volunteer applies to NPO
    const applyToNPO = useCallback(async (npoId: string, npoName: string, message: string): Promise<boolean> => {
        if (!user || user.role !== "VOLUNTEER") return false;

        try {
            // Check if already applied (PENDING or APPROVED)
            const existingApp = applications.find(
                a => a.volunteerId === user.id && a.npoId === npoId && (a.status === "PENDING" || a.status === "APPROVED")
            );
            if (existingApp) return false;

            const newApplication: Application = {
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
            setApplications(prev => [...prev, newApplication]);

            // Send notification to NPO
            addNotification({
                userId: npoId,
                type: "APPLICATION_RECEIVED",
                title: "Nuova Candidatura! 📋",
                message: `${user.name} si è candidato come volontario`,
                applicationId: newApplication.id,
            });

            return true;
        } catch (error) {
            console.error("Apply to NPO failed:", error);
            return false;
        }
    }, [user, applications, addNotification]);

    // NPO approves application
    const approveApplication = useCallback(async (applicationId: string): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;

        try {
            const app = applications.find(a => a.id === applicationId);
            if (!app || app.npoId !== user.id) return false;

            await npoService.updateApplicationStatus(applicationId, "APPROVED");

            setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status: "APPROVED" } : a));

            // Send notification to volunteer
            addNotification({
                userId: app.volunteerId,
                type: "APPLICATION_APPROVED",
                title: "Candidatura Approvata! 🎉",
                message: `${app.npoName} ha approvato la tua candidatura`,
                npoId: app.npoId,
            });

            return true;
        } catch (error) {
            console.error("Approve application failed:", error);
            return false;
        }
    }, [user, applications, addNotification]);

    // NPO rejects application
    const rejectApplication = useCallback(async (applicationId: string): Promise<boolean> => {
        if (!user || user.role !== "NPO") return false;

        try {
            const app = applications.find(a => a.id === applicationId);
            if (!app || app.npoId !== user.id) return false;

            await npoService.updateApplicationStatus(applicationId, "REJECTED");

            setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status: "REJECTED" } : a));

            // Send notification to volunteer
            addNotification({
                userId: app.volunteerId,
                type: "APPLICATION_REJECTED",
                title: "Candidatura Rifiutata",
                message: `${app.npoName} ha rifiutato la tua candidatura`,
                npoId: app.npoId,
            });

            return true;
        } catch (error) {
            console.error("Reject application failed:", error);
            return false;
        }
    }, [user, applications, addNotification]);

    // Get applications for a specific NPO
    const getNPOApplications = useCallback((npoId: string): Application[] => {
        return applications.filter(a => a.npoId === npoId);
    }, [applications]);

    // Get applications for a specific volunteer
    const getVolunteerApplications = useCallback((volunteerId: string): Application[] => {
        return applications.filter(a => a.volunteerId === volunteerId);
    }, [applications]);

    // Check if volunteer has already applied to NPO
    const hasAppliedToNPO = useCallback((volunteerId: string, npoId: string): boolean => {
        return applications.some(
            a => a.volunteerId === volunteerId && a.npoId === npoId && (a.status === "PENDING" || a.status === "APPROVED")
        );
    }, [applications]);

    const resetApplications = useCallback(async () => {
        try {
            // Manual storage clear logic as service doesn't expose clear (assuming debug)
            // We can use the service adapter if we want, or just accept that "Reset" is limited.
            // But actually, MockData reset in NPOService is not exposed.
            // I'll keep the local setApplications([]) and maybe warn user.
            setApplications([]);
            alert("Reset applications currently only clears local state in this debug version.");
        } catch (error) {
            console.error("Failed to reset applications:", error);
        }
    }, []);

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
