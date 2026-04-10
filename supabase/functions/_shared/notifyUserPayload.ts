export type TriggerPayload = {
  record?: {
    user_id?: string;
    title?: string;
    message?: string;
    related_activity_id?: string | null;
    related_application_id?: string | null;
    related_npo_id?: string | null;
    related_conversation_id?: string | null;
    type?: string;
  };
};

export function normalizeNotificationRequestBody(payload: Record<string, unknown> & TriggerPayload) {
  if (payload.record) {
    return {
      userId: payload.record.user_id,
      title: payload.record.title,
      body: payload.record.message,
      data: {
        type: payload.record.type,
        activityId: payload.record.related_activity_id ?? undefined,
        applicationId: payload.record.related_application_id ?? undefined,
        npoId: payload.record.related_npo_id ?? undefined,
        conversationId: payload.record.related_conversation_id ?? undefined,
      },
    };
  }

  return {
    userId: payload.userId as string | undefined,
    title: payload.title as string | undefined,
    body: payload.body as string | undefined,
    data: payload.data as Record<string, unknown> | undefined,
  };
}
