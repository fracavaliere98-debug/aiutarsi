import { useMutation } from "@tanstack/react-query";
import { npoService } from "../../services/NPOService";

export type NpoInviteKind = "OPEN_ACTIVITIES" | "APPLY" | "ACTIVITY";

/** Invito NPO → volontario (RPC server-side). Risolve a false se già invitato / bloccato. */
export function useSendNpoInviteMutation() {
    return useMutation({
        mutationFn: ({ volunteerId, kind, activityId }: { volunteerId: string; kind: NpoInviteKind; activityId?: string }) =>
            npoService.sendInvite(volunteerId, kind, activityId),
    });
}
