import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { storiesKeys } from "./keys";
import { useStoriesFeedQuery, useSharedVolunteerAuthorIdsQuery, useStoryViewsStateQuery } from "./queries";
import { buildStoryGroups } from "./selectors";

type StoriesFeedViewOptions = {
  userId?: string;
  allowedAuthorIds?: string[];
  followedAuthorIds?: string[];
  affiliatedAuthorIds?: string[];
  sharedNpoIds?: string[];
  enabled?: boolean;
};

export function useStoriesFeedView({
  userId,
  allowedAuthorIds,
  followedAuthorIds,
  affiliatedAuthorIds,
  sharedNpoIds,
  enabled = true,
}: StoriesFeedViewOptions) {
  const queryClient = useQueryClient();
  const feedQuery = useStoriesFeedQuery(enabled);
  const viewsStateQuery = useStoryViewsStateQuery(userId, enabled);
  const sharedVolunteerAuthorIdsQuery = useSharedVolunteerAuthorIdsQuery(feedQuery.data || [], sharedNpoIds, enabled);

  const authorGroups = useMemo(
    () =>
      buildStoryGroups({
        stories: feedQuery.data || [],
        viewsState: viewsStateQuery.data,
        allowedAuthorIds,
        followedAuthorIds,
        affiliatedAuthorIds,
        sharedVolunteerAuthorIds: sharedVolunteerAuthorIdsQuery.data || [],
      }),
    [
      feedQuery.data,
      viewsStateQuery.data,
      allowedAuthorIds,
      followedAuthorIds,
      affiliatedAuthorIds,
      sharedVolunteerAuthorIdsQuery.data,
    ]
  );

  const refreshStories = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: storiesKeys.all });
  }, [queryClient]);

  return {
    stories: feedQuery.data || [],
    authorGroups,
    viewsState: viewsStateQuery.data,
    serverViewedStoryIds: viewsStateQuery.data?.serverViewedStoryIds || [],
    isLoading: feedQuery.isLoading || viewsStateQuery.isLoading,
    isRefreshing: feedQuery.isFetching,
    refreshStories,
  };
}
