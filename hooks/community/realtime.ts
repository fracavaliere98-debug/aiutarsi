import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { communityKeys } from "./keys";

export function useCommunityRealtime(enabled = true) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled) return;

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleInvalidation = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                void queryClient.invalidateQueries({ queryKey: communityKeys.all });
            }, 1000);
        };

        const postsChannel = supabase
            .channel("community_posts_query")
            .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, scheduleInvalidation)
            .subscribe();

        const reactionsChannel = supabase
            .channel("community_reactions_query")
            .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, scheduleInvalidation)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(postsChannel);
            supabase.removeChannel(reactionsChannel);
        };
    }, [enabled, queryClient]);
}
