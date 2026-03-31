import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationJob = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_activity_id?: string | null;
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

const jsonHeaders = { "Content-Type": "application/json" };

function startOfWeek(date = new Date()) {
  const now = new Date(date);
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  now.setDate(now.getDate() + diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

function startOfMonth(date = new Date()) {
  const now = new Date(date);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
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
    console.error("[process-notification-jobs] Rate limit check failed", error);
    return false;
  }

  return !!data;
}

async function queueActivityReminderJobs(supabase: any, now: Date) {
  const cutoff = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activities } = await supabase
    .from("activities")
    .select("id,title,date_start,status,activity_participants(user_id,status)")
    .in("status", ["APERTA", "IN_CORSO"])
    .gte("date_start", now.toISOString())
    .lte("date_start", cutoff);

  for (const activity of activities || []) {
    const scheduledFor = new Date(new Date(activity.date_start).getTime() - 24 * 60 * 60 * 1000);
    if (scheduledFor <= now) continue;
    for (const participant of activity.activity_participants || []) {
      if (!["APPROVED", "REGISTERED"].includes(participant.status)) continue;
      await insertJob(supabase, {
        user_id: participant.user_id,
        type: "ACTIVITY_REMINDER",
        title: "Domani hai un’attività",
        message: `${activity.title}`,
        related_activity_id: activity.id,
        payload: { activityId: activity.id },
        scheduled_for: scheduledFor.toISOString(),
        dedupe_key: `activity_reminder_24h:${activity.id}:${participant.user_id}`,
      });
    }
  }
}

async function queueReviewReminderFallbackJobs(supabase: any, now: Date) {
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

async function queueFollowerContentJobs(supabase: any, now: Date) {
  const recentSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentContentSince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: activities } = await supabase
    .from("activities")
    .select("id,title,npo_id,created_at,status")
    .gte("created_at", recentSince)
    .neq("status", "CANCELLATA");
  for (const activity of activities || []) {
    const { data: followers } = await supabase
      .from("npo_followers")
      .select("follower_id")
      .eq("npo_id", activity.npo_id);
    for (const follower of followers || []) {
      await insertJob(supabase, {
        user_id: follower.follower_id,
        type: "FOLLOWED_NPO_ACTIVITY",
        title: "Nuova attività da una NPO che segui",
        message: `${activity.title} è ora disponibile`,
        related_activity_id: activity.id,
        payload: { activityId: activity.id, npoId: activity.npo_id },
        scheduled_for: activity.created_at || now.toISOString(),
        dedupe_key: `followed_npo_activity:${activity.id}:${follower.follower_id}`,
      });
    }
  }

  const { data: posts } = await supabase
    .from("community_posts")
    .select("id,author_id,caption,created_at,author:profiles!author_id(role,npo_name,full_name)")
    .gte("created_at", recentContentSince);
  for (const post of posts || []) {
    const author = Array.isArray(post.author) ? post.author[0] : post.author;
    if (author?.role !== "NPO") continue;
    const { data: followers } = await supabase
      .from("npo_followers")
      .select("follower_id")
      .eq("npo_id", post.author_id);
    for (const follower of followers || []) {
      await insertJob(supabase, {
        user_id: follower.follower_id,
        type: "FOLLOWED_NPO_POST",
        title: `${author?.npo_name || author?.full_name || "Una NPO che segui"} ha pubblicato un aggiornamento`,
        message: post.caption?.slice(0, 120) || "Apri la community per vederlo.",
        payload: { npoId: post.author_id, postId: post.id },
        scheduled_for: post.created_at || now.toISOString(),
        dedupe_key: `followed_npo_post:${post.id}:${follower.follower_id}`,
      });
    }
  }

  const { data: stories } = await supabase
    .from("stories")
    .select("id,author_id,caption,created_at,author:profiles!author_id(role,npo_name,full_name)")
    .gte("created_at", recentContentSince);
  for (const story of stories || []) {
    const author = Array.isArray(story.author) ? story.author[0] : story.author;
    if (author?.role !== "NPO") continue;
    const { data: followers } = await supabase
      .from("npo_followers")
      .select("follower_id")
      .eq("npo_id", story.author_id);
    for (const follower of followers || []) {
      await insertJob(supabase, {
        user_id: follower.follower_id,
        type: "FOLLOWED_NPO_STORY",
        title: `${author?.npo_name || author?.full_name || "Una NPO che segui"} ha pubblicato una nuova storia`,
        message: story.caption?.slice(0, 100) || "Apri la community per vederla.",
        payload: { npoId: story.author_id, storyId: story.id },
        scheduled_for: story.created_at || now.toISOString(),
        dedupe_key: `followed_npo_story:${story.id}:${follower.follower_id}`,
      });
    }
  }
}

async function queueNpoLowCoverageJobs(supabase: any, now: Date) {
  const until = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activities } = await supabase
    .from("activities")
    .select("id,title,npo_id,date_start,status,slots_total,activity_participants(user_id,status)")
    .in("status", ["APERTA", "IN_CORSO"])
    .gte("date_start", now.toISOString())
    .lte("date_start", until);

  for (const activity of activities || []) {
    const enrolled = (activity.activity_participants || []).filter((participant: any) =>
      ["APPROVED", "REGISTERED"].includes(participant.status)
    ).length;
    const slots = activity.slots_total || 0;
    const coverage = slots > 0 ? enrolled / slots : 1;
    if (coverage >= 0.5) continue;

    await insertJob(supabase, {
      user_id: activity.npo_id,
      type: "NPO_LOW_COVERAGE",
      title: "Attività da rinforzare",
      message: `${activity.title} ha ancora pochi volontari iscritti`,
      related_activity_id: activity.id,
      payload: { activityId: activity.id, npoId: activity.npo_id },
      scheduled_for: now.toISOString(),
      dedupe_key: `npo_low_coverage:${activity.id}:${dayKey(now)}`,
    });
  }
}

