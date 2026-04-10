export type NotificationJob = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_activity_id?: string | null;
  related_application_id?: string | null;
  related_npo_id?: string | null;
  related_conversation_id?: string | null;
  payload?: Record<string, unknown> | null;
  dedupe_key: string;
  scheduled_for: string;
  status: string;
  attempt_count: number;
};

type RateLimitPolicy = {
  scopeKey: string;
  windowSeconds: number;
  metadata?: Record<string, unknown>;
};

export function startOfWeek(date = new Date()) {
  const now = new Date(date);
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  now.setDate(now.getDate() + diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

function weekKey(date = new Date()) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function getRateLimitPolicy(job: NotificationJob): RateLimitPolicy | null {
  const npoId = (job.payload?.npoId as string | undefined) || undefined;
  switch (job.type) {
    case "FOLLOWED_NPO_POST":
      if (!npoId) return null;
      return {
        scopeKey: `followed_npo_post:${job.user_id}:${npoId}`,
        windowSeconds: 8 * 60 * 60,
        metadata: { npoId },
      };
    case "FOLLOWED_NPO_STORY":
      if (!npoId) return null;
      return {
        scopeKey: `followed_npo_story:${job.user_id}:${npoId}`,
        windowSeconds: 8 * 60 * 60,
        metadata: { npoId },
      };
    case "NPO_LOW_COVERAGE":
      return {
        scopeKey: `npo_low_coverage:${job.user_id}:${job.related_activity_id}`,
        windowSeconds: 24 * 60 * 60,
        metadata: { activityId: job.related_activity_id },
      };
    case "NPO_WEEKLY_RECAP":
      return {
        scopeKey: `npo_weekly_recap:${job.user_id}:${weekKey(new Date(job.scheduled_for))}`,
        windowSeconds: 6 * 24 * 60 * 60,
      };
    case "VOLUNTEER_WEEKLY_RECAP":
      return {
        scopeKey: `volunteer_weekly_recap:${job.user_id}:${weekKey(new Date(job.scheduled_for))}`,
        windowSeconds: 6 * 24 * 60 * 60,
      };
    default:
      return null;
  }
}

async function insertJob(supabase: any, job: Record<string, unknown>) {
  await supabase.from("notification_jobs").upsert(job, {
    onConflict: "dedupe_key",
    ignoreDuplicates: true,
  });
}

async function tryConsumeRateLimit(supabase: any, job: NotificationJob, now: Date) {
  const policy = getRateLimitPolicy(job);
  if (!policy) return true;

  const { data, error } = await supabase.rpc("try_consume_notification_rate_limit", {
    p_scope_key: policy.scopeKey,
    p_job_type: job.type,
    p_window_seconds: policy.windowSeconds,
    p_now: now.toISOString(),
    p_metadata: policy.metadata || {},
  });

  if (error) {
    console.error("[notification-jobs] Rate limit check failed", error);
    return false;
  }

  return !!data;
}

export async function queueReviewReminderFallbackJobs(supabase: any, now: Date) {
  const endedBefore = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data: activities } = await supabase
    .from("activities")
    .select("id,title,date_end,status,activity_participants(user_id,status)")
    .eq("status", "COMPLETATA")
    .lte("date_end", endedBefore);

  for (const activity of activities || []) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("volunteer_id")
      .eq("activity_id", activity.id);
    const reviewedIds = new Set((reviews || []).map((review: any) => review.volunteer_id));

    for (const participant of activity.activity_participants || []) {
      if (!["APPROVED", "REGISTERED"].includes(participant.status)) continue;
      if (reviewedIds.has(participant.user_id)) continue;
      await insertJob(supabase, {
        user_id: participant.user_id,
        type: "REVIEW_REMINDER",
        title: "Com'è andata?",
        message: `Lascia una recensione per ${activity.title}`,
        related_activity_id: activity.id,
        payload: { activityId: activity.id },
        scheduled_for: now.toISOString(),
        dedupe_key: `review_reminder:${activity.id}:${participant.user_id}`,
      });
    }
  }
}

