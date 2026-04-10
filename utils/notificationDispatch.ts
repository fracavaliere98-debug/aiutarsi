import { supabase } from './supabase';

type AppPushType =
    | 'ACTIVITY_UPDATE'
    | 'SUCCESS'
    | 'INFO'
    | 'URGENT'
    | 'VOLUNTEER_ENROLLED'
    | 'APPLICATION_RECEIVED'
    | 'APPLICATION_APPROVED'
    | 'APPLICATION_REJECTED'
    | 'SKILL_MATCH'
    | 'GAMIFICATION_REMIND'
    | 'BADGE_UNLOCKED'
    | 'CHAT_MESSAGE'
    | 'ACTIVITY_REMINDER'
    | 'REVIEW_REMINDER'
    | 'FOLLOWED_NPO_ACTIVITY'
    | 'FOLLOWED_NPO_POST'
    | 'FOLLOWED_NPO_STORY'
    | 'NPO_WEEKLY_RECAP'
    | 'VOLUNTEER_WEEKLY_RECAP'
    | 'NPO_LOW_COVERAGE';

type DispatchNotificationPayload = {
    userId: string;
    type: AppPushType;
    title: string;
    message: string;
    activityId?: string;
    applicationId?: string;
    npoId?: string;
    conversationId?: string;
    data?: Record<string, unknown>;
};

export async function dispatchNotification(payload: DispatchNotificationPayload) {
    const dbPayload = {
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        related_activity_id: payload.activityId || null,
        related_application_id: payload.applicationId || null,
        related_npo_id: payload.npoId || null,
        related_conversation_id: payload.conversationId || null,
        read: false,
    };

    const { error } = await supabase.from('notifications').insert(dbPayload);
    if (error) {
        console.error('[notificationDispatch] Failed to insert notification', error);
    }
}

export async function dispatchBulkNotifications(payloads: DispatchNotificationPayload[]) {
    for (const payload of payloads) {
        await dispatchNotification(payload);
    }
}
