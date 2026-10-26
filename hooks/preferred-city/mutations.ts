import { useMutation, useQueryClient } from "@tanstack/react-query";
import { preferredCityService } from "../../services/PreferredCityService";
import { preferredCityKeys } from "./keys";

export function useSetPreferredCityMutation(userId?: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ cityCode, isPublic }: { cityCode: string | null; isPublic: boolean }) =>
            preferredCityService.setMyPreferredCity(cityCode, isPublic),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: preferredCityKeys.user(userId) });
        },
    });
}
