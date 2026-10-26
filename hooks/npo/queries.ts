import { useQuery } from "@tanstack/react-query";
import { npoService } from "../../services/NPOService";
import { npoFollowerKeys, npoInviteKeys } from "./keys";

export function useNPOFollowersQuery(npoId?: string) {
    return useQuery({
        queryKey: npoFollowerKeys.list(npoId),
        queryFn: () => npoService.getFollowers(npoId!),
        enabled: !!npoId,
        staleTime: 30_000,
    });
}

/** Inviti mirati già mandati dall'ente (tutte le sue attività). */
export function useMyActivityInvitesQuery(npoId?: string) {
    return useQuery({
        queryKey: npoInviteKeys.mine(npoId),
        queryFn: () => npoService.getMyActivityInvites(),
        enabled: !!npoId,
        staleTime: 30_000,
    });
}

/** Volontari consigliati per una attività; si carica solo quando la modale è aperta. */
export function useSuggestedVolunteersQuery(activityId?: string, enabled = true) {
    return useQuery({
        queryKey: npoInviteKeys.suggested(activityId),
        queryFn: () => npoService.getSuggestedVolunteers(activityId!),
        enabled: !!activityId && enabled,
        staleTime: 15_000,
    });
}
