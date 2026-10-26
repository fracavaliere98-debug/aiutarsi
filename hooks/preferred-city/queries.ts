import { useQuery } from "@tanstack/react-query";
import { preferredCityService } from "../../services/PreferredCityService";
import { preferredCityKeys } from "./keys";

/** Elenco dei capoluoghi: cambia di rado, una lettura per sessione basta. */
export function useProvincialCapitalsQuery() {
    return useQuery({
        queryKey: preferredCityKeys.capitals(),
        queryFn: () => preferredCityService.getCapitals(),
        staleTime: Infinity,
        gcTime: Infinity,
    });
}

/** Posizione preferita di un volontario: null se non l'ha scelta o non l'ha resa pubblica. */
export function usePreferredCityQuery(userId?: string) {
    return useQuery({
        queryKey: preferredCityKeys.user(userId),
        queryFn: () => preferredCityService.getPreferredCity(userId!),
        enabled: !!userId,
        staleTime: 30_000,
    });
}
