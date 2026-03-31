import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'npo_low_coverage_alert:';

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

export async function shouldSendLowCoverageAlert(activityId: string) {
    const key = `${STORAGE_PREFIX}${activityId}`;
    const lastSent = await AsyncStorage.getItem(key);
    return lastSent !== todayKey();
}

export async function markLowCoverageAlertSent(activityId: string) {
    const key = `${STORAGE_PREFIX}${activityId}`;
    await AsyncStorage.setItem(key, todayKey());
}
