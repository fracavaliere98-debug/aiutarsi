import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { storiesKeys } from "./keys";
import { useStoriesFeedQuery, useSharedVolunteerAuthorIdsQuery, useStoryViewerStateQuery } from "./queries";
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
  const viewerStateQuery = useStoryViewerStateQuery(userId, enabled);
  const sharedVolunteerAuthorIdsQuery = useSharedVolunteerAuthorIdsQuery(feedQuery.data || [], sharedNpoIds, enabled);

  const authorGroups = useMemo(
    () =>
      buildStoryGroups({
        stories: feedQuery.data || [],
        viewerState: viewerStateQuery.data,
        allowedAuthorIds,
        followedAuthorIds,
        affiliatedAuthorIds,
        sharedVolunteerAuthorIds: sharedVolunteerAuthorIdsQuery.data || [],
      }),
    [
      feedQuery.data,
      viewerStateQuery.data,
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
    isLoading: feedQuery.isLoading || viewerStateQuery.isLoading,
    isRefreshing: feedQuery.isFetching,
    refreshStories,
  };
}
