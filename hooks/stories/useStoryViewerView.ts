import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarkStoryViewedMutation } from "./mutations";
import { StoryAuthorGroup, StoryViewerSession } from "./types";

export function useStoryViewerView(userId?: string) {
  const [viewer, setViewer] = useState<StoryViewerSession | null>(null);
  const markStoryViewedMutation = useMarkStoryViewedMutation(userId);

  const currentStory = useMemo(() => {
    if (!viewer) return null;
    return viewer.groups[viewer.groupIndex]?.stories[viewer.storyIndex] || null;
  }, [viewer]);

  useEffect(() => {
    if (!currentStory?.id) return;
    if (markStoryViewedMutation.isPending) return;
    void markStoryViewedMutation.mutateAsync(currentStory.id).catch(() => {});
  }, [currentStory?.id, markStoryViewedMutation]);

  useEffect(() => {
    if (!viewer || !currentStory) return;

    const timer = setTimeout(() => {
      setViewer((current) => {
        if (!current) return current;
        const currentGroup = current.groups[current.groupIndex];
        if (!currentGroup) return null;

        if (current.storyIndex < currentGroup.stories.length - 1) {
          return { ...current, storyIndex: current.storyIndex + 1 };
        }

        if (current.groupIndex < current.groups.length - 1) {
          return { ...current, groupIndex: current.groupIndex + 1, storyIndex: 0 };
        }

        return null;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentStory, viewer]);

  const openViewer = useCallback((groups: StoryAuthorGroup[], groupIndex: number, storyIndex = 0) => {
    if (!groups[groupIndex]?.stories.length) return;
    setViewer({ groups, groupIndex, storyIndex });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
  }, []);

  const advanceViewer = useCallback(() => {
    setViewer((current) => {
      if (!current) return current;
      const group = current.groups[current.groupIndex];
      if (!group) return null;

      if (current.storyIndex < group.stories.length - 1) {
        return { ...current, storyIndex: current.storyIndex + 1 };
      }

      if (current.groupIndex < current.groups.length - 1) {
        return { ...current, groupIndex: current.groupIndex + 1, storyIndex: 0 };
      }

      return null;
    });
  }, []);

  const rewindViewer = useCallback(() => {
    setViewer((current) => {
      if (!current) return current;

      if (current.storyIndex > 0) {
        return { ...current, storyIndex: current.storyIndex - 1 };
      }

      if (current.groupIndex > 0) {
        const previousGroup = current.groups[current.groupIndex - 1];
        return {
          ...current,
          groupIndex: current.groupIndex - 1,
          storyIndex: Math.max(0, previousGroup.stories.length - 1),
        };
      }

      return null;
    });
  }, []);

  return {
    viewer,
    currentStory,
    openViewer,
    closeViewer,
    advanceViewer,
    rewindViewer,
  };
}
