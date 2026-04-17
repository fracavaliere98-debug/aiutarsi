import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { gamificationKeys } from "./keys";

export function useRecordActivityShareMutation(userId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (activityId: string) => {
            const { error } = await supabase.rpc("record_activity_share", { p_activity_id: activityId });
            if (error) throw error;
        },
        onSuccess: async () => {
            if (!userId) return;
            await queryClient.invalidateQueries({ queryKey: gamificationKeys.state(userId) });
        },
    });
}
