import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moderateCommunityContent } from "../../utils/communityModeration";
import { supabase } from "../../utils/supabase";
import { storageService } from "../../services/StorageService";
import { AppUser } from "../../types";
import { storiesKeys } from "./keys";
import { loadStoryViewerState, saveStoryViewerState } from "./storage";
import { StoryViewerState } from "./types";

async function invalidateStoriesQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: storiesKeys.all }),
    queryClient.invalidateQueries({ queryKey: storiesKeys.viewerState(userId) }),
  ]);
}

export function useCreateStoryMutation(user?: AppUser | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      imageUri,
      caption,
      linkedActivityId,
    }: {
      imageUri: string;
      caption?: string;
      linkedActivityId?: string;
    }) => {
      if (!user) throw new Error("Missing user");

      const imageUrl = await storageService.uploadStoryImage(user.id, imageUri);
      if (!imageUrl) throw new Error("Upload fallito");

      const moderation = await moderateCommunityContent({
        caption: caption || "",
        imageUrl,
      });

      if (!moderation.safe) {
        throw new Error(moderation.reason || "Story non approvata dai controlli automatici.");
      }

      const { error } = await supabase.from("stories").insert({
        author_id: user.id,
        image_url: imageUrl,
        caption: caption || null,
        linked_activity_id: linkedActivityId || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateStoriesQueries(queryClient, user?.id);
    },
  });
}

export function useDeleteStoryMutation(user?: AppUser | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) throw new Error("Missing user");

      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", storyId)
        .eq("author_id", user.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateStoriesQueries(queryClient, user?.id);
    },
  });
}

export function useMarkStoryViewedMutation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!userId) return;

      const current = await loadStoryViewerState(userId);
      const next: StoryViewerState = {
        viewedStoryIds: Array.from(new Set([...current.viewedStoryIds, storyId])),
      };
      await saveStoryViewerState(userId, next);
      return next;
    },
    onSuccess: (nextState) => {
      if (!userId || !nextState) return;
      queryClient.setQueryData(storiesKeys.viewerState(userId), nextState);
    },
  });
}
