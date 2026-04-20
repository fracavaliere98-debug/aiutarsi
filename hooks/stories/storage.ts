import AsyncStorage from "@react-native-async-storage/async-storage";
import { StoryLocalViewBridge } from "./types";

const STORAGE_PREFIX = "@stories_local_view_bridge:";

export async function loadStoryLocalViewBridge(userId?: string): Promise<StoryLocalViewBridge> {
  if (!userId) {
    return { viewedStoryIds: [] };
  }

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return { viewedStoryIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoryLocalViewBridge>;
    return {
      viewedStoryIds: Array.isArray(parsed.viewedStoryIds) ? parsed.viewedStoryIds.filter(Boolean) : [],
    };
  } catch {
    return { viewedStoryIds: [] };
  }
}

export async function saveStoryLocalViewBridge(userId: string, state: StoryLocalViewBridge) {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify({
    viewedStoryIds: Array.from(new Set(state.viewedStoryIds.filter(Boolean))),
  }));
}
