import { useMutation, useQueryClient } from "@tanstack/react-query";
import { npoService } from "../../services/NPOService";
import { npoInviteKeys } from "./keys";

export type NpoInviteKind = "OPEN_ACTIVITIES" | "APPLY" | "ACTIVITY";

/**
 * Invito NPO → volontario (RPC server-side). Risolve a false se già invitato / bloccato; lancia
 * INVITE_LIMIT_REACHED al 6° invito mirato a una attività. Dopo un invio si ricaricano gli inviti
 * e i consigliati, così "Già invitato" e il contatore sono sempre quelli del server.
 */
export function useSendNpoInviteMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ volunteerId, kind, activityId }: { volunteerId: string; kind: NpoInviteKind; activityId?: string }) =>
            npoService.sendInvite(volunteerId, kind, activityId),
        onSettled: (_data, _error, variables) => {
            if (variables.kind === "ACTIVITY") {
                void queryClient.invalidateQueries({ queryKey: npoInviteKeys.all });
            }
        },
    });
}
