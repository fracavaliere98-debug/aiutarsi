import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requestNotificationPermission } from './permissions';

const STORAGE_PREFIX = 'scheduled_notifications:activity:';

type ScheduledIds = {
    reminder24hId?: string;
    reviewReminderId?: string;
};

async function getNotificationsModule() {
    if (Platform.OS === 'web') return null;
    return import('expo-notifications');
}

async function loadScheduledIds(activityId: string): Promise<ScheduledIds> {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${activityId}`);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function saveScheduledIds(activityId: string, value: ScheduledIds) {
    if (!value.reminder24hId && !value.reviewReminderId) {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${activityId}`);
        return;
    }
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${activityId}`, JSON.stringify(value));
}

async function cancelNotification(id?: string) {
    if (!id) return;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
        // ignore
    }
}

function toDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function clearActivityReminderNotifications(activityId: string) {
    const current = await loadScheduledIds(activityId);
    await cancelNotification(current.reminder24hId);
    await cancelNotification(current.reviewReminderId);
    await saveScheduledIds(activityId, {});
}

export async function scheduleActivityReminderNotifications(activity: {
    id: string;
    title: string;
    dateTime?: string | null;
    endDateTime?: string | null;
}) {
    if (Platform.OS === 'web') return;

    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    const granted = await requestNotificationPermission({
        title: 'Attiva le notifiche attività',
        message: 'AiutarSì può ricordarti le attività in arrivo e chiederti una valutazione dopo l’esperienza.',
        settingsLabel: 'le notifiche',
    });
    if (!granted) return;

    const existing = await loadScheduledIds(activity.id);
    await cancelNotification(existing.reminder24hId);
    await cancelNotification(existing.reviewReminderId);

    const nextIds: ScheduledIds = {};
    const startDate = toDate(activity.dateTime);
    const endDate = toDate(activity.endDateTime);
    const now = Date.now();

    if (startDate) {
        const reminderDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        if (reminderDate.getTime() > now) {
            nextIds.reminder24hId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Domani hai un’attività',
                    body: activity.title,
                    data: {
                        type: 'ACTIVITY_REMINDER',
                        activityId: activity.id,
                    },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: reminderDate,
                },
            });
        }
    }

    if (endDate) {
        const reviewReminderDate = new Date(endDate.getTime() + 2 * 60 * 60 * 1000);
        if (reviewReminderDate.getTime() > now) {
            nextIds.reviewReminderId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Com'è andata?",
                    body: `Lascia una recensione per ${activity.title}`,
                    data: {
                        type: 'REVIEW_REMINDER',
                        activityId: activity.id,
                    },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: reviewReminderDate,
                },
            });
        }
    }

    await saveScheduledIds(activity.id, nextIds);
}
