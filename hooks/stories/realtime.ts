import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { storiesKeys } from "./keys";

export function useStoriesRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidation = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: storiesKeys.all });
      }, 500);
    };

    const channel = supabase
      .channel("stories_query")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, scheduleInvalidation)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
