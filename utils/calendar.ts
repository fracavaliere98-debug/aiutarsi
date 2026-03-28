import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

export interface CalendarEventInput {
    title: string;
    startDate: Date;
    endDate?: Date | null;
    location?: string | null;
    notes?: string | null;
    url?: string | null;
}

async function getWritableCalendarId(): Promise<string | null> {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find((calendar) => calendar.allowsModifications);
    if (writable?.id) return writable.id;

    if (Platform.OS === "ios") {
        const defaultCalendar = await Calendar.getDefaultCalendarAsync();
        if (defaultCalendar?.id) return defaultCalendar.id;
    }

    return calendars[0]?.id || null;
}

export async function addEventToDeviceCalendar(input: CalendarEventInput): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
    const current = await Calendar.getCalendarPermissionsAsync();
    const granted = current.status === "granted"
        ? current
        : await Calendar.requestCalendarPermissionsAsync();

    if (granted.status !== "granted") {
        return { ok: false, reason: "permission_denied" };
    }

    const calendarId = await getWritableCalendarId();
    if (!calendarId) {
        return { ok: false, reason: "calendar_unavailable" };
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
        title: input.title,
        startDate: input.startDate,
        endDate: input.endDate || new Date(input.startDate.getTime() + 60 * 60 * 1000),
        location: input.location || undefined,
        notes: input.notes || undefined,
        url: input.url || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return { ok: true, eventId };
}
