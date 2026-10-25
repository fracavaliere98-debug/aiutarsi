import { useMemo } from "react";
import { AppUser, SharedContact } from "../../types";
import { useApplicationsQuery, useSharedContactsQuery } from "./queries";

const EMPTY_APPLICATIONS: any[] = [];

export function useApplicationsDomain(user?: AppUser | null) {
    const query = useApplicationsQuery(user);
    const applications = query.data ?? EMPTY_APPLICATIONS;

    return {
        applications,
        refreshApplications: async () => {
            await query.refetch();
        },
        isLoading: query.isLoading,
        isError: query.isError,
    };
}

export function useNPOApplications(user?: AppUser | null, npoId?: string) {
    const { applications } = useApplicationsDomain(user);

    return useMemo(
        () => (npoId ? applications.filter((application) => application.npoId === npoId) : []),
        [applications, npoId]
    );
}

export function useVolunteerApplications(user?: AppUser | null, volunteerId?: string) {
    const { applications } = useApplicationsDomain(user);

    return useMemo(
        () => (volunteerId ? applications.filter((application) => application.volunteerId === volunteerId) : []),
        [applications, volunteerId]
    );
}

export function useHasAppliedToNPO(user?: AppUser | null, npoId?: string) {
    const { applications } = useApplicationsDomain(user);

    return useMemo(() => {
        if (!user?.id || !npoId) return false;
        return applications.some(
            (application) =>
                application.volunteerId === user.id &&
                application.npoId === npoId &&
                (application.status === "PENDING" || application.status === "APPROVED")
        );
    }, [applications, npoId, user?.id]);
}

const EMPTY_SHARED_CONTACTS: SharedContact[] = [];

/** Contatti condivisi con l'ente (email/telefono scelti dal volontario). Solo per l'ente verificato destinatario. */
export function useSharedContacts(user?: AppUser | null) {
    const query = useSharedContactsQuery(user);

    return {
        contacts: query.data ?? EMPTY_SHARED_CONTACTS,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
    };
}