export async function queueWeeklyNpoRecaps(supabase: any, now: Date) {
  const weekStart = startOfWeek(now).toISOString();
  const { data: npos } = await supabase.from("profiles").select("id,npo_name,full_name").eq("role", "NPO");

  for (const npo of npos || []) {
    const { data: followerProbe } = await supabase
      .from("npo_followers")
      .select("follower_id")
      .eq("npo_id", npo.id)
      .gte("created_at", weekStart)
      .limit(1);
    const { data: registrationProbe } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(npo_id)")
      .eq("activities.npo_id", npo.id)
      .in("status", ["APPROVED", "REGISTERED"])
      .gte("created_at", weekStart)
      .limit(1);
    const { data: applicationProbe } = await supabase
      .from("applications")
      .select("id")
      .eq("npo_id", npo.id)
      .gte("created_at", weekStart)
      .limit(1);

    const hasWeeklyActivity = !!(followerProbe?.length || registrationProbe?.length || applicationProbe?.length);
    if (!hasWeeklyActivity) {
      await insertJob(supabase, {
        user_id: npo.id,
        type: "INFO",
        title: "Riattiva la tua community",
        message: "Questa settimana il tuo ente è rimasto fermo. Pubblica una storia o una nuova attività per tornare visibile ai volontari.",
        payload: { npoId: npo.id, weekStart, reengagement: true },
        scheduled_for: now.toISOString(),
        dedupe_key: `npo_reengagement:${npo.id}:${weekStart.slice(0, 10)}`,
      });
      continue;
    }

    const { count: followersCount } = await supabase
      .from("npo_followers")
      .select("*", { count: "exact", head: true })
      .eq("npo_id", npo.id)
      .gte("created_at", weekStart);
    const { count: registrationsCount } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(npo_id)", { count: "exact", head: true })
      .eq("activities.npo_id", npo.id)
      .in("status", ["APPROVED", "REGISTERED"])
      .gte("created_at", weekStart);
    const { count: applicationsCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("npo_id", npo.id)
      .gte("created_at", weekStart);

    await insertJob(supabase, {
      user_id: npo.id,
      type: "NPO_WEEKLY_RECAP",
      title: "Come sta andando",
      message: `Questa settimana hai avuto ${followersCount || 0} nuovi follower, ${registrationsCount || 0} nuovi iscritti e ${applicationsCount || 0} candidature.`,
      payload: { npoId: npo.id, weekStart },
      scheduled_for: now.toISOString(),
      dedupe_key: `npo_weekly_recap:${npo.id}:${weekStart.slice(0, 10)}`,
    });
  }
}

export async function queueWeeklyVolunteerRecaps(supabase: any, now: Date) {
  const weekStart = startOfWeek(now).toISOString();
  const { data: volunteers } = await supabase.from("profiles").select("id,full_name").eq("role", "VOLUNTEER");

  for (const volunteer of volunteers || []) {
    const { data: completedProbe } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(date_end,status)")
      .eq("user_id", volunteer.id)
      .in("status", ["APPROVED", "REGISTERED"])
      .gte("created_at", weekStart)
      .limit(1);
    const { data: applicationsProbe } = await supabase
      .from("applications")
      .select("id")
      .eq("volunteer_id", volunteer.id)
      .gte("created_at", weekStart)
      .limit(1);
    const { data: followedProbe } = await supabase
      .from("npo_followers")
      .select("npo_id")
      .eq("follower_id", volunteer.id)
      .gte("created_at", weekStart)
      .limit(1);

    const hasWeeklyActivity = !!(completedProbe?.length || applicationsProbe?.length || followedProbe?.length);
    if (!hasWeeklyActivity) {
      await insertJob(supabase, {
        user_id: volunteer.id,
        type: "INFO",
        title: "Torna a dare una mano",
        message: "Questa settimana non hai ancora mosso passi nella community. Scopri una nuova attività o segui un ente vicino a te.",
        payload: { weekStart, reengagement: true },
        scheduled_for: now.toISOString(),
        dedupe_key: `volunteer_reengagement:${volunteer.id}:${weekStart.slice(0, 10)}`,
      });
      continue;
    }

    const { data: completedActivities } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(date_end,status)")
      .eq("user_id", volunteer.id)
      .in("status", ["APPROVED", "REGISTERED"]);

    const completedThisWeek = (completedActivities || []).filter((row: any) => {
      const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
      return activity?.status === "COMPLETATA" && activity?.date_end >= weekStart;
    }).length;

    const { count: applicationsCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("volunteer_id", volunteer.id)
      .gte("created_at", weekStart);

    const { count: followedNposCount } = await supabase
      .from("npo_followers")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", volunteer.id)
      .gte("created_at", weekStart);

    await insertJob(supabase, {
      user_id: volunteer.id,
      type: "VOLUNTEER_WEEKLY_RECAP",
      title: "Come sta andando",
      message: `Questa settimana hai completato ${completedThisWeek} attività, inviato ${applicationsCount || 0} candidature e seguito ${followedNposCount || 0} nuove NPO.`,
      payload: { weekStart },
      scheduled_for: now.toISOString(),
      dedupe_key: `volunteer_weekly_recap:${volunteer.id}:${weekStart.slice(0, 10)}`,
    });
  }
}

async function shouldSendJob(supabase: any, job: NotificationJob) {
  if (job.type === "ACTIVITY_REMINDER") {
    const { data } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(date_start,status)")
      .eq("activity_id", job.related_activity_id)
      .eq("user_id", job.user_id)
      .in("status", ["APPROVED", "REGISTERED"])
      .maybeSingle();
    if (!data) return false;

    const activity = Array.isArray(data.activities) ? data.activities[0] : data.activities;
    if (!activity?.date_start || !["APERTA", "IN_CORSO"].includes(activity?.status)) return false;

    const expectedReminderTime = new Date(new Date(activity.date_start).getTime() - 24 * 60 * 60 * 1000);
    return Math.abs(expectedReminderTime.getTime() - new Date(job.scheduled_for).getTime()) < 60_000;
  }

  if (job.type === "REVIEW_REMINDER") {
    const { data: review } = await supabase
      .from("reviews")
      .select("id")
      .eq("activity_id", job.related_activity_id)
      .eq("volunteer_id", job.user_id)
      .maybeSingle();
    return !review;
  }

  if (job.type === "NPO_LOW_COVERAGE") {
    const { data: activity } = await supabase
      .from("activities")
      .select("id,slots_total,status,date_start,activity_participants(user_id,status)")
      .eq("id", job.related_activity_id)
      .single();
    if (!activity) return false;
    if (!["APERTA", "IN_CORSO"].includes(activity.status)) return false;
    if (new Date(activity.date_start).getTime() < Date.now()) return false;
    const enrolled = (activity.activity_participants || []).filter((participant: any) =>
      ["APPROVED", "REGISTERED"].includes(participant.status)
    ).length;
    const coverage = activity.slots_total > 0 ? enrolled / activity.slots_total : 1;
    return coverage < 0.5;
  }

  return true;
}

export async function processDueJobs(supabase: any, now: Date, limit: number) {
  const { data: jobs } = await supabase
    .from("notification_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  const processed: Record<string, number> = { sent: 0, cancelled: 0, failed: 0 };

  for (const job of (jobs || []) as NotificationJob[]) {
    const { data: reserved } = await supabase
      .from("notification_jobs")
      .update({ status: "processing", attempt_count: job.attempt_count + 1 })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!reserved) continue;

    try {
      const shouldSend = await shouldSendJob(supabase, job);
      if (!shouldSend) {
        await supabase
          .from("notification_jobs")
          .update({ status: "cancelled", last_error: "conditions_not_met" })
          .eq("id", job.id);
        processed.cancelled++;
        continue;
      }

      const rateAllowed = await tryConsumeRateLimit(supabase, job, now);
      if (!rateAllowed) {
        await supabase
          .from("notification_jobs")
          .update({ status: "cancelled", last_error: "rate_limited" })
          .eq("id", job.id);
        processed.cancelled++;
        continue;
      }

      await supabase.from("notifications").insert({
        user_id: job.user_id,
        type: job.type,
        title: job.title,
        message: job.message,
        related_activity_id: job.related_activity_id || null,
        related_application_id: job.related_application_id || null,
        related_npo_id: job.related_npo_id || (job.payload?.npoId as string | undefined) || null,
        related_conversation_id: job.related_conversation_id || null,
        read: false,
      });

      await supabase
        .from("notification_jobs")
        .update({ status: "sent", sent_at: now.toISOString(), last_error: null })
        .eq("id", job.id);
      processed.sent++;
    } catch (error) {
      await supabase
        .from("notification_jobs")
        .update({ status: "failed", last_error: String(error) })
        .eq("id", job.id);
      processed.failed++;
    }
  }

  return processed;
}

export async function cleanupRetention(supabase: any, now: Date) {
  const { data, error } = await supabase.rpc("cleanup_notification_retention", {
    p_now: now.toISOString(),
  });
  if (error) throw error;
  return data ?? {};
}
