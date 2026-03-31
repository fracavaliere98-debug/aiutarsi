import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'npo_content_push_window:';
const WINDOW_MS = 8 * 60 * 60 * 1000;

export async function canNotifyFollowersForContent(npoId: string, type: 'post' | 'story') {
    const storageKey = `${STORAGE_PREFIX}${npoId}:${type}`;
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return true;

    const previous = Number(raw);
    if (!Number.isFinite(previous)) return true;
    return Date.now() - previous >= WINDOW_MS;
}

export async function markFollowersContentNotified(npoId: string, type: 'post' | 'story') {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${npoId}:${type}`, String(Date.now()));
}
