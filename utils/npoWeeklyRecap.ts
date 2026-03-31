import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'npo_weekly_recap:';

function getWeekKey(date = new Date()) {
    const now = new Date(date);
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    now.setDate(now.getDate() + diff);
    now.setHours(0, 0, 0, 0);
    return now.toISOString().slice(0, 10);
}

export async function shouldSendWeeklyRecap(npoId: string) {
    const weekKey = getWeekKey();
    const storageKey = `${STORAGE_PREFIX}${npoId}`;
    const current = await AsyncStorage.getItem(storageKey);
    return current !== weekKey;
}

export async function markWeeklyRecapSent(npoId: string) {
    const weekKey = getWeekKey();
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${npoId}`, weekKey);
}

