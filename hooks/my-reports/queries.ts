import { useQuery } from "@tanstack/react-query";
import { myReportsService } from "../../services/MyReportsService";
import { myReportsKeys } from "./keys";

/** A40: segnalazioni fatte dall'utente con l'esito neutro. Si rilegge all'apertura della schermata. */
export function useMyReportsQuery(userId?: string) {
    return useQuery({
        queryKey: myReportsKeys.list(userId),
        queryFn: () => myReportsService.getMyReports(),
        enabled: !!userId,
        staleTime: 0,
    });
}
