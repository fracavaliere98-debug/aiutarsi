import AsyncStorage from "@react-native-async-storage/async-storage";
import { StoryViewerState } from "./types";

const STORAGE_PREFIX = "@stories_viewer_state:";

export async function loadStoryViewerState(userId?: string): Promise<StoryViewerState> {
  if (!userId) {
    return { viewedStoryIds: [] };
  }

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return { viewedStoryIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoryViewerState>;
    return {
      viewedStoryIds: Array.isArray(parsed.viewedStoryIds) ? parsed.viewedStoryIds.filter(Boolean) : [],
    };
  } catch {
    return { viewedStoryIds: [] };
  }
}

export async function saveStoryViewerState(userId: string, state: StoryViewerState) {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify({
    viewedStoryIds: Array.from(new Set(state.viewedStoryIds.filter(Boolean))),
  }));
}
