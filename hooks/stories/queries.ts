import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { Story } from "../../types/stories";
import { storiesKeys } from "./keys";
import { loadStoryLocalViewBridge, saveStoryLocalViewBridge } from "./storage";
import { StoryLocalViewBridge } from "./types";
import { buildStoryViewsState, reconcileLocalViewedBridge } from "./viewState";

const STORIES_SELECT = `
  *,
  author:profiles!author_id (
    id,
    full_name,
    npo_name,
    avatar_url,
    role
  ),
  linked_activity:activities!linked_activity_id (
    id, title, date_start, status
  )
`;

async function fetchStoriesFeed() {
  const { data, error } = await supabase
    .from("stories")
    .select(STORIES_SELECT)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Story[]) || [];
}

async function fetchStoryViews(userId: string) {
  const { data, error } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_user_id", userId);

  if (error) throw error;
  return Array.from(new Set((data || []).map((row: any) => row.story_id).filter(Boolean)));
}

async function fetchSharedVolunteerAuthorIds(sharedNpoIds: string[], volunteerAuthorIds: string[]) {
  if (!sharedNpoIds.length || !volunteerAuthorIds.length) return [];

  const { data, error } = await supabase
    .from("applications")
    .select("volunteer_id,npo_id")
    .in("volunteer_id", volunteerAuthorIds)
    .in("npo_id", sharedNpoIds)
    .eq("status", "APPROVED");

  if (error) throw error;

  return Array.from(new Set((data || []).map((row: any) => row.volunteer_id).filter(Boolean))).sort();
}

export function useStoriesFeedQuery(enabled = true) {
  return useQuery({
    queryKey: storiesKeys.feed(),
    queryFn: fetchStoriesFeed,
    enabled,
    staleTime: 30_000,
  });
}

export function useStoryViewsQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: storiesKeys.views(userId),
    queryFn: () => fetchStoryViews(userId!),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

export function useStoryLocalViewBridgeQuery(userId?: string, enabled = true) {
  return useQuery<StoryLocalViewBridge>({
    queryKey: storiesKeys.localViews(userId),
    queryFn: () => loadStoryLocalViewBridge(userId),
    enabled: enabled && !!userId,
    staleTime: Infinity,
  });
}

export function useStoryViewsStateQuery(userId?: string, enabled = true) {
  const queryClient = useQueryClient();
  const localBridgeQuery = useStoryLocalViewBridgeQuery(userId, enabled);
  const serverViewsQuery = useStoryViewsQuery(userId, enabled);

  const viewsState = useMemo(
    () => buildStoryViewsState(localBridgeQuery.data, serverViewsQuery.data),
    [localBridgeQuery.data, serverViewsQuery.data]
  );

  useEffect(() => {
    if (!userId || !enabled) return;
    if (!localBridgeQuery.data || !serverViewsQuery.data) return;

    const reconciled = reconcileLocalViewedBridge(localBridgeQuery.data, serverViewsQuery.data);
    if (reconciled.viewedStoryIds.length === localBridgeQuery.data.viewedStoryIds.length) return;

    void saveStoryLocalViewBridge(userId, reconciled).then(() => {
      queryClient.setQueryData(storiesKeys.localViews(userId), reconciled);
    }).catch(() => {});
  }, [enabled, localBridgeQuery.data, queryClient, serverViewsQuery.data, userId]);

  return {
    localBridgeQuery,
    serverViewsQuery,
    data: viewsState,
    isLoading: localBridgeQuery.isLoading || serverViewsQuery.isLoading,
  };
}

export function useSharedVolunteerAuthorIdsQuery(stories: Story[], sharedNpoIds?: string[], enabled = true) {
  const volunteerAuthorIds = useMemo(
    () =>
      Array.from(
        new Set(
          stories
            .filter((story) => story.author?.role === "VOLUNTEER" && story.author_id)
            .map((story) => story.author_id)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [stories]
  );

  const sharedNpoIdsKey = useMemo(() => [...(sharedNpoIds || [])].sort().join(","), [sharedNpoIds]);
  const authorIdsKey = useMemo(() => volunteerAuthorIds.join(","), [volunteerAuthorIds]);

  return useQuery({
    queryKey: storiesKeys.sharedVolunteerAuthors(sharedNpoIdsKey, authorIdsKey),
    queryFn: () => fetchSharedVolunteerAuthorIds(sharedNpoIds || [], volunteerAuthorIds),
    enabled: enabled && !!sharedNpoIds?.length && !!volunteerAuthorIds.length,
    staleTime: 60_000,
  });
}