async function queueWeeklyNpoRecaps(supabase: any, now: Date) {
  const weekStart = startOfWeek(now).toISOString();
  const { data: npos } = await supabase.from("profiles").select("id,npo_name,full_name").eq("role", "NPO");

  for (const npo of npos || []) {
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

async function queueWeeklyVolunteerRecaps(supabase: any, now: Date) {
  const weekStart = startOfWeek(now).toISOString();
  const { data: volunteers } = await supabase.from("profiles").select("id,full_name").eq("role", "VOLUNTEER");

  for (const volunteer of volunteers || []) {
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

async function generateJobs(supabase: any, now: Date) {
  await queueActivityReminderJobs(supabase, now);
  await queueReviewReminderFallbackJobs(supabase, now);
  await queueFollowerContentJobs(supabase, now);
  await queueNpoLowCoverageJobs(supabase, now);
  await queueWeeklyNpoRecaps(supabase, now);
  await queueWeeklyVolunteerRecaps(supabase, now);
}

async function shouldSendJob(supabase: any, job: NotificationJob) {
  if (job.type === "ACTIVITY_REMINDER") {
    const { data } = await supabase
      .from("activity_participants")
      .select("activity_id,activities!inner(date_start)")
      .eq("activity_id", job.related_activity_id)
      .eq("user_id", job.user_id)
      .in("status", ["APPROVED", "REGISTERED"])
      .maybeSingle();
    if (!data) return false;

    const activity = Array.isArray(data.activities) ? data.activities[0] : data.activities;
    if (!activity?.date_start) return false;

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

  if (["FOLLOWED_NPO_ACTIVITY", "FOLLOWED_NPO_POST", "FOLLOWED_NPO_STORY"].includes(job.type)) {
    const npoId = (job.payload?.npoId as string | undefined) || undefined;
    if (!npoId) return false;
    const { data } = await supabase
      .from("npo_followers")
      .select("npo_id")
      .eq("npo_id", npoId)
      .eq("follower_id", job.user_id)
      .maybeSingle();
    return !!data;
  }

  if (job.type === "NPO_LOW_COVERAGE") {
    const { data: activity } = await supabase
      .from("activities")
      .select("id,slots_total,status,date_start,activity_participants(user_id,status)")
      .eq("id", job.related_activity_id)
      .single();
    if (!activity) return false;
    if (!["APERTA", "IN_CORSO"].includes(activity.status)) return false;
    const enrolled = (activity.activity_participants || []).filter((participant: any) =>
      ["APPROVED", "REGISTERED"].includes(participant.status)
    ).length;
    const coverage = activity.slots_total > 0 ? enrolled / activity.slots_total : 1;
    return coverage < 0.5;
  }

  return true;
}

async function sendPush(supabase: any, userId: string, title: string, body: string, data: Record<string, unknown>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("id", userId)
    .single();

  if (!profile?.expo_push_token) {
    return { skipped: "missing_push_token" };
  }

  const unreadNotifsPromise = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  const unreadMsgsPromise = supabase.rpc("get_unread_messages_count", { p_user_id: userId });
  const [{ count: unreadNotifs }, { data: unreadMsgs }] = await Promise.all([unreadNotifsPromise, unreadMsgsPromise]);
  const badge = (unreadNotifs || 0) + (unreadMsgs || 0);

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: profile.expo_push_token,
      sound: "default",
      title,
      body,
      badge,
      data,
    }),
  });

  return await expoRes.json();
}

async function processDueJobs(supabase: any, now: Date, limit: number) {
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
        await supabase.from("notification_jobs").update({ status: "cancelled", last_error: "conditions_not_met" }).eq("id", job.id);
        processed.cancelled++;
        continue;
      }

      const rateAllowed = await tryConsumeRateLimit(supabase, job, now);
      if (!rateAllowed) {
        await supabase.from("notification_jobs").update({ status: "cancelled", last_error: "rate_limited" }).eq("id", job.id);
        processed.cancelled++;
        continue;
      }

      await supabase.from("notifications").insert({
        user_id: job.user_id,
        type: job.type,
        title: job.title,
        message: job.message,
        related_activity_id: job.related_activity_id || null,
        related_conversation_id: job.related_conversation_id || null,
        read: false,
      });

      await sendPush(supabase, job.user_id, job.title, job.message, {
        type: job.type,
        activityId: job.related_activity_id || undefined,
        conversationId: job.related_conversation_id || undefined,
        ...(job.payload || {}),
      });

      await supabase.from("notification_jobs").update({ status: "sent", sent_at: now.toISOString(), last_error: null }).eq("id", job.id);
      processed.sent++;
    } catch (error) {
      await supabase.from("notification_jobs").update({ status: "failed", last_error: String(error) }).eq("id", job.id);
      processed.failed++;
    }
  }

  return processed;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Number(body?.limit || 100);
    const now = new Date();

    await generateJobs(supabase, now);
    const processed = await processDueJobs(supabase, now, limit);

    return new Response(JSON.stringify({ success: true, processed }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("[process-notification-jobs] Error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
