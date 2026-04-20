import { StoryLocalViewBridge, StoryViewsState } from "./types";

export function buildStoryViewsState(
  localBridge?: StoryLocalViewBridge,
  serverViewedStoryIds?: string[]
): StoryViewsState {
  const localViewedStoryIds = Array.from(new Set(localBridge?.viewedStoryIds || []));
  const serverViewedIds = Array.from(new Set((serverViewedStoryIds || []).filter(Boolean)));
  const seenStoryIds = Array.from(new Set([...localViewedStoryIds, ...serverViewedIds]));

  return {
    localViewedStoryIds,
    serverViewedStoryIds: serverViewedIds,
    seenStoryIds,
  };
}

export function reconcileLocalViewedBridge(
  localBridge?: StoryLocalViewBridge,
  serverViewedStoryIds?: string[]
): StoryLocalViewBridge {
  const localViewedIds = localBridge?.viewedStoryIds || [];
  const serverViewedIds = new Set((serverViewedStoryIds || []).filter(Boolean));

  return {
    viewedStoryIds: localViewedIds.filter((storyId) => !serverViewedIds.has(storyId)),
  };
}

export function appendLocalViewedStory(
  localBridge: StoryLocalViewBridge | undefined,
  storyId: string
): StoryLocalViewBridge {
  return {
    viewedStoryIds: Array.from(new Set([...(localBridge?.viewedStoryIds || []), storyId])),
  };
}
