import { useQuery } from "@tanstack/react-query";
import { npoService } from "../../services/NPOService";
import { npoFollowerKeys } from "./keys";

export function useNPOFollowersQuery(npoId?: string) {
    return useQuery({
        queryKey: npoFollowerKeys.list(npoId),
        queryFn: () => npoService.getFollowers(npoId!),
        enabled: !!npoId,
        staleTime: 30_000,
    });
}
