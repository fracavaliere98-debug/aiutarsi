import { useQuery } from "@tanstack/react-query";
import { AppUser } from "../../types";
import { npoService } from "../../services/NPOService";
import { applicationKeys } from "./keys";

async function fetchApplications(user: AppUser) {
    if (user.role === "NPO") {
        return npoService.getApplicationsForNPO(user.id);
    }

    if (user.role === "VOLUNTEER") {
        return npoService.getApplicationsForVolunteer(user.id);
    }

    return [];
}

export function useApplicationsQuery(user?: AppUser | null, enabled = true) {
    return useQuery({
        queryKey: applicationKeys.list(user?.id, user?.role),
        queryFn: () => fetchApplications(user!),
        enabled: enabled && !!user?.id && (user.role === "NPO" || user.role === "VOLUNTEER"),
        staleTime: 30_000,
    });
}
