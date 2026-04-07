import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeNotificationRequestBody } from "../_shared/notifyUserPayload.ts";
import {
  cleanupRetention,
  processDueJobs,
  queueReviewReminderFallbackJobs,
  queueWeeklyNpoRecaps,
  queueWeeklyVolunteerRecaps,
  startOfWeek,
} from "../_shared/notificationJobs.ts";

type Role = "VOLUNTEER" | "NPO";
type Mode =
  | "pipeline"
  | "story_metrics"
  | "retention"
  | "event_driven"
  | "cron_modes"
  | "notification_context"
  | "auth_ban_flow"
  | "full";

const jsonHeaders = { "Content-Type": "application/json" };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function marker(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function startOfMonth(date = new Date()) {
  const now = new Date(date);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function sumStoryMetricsSince(rows: { metric_date: string; stories_count: number }[], since: string) {
  return rows
    .filter((row) => row.metric_date >= since)
    .reduce((sum, row) => sum + (row.stories_count || 0), 0);
}

async function createProfile(
  admin: ReturnType<typeof createClient>,
  params: { role: Role; fullName: string; npoName?: string; profileCompleted?: boolean }
) {
  const email = `${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: "TempPass123",
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      role: params.role,
      npo_name: params.npoName || null,
    },
  });
  if (authError) throw authError;
  assert(authUser.user, "Missing auth user");

  const { error } = await admin.from("profiles").upsert({
    id: authUser.user.id,
    email,
    full_name: params.fullName,
    role: params.role,
    npo_name: params.npoName || null,
    profile_completed: params.profileCompleted ?? true,
    email_confirmed: true,
    verification_status: params.role === "NPO" ? "verified" : "none",
    expo_push_token: null,
  });
  if (error) throw error;
  return { id: authUser.user.id, email };
}

async function deleteProfile(admin: ReturnType<typeof createClient>, id?: string) {
  if (!id) return;
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

async function countNotifications(
  admin: ReturnType<typeof createClient>,
  userId: string,
  filters: { type?: string; titleLike?: string; messageLike?: string }
) {
  let query = admin.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.titleLike) query = query.ilike("title", `%${filters.titleLike}%`);
  if (filters.messageLike) query = query.ilike("message", `%${filters.messageLike}%`);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function runPipelineTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("PIPE");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Smoke Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Smoke NPO", npoName: "Smoke NPO" });

  try {
    const { error: notificationsError } = await admin.from("notifications").insert([
      {
        user_id: npo.id,
        type: "SUCCESS",
        title: `${localMarker} verification approved`,
        message: `${localMarker} admin verification approved`,
        read: false,
      },
      {
        user_id: volunteer.id,
        type: "APPLICATION_APPROVED",
        title: `${localMarker} application approved`,
        message: `${localMarker} application approved`,
        read: false,
      },
    ]);
    if (notificationsError) throw notificationsError;

    assert(
      (await countNotifications(admin, npo.id, { titleLike: localMarker })) === 1,
      "Expected exactly one direct notification for NPO"
    );
    assert(
      (await countNotifications(admin, volunteer.id, { titleLike: localMarker })) === 1,
      "Expected exactly one direct notification for volunteer"
    );

    const { error: jobsError } = await admin.from("notification_jobs").insert([
      {
        user_id: npo.id,
        type: "NPO_WEEKLY_RECAP",
        title: `${localMarker} NPO weekly recap`,
        message: `${localMarker} weekly recap`,
        payload: { localMarker },
        dedupe_key: `${localMarker}:npo_weekly:${npo.id}`,
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        status: "pending",
      },
      {
        user_id: volunteer.id,
        type: "VOLUNTEER_WEEKLY_RECAP",
        title: `${localMarker} Volunteer weekly recap`,
        message: `${localMarker} weekly recap`,
        payload: { localMarker },
        dedupe_key: `${localMarker}:volunteer_weekly:${volunteer.id}`,
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        status: "pending",
      },
    ]);
    if (jobsError) throw jobsError;

    await processDueJobs(admin, new Date(), 10);
    await processDueJobs(admin, new Date(), 10);

    assert(
      (await countNotifications(admin, npo.id, { titleLike: localMarker })) === 2,
      "Queued NPO job should create exactly one additional notification"
    );
    assert(
      (await countNotifications(admin, volunteer.id, { titleLike: localMarker })) === 2,
      "Queued volunteer job should create exactly one additional notification"
    );

    const normalized = normalizeNotificationRequestBody({
      record: {
        user_id: volunteer.id,
        title: `${localMarker} trigger payload`,
        message: `${localMarker} trigger payload`,
        type: "INFO",
      },
    });
    assert(
      normalized.userId === volunteer.id &&
        normalized.title === `${localMarker} trigger payload` &&
        normalized.body === `${localMarker} trigger payload` &&
        normalized.data?.type === "INFO",
      "notify-user must normalize trigger-style payloads"
    );

    return [
      "PASS direct notification inserts remain single-row",
      "PASS queued jobs remain single-send across reruns",
      "PASS notify-user normalizes trigger payload format",
    ];
  } finally {
    await admin.from("notification_jobs").delete().ilike("dedupe_key", `%${localMarker}%`);
    await admin.from("notifications").delete().ilike("title", `%${localMarker}%`);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStoryMetricsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("STORY");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Story Metrics NPO", npoName: "Story Metrics NPO" });

  try {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const currentMonthStoryDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const { error } = await admin.from("stories").insert([
      {
        author_id: npo.id,
        image_url: `https://example.com/${localMarker}-month.jpg`,
        caption: `${localMarker} current month`,
        created_at: currentMonthStoryDate.toISOString(),
        expires_at: new Date(currentMonthStoryDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author_id: npo.id,
        image_url: `https://example.com/${localMarker}-week.jpg`,
        caption: `${localMarker} current week`,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author_id: npo.id,
        image_url: `https://example.com/${localMarker}-old.jpg`,
        caption: `${localMarker} old month`,
        created_at: tenDaysAgo.toISOString(),
        expires_at: new Date(tenDaysAgo.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    if (error) throw error;

    const { data: stories } = await admin
      .from("stories")
      .select("id,caption")
      .eq("author_id", npo.id)
      .ilike("caption", `%${localMarker}%`)
      .order("created_at", { ascending: false });
    assert((stories || []).length === 3, "Expected 3 stories");
    const storyId = stories?.[0]?.id;

    const { data: metricsBefore, error: metricsBeforeError } = await admin
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", npo.id);
    if (metricsBeforeError) throw metricsBeforeError;

    const storiesThisWeek = sumStoryMetricsSince(metricsBefore || [], startOfWeek().toISOString().slice(0, 10));
    const storiesThisMonth = sumStoryMetricsSince(metricsBefore || [], startOfMonth().toISOString().slice(0, 10));
    assert(storiesThisWeek >= 1, "Expected at least 1 story this week");
    assert(storiesThisMonth >= 2, "Expected at least 2 stories this month");

    if (storyId) {
      const { error: deleteError } = await admin.from("stories").delete().eq("id", storyId);
      if (deleteError) throw deleteError;
    }

    const { data: metricsAfter, error: metricsAfterError } = await admin
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", npo.id);
    if (metricsAfterError) throw metricsAfterError;

    const storiesThisMonthAfter = sumStoryMetricsSince(metricsAfter || [], startOfMonth().toISOString().slice(0, 10));
    assert(
      storiesThisMonthAfter === storiesThisMonth,
      "Deleting a story must not decrement published story metrics"
    );

    return [
      "PASS story inserts increment daily metrics",
      "PASS NPO report counts can read from metrics only",
      "PASS deleting a story does not decrement published counts",
    ];
  } finally {
    await admin.from("stories").delete().eq("author_id", npo.id).ilike("caption", `%${localMarker}%`);
    await admin.from("story_metrics_daily").delete().eq("author_id", npo.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runRetentionTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("RETENTION");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Retention NPO", npoName: "Retention NPO" });

  try {
    const now = Date.now();
    const oldStoryDate = new Date(now - 9 * 24 * 60 * 60 * 1000);
    const activeStoryDate = new Date(now - 2 * 24 * 60 * 60 * 1000);

    const { error: notificationsError } = await admin.from("notifications").insert([
      {
        user_id: npo.id,
        type: "INFO",
        title: `${localMarker} old notification`,
        message: "old notification",
        read: true,
        created_at: new Date(now - 25 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: npo.id,
        type: "INFO",
        title: `${localMarker} fresh notification`,
        message: "fresh notification",
        read: false,
        created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    if (notificationsError) throw notificationsError;

    const { error: jobsError } = await admin.from("notification_jobs").insert([
      {
        user_id: npo.id,
        type: "INFO",
        title: `${localMarker} sent job`,
        message: "sent job",
        payload: { localMarker },
        dedupe_key: `${localMarker}:sent`,
        scheduled_for: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: "sent",
        sent_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: npo.id,
        type: "INFO",
        title: `${localMarker} failed job`,
        message: "failed job",
        payload: { localMarker },
        dedupe_key: `${localMarker}:failed`,
        scheduled_for: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
        status: "failed",
        created_at: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: npo.id,
        type: "INFO",
        title: `${localMarker} pending job`,
        message: "pending job",
        payload: { localMarker },
        dedupe_key: `${localMarker}:pending`,
        scheduled_for: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
    ]);
    if (jobsError) throw jobsError;

    const { error: storiesError } = await admin.from("stories").insert([
      {
        author_id: npo.id,
        image_url: `https://example.com/${localMarker}-old-story.jpg`,
        caption: `${localMarker} old story`,
        created_at: oldStoryDate.toISOString(),
        expires_at: new Date(oldStoryDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author_id: npo.id,
        image_url: `https://example.com/${localMarker}-active-story.jpg`,
        caption: `${localMarker} active story`,
        created_at: activeStoryDate.toISOString(),
        expires_at: new Date(activeStoryDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    if (storiesError) throw storiesError;

    const { data: metricsBefore } = await admin
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", npo.id);
    const storiesThisMonthBefore = sumStoryMetricsSince(metricsBefore || [], startOfMonth().toISOString().slice(0, 10));

    await cleanupRetention(admin, new Date());

    assert(
      (await countNotifications(admin, npo.id, { titleLike: `${localMarker} old notification` })) === 0,
      "Old notifications should be deleted"
    );
    assert(
      (await countNotifications(admin, npo.id, { titleLike: `${localMarker} fresh notification` })) === 1,
      "Fresh notifications should remain"
    );

    const { data: jobsAfter, error: jobsAfterError } = await admin
      .from("notification_jobs")
      .select("dedupe_key")
      .ilike("dedupe_key", `%${localMarker}%`);
    if (jobsAfterError) throw jobsAfterError;
    const keys = new Set((jobsAfter || []).map((row) => row.dedupe_key));
    assert(!keys.has(`${localMarker}:sent`), "Old sent jobs should be deleted");
    assert(!keys.has(`${localMarker}:failed`), "Old failed jobs should be deleted");
    assert(keys.has(`${localMarker}:pending`), "Pending jobs should remain");

    const { data: storiesAfter, error: storiesAfterError } = await admin
      .from("stories")
      .select("caption")
      .eq("author_id", npo.id)
      .ilike("caption", `%${localMarker}%`);
    if (storiesAfterError) throw storiesAfterError;
    const captions = new Set((storiesAfter || []).map((row) => row.caption));
    assert(!captions.has(`${localMarker} old story`), "Expired stories should be deleted");
    assert(captions.has(`${localMarker} active story`), "Recent stories should remain");

    const { data: metricsAfter } = await admin
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", npo.id);
    const storiesThisMonthAfter = sumStoryMetricsSince(metricsAfter || [], startOfMonth().toISOString().slice(0, 10));
    assert(
      storiesThisMonthAfter === storiesThisMonthBefore,
      "Story retention must not affect published story counts"
    );

    return [
      "PASS retention deletes old notification_jobs and keeps pending ones",
      "PASS retention deletes notifications older than 20 days",
      "PASS retention deletes expired stories without touching report metrics",
    ];
  } finally {
    await admin.from("notification_jobs").delete().ilike("dedupe_key", `%${localMarker}%`);
    await admin.from("notifications").delete().ilike("title", `%${localMarker}%`);
    await admin.from("stories").delete().eq("author_id", npo.id).ilike("caption", `%${localMarker}%`);
    await admin.from("story_metrics_daily").delete().eq("author_id", npo.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runEventDrivenTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("EVENT");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Event Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Event NPO", npoName: "Event NPO" });
  let activityId = "";

  try {
    const { error: followError } = await admin.from("npo_followers").insert({
      npo_id: npo.id,
      follower_id: volunteer.id,
    });
    if (followError) throw followError;

    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const { data: activityRow, error: activityError } = await admin
      .from("activities")
      .insert({
        npo_id: npo.id,
        title: `${localMarker} activity`,
        description: `${localMarker} description`,
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        status: "APERTA",
        slots_total: 10,
      })
      .select("id")
      .single();
    if (activityError) throw activityError;
    activityId = activityRow.id;

    const { error: postError } = await admin.from("community_posts").insert({
      author_id: npo.id,
      caption: `${localMarker} published post`,
      status: "published",
    });
    if (postError) throw postError;

    const { error: storyError } = await admin.from("stories").insert({
      author_id: npo.id,
      image_url: `https://example.com/${localMarker}.jpg`,
      caption: `${localMarker} story`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (storyError) throw storyError;

    const { error: participantError } = await admin.from("activity_participants").insert({
      activity_id: activityId,
      user_id: volunteer.id,
      status: "APPROVED",
    });
    if (participantError) throw participantError;

    await new Promise((resolve) => setTimeout(resolve, 800));

    assert(
      (await countNotifications(admin, volunteer.id, { type: "FOLLOWED_NPO_ACTIVITY", messageLike: localMarker })) === 1,
      "Expected one followed activity notification"
    );
    assert(
      (await countNotifications(admin, volunteer.id, { type: "FOLLOWED_NPO_POST", messageLike: localMarker })) === 1,
      "Expected one followed post notification"
    );
    assert(
      (await countNotifications(admin, volunteer.id, { type: "FOLLOWED_NPO_STORY", messageLike: localMarker })) === 1,
      "Expected one followed story notification"
    );

    const { data: reminderJob, error: reminderError } = await admin
      .from("notification_jobs")
      .select("scheduled_for,status")
      .eq("dedupe_key", `activity_reminder_24h:${activityId}:${volunteer.id}`)
      .single();
    if (reminderError) throw reminderError;
    assert(reminderJob.status === "pending", "Expected pending reminder job");

    const { data: lowCoverageJob, error: lowCoverageError } = await admin
      .from("notification_jobs")
      .select("scheduled_for,status")
      .eq("dedupe_key", `npo_low_coverage:${activityId}`)
      .single();
    if (lowCoverageError) throw lowCoverageError;
    assert(lowCoverageJob.status === "pending", "Expected pending low coverage job");

    const newStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const newEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const { error: updateError } = await admin
      .from("activities")
      .update({
        date_start: newStart.toISOString(),
        date_end: newEnd.toISOString(),
      })
      .eq("id", activityId);
    if (updateError) throw updateError;

    await new Promise((resolve) => setTimeout(resolve, 800));

    const { data: reminderAfter, error: reminderAfterError } = await admin
      .from("notification_jobs")
      .select("scheduled_for")
      .eq("dedupe_key", `activity_reminder_24h:${activityId}:${volunteer.id}`)
      .single();
    if (reminderAfterError) throw reminderAfterError;
    assert(
      Math.abs(new Date(reminderAfter.scheduled_for).getTime() - (newStart.getTime() - 24 * 60 * 60 * 1000)) < 60_000,
      "Reminder job should be rescheduled on activity date change"
    );

    const { data: lowCoverageAfter, error: lowCoverageAfterError } = await admin
      .from("notification_jobs")
      .select("scheduled_for")
      .eq("dedupe_key", `npo_low_coverage:${activityId}`)
      .single();
    if (lowCoverageAfterError) throw lowCoverageAfterError;
    const expectedLowCoverageAt = Math.max(Date.now(), newStart.getTime() - 3 * 24 * 60 * 60 * 1000);
    assert(
      Math.abs(new Date(lowCoverageAfter.scheduled_for).getTime() - expectedLowCoverageAt) < 60_000,
      "Low coverage job should stay aligned with the activity start window"
    );

    return [
      "PASS activity/post/story follower notifications are generated by triggers",
      "PASS activity reminders are generated on participation events",
      "PASS low coverage jobs are generated on activity events without global scans",
    ];
  } finally {
    if (activityId) {
      await admin.from("activity_participants").delete().eq("activity_id", activityId);
      await admin.from("activities").delete().eq("id", activityId);
      await admin.from("notification_jobs").delete().ilike("dedupe_key", `%${activityId}%`);
    }
    await admin.from("community_posts").delete().eq("author_id", npo.id).ilike("caption", `%${localMarker}%`);
    await admin.from("stories").delete().eq("author_id", npo.id).ilike("caption", `%${localMarker}%`);
    await admin.from("notifications").delete().eq("user_id", volunteer.id).ilike("message", `%${localMarker}%`);
    await admin.from("npo_followers").delete().eq("npo_id", npo.id).eq("follower_id", volunteer.id);
    await admin.from("story_metrics_daily").delete().eq("author_id", npo.id);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runCronModesTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("CRON");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Cron Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Cron NPO", npoName: "Cron NPO" });
  const inactiveVolunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Inactive Volunteer" });
  const inactiveNpo = await createProfile(admin, { role: "NPO", fullName: "Inactive NPO", npoName: "Inactive NPO" });
  let activityId = "";

  try {
    const endedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const startedAt = new Date(endedAt.getTime() - 2 * 60 * 60 * 1000);

    const { data: activityRow, error: activityError } = await admin
      .from("activities")
      .insert({
        npo_id: npo.id,
        title: `${localMarker} completed activity`,
        description: localMarker,
        date_start: startedAt.toISOString(),
        date_end: endedAt.toISOString(),
        status: "COMPLETATA",
        slots_total: 5,
      })
      .select("id")
      .single();
    if (activityError) throw activityError;
    activityId = activityRow.id;

    const { error: participantError } = await admin.from("activity_participants").insert({
      activity_id: activityId,
      user_id: volunteer.id,
      status: "APPROVED",
    });
    if (participantError) throw participantError;

    const { error: applicationError } = await admin.from("applications").insert({
      npo_id: npo.id,
      volunteer_id: volunteer.id,
      status: "PENDING",
      message: localMarker,
      created_at: new Date().toISOString(),
    });
    if (applicationError) throw applicationError;

    const { error: followError } = await admin.from("npo_followers").insert({
      npo_id: npo.id,
      follower_id: volunteer.id,
      created_at: new Date().toISOString(),
    });
    if (followError) throw followError;

    const now = new Date();
    await queueReviewReminderFallbackJobs(admin, now);
    await processDueJobs(admin, now, 200);
    await queueReviewReminderFallbackJobs(admin, now);
    await processDueJobs(admin, now, 200);
    await queueWeeklyNpoRecaps(admin, now);
    await queueWeeklyVolunteerRecaps(admin, now);
    await processDueJobs(admin, now, 500);
    await queueWeeklyNpoRecaps(admin, now);
    await queueWeeklyVolunteerRecaps(admin, now);
    await processDueJobs(admin, now, 500);

    assert(
      (await countNotifications(admin, volunteer.id, { type: "REVIEW_REMINDER" })) === 1,
      "Review reminder backfill must be idempotent"
    );
    assert(
      (await countNotifications(admin, npo.id, { type: "NPO_WEEKLY_RECAP" })) === 1,
      "NPO weekly recap must be deduplicated"
    );
    assert(
      (await countNotifications(admin, volunteer.id, { type: "VOLUNTEER_WEEKLY_RECAP" })) === 1,
      "Volunteer weekly recap must be deduplicated"
    );
    assert(
      (await countNotifications(admin, inactiveNpo.id, { titleLike: "Riattiva la tua community" })) === 1,
      "Inactive NPO should receive one re-engagement notification instead of a weekly recap"
    );
    assert(
      (await countNotifications(admin, inactiveNpo.id, { type: "NPO_WEEKLY_RECAP" })) === 0,
      "Inactive NPO must not receive a weekly recap"
    );
    assert(
      (await countNotifications(admin, inactiveVolunteer.id, { titleLike: "Torna a dare una mano" })) === 1,
      "Inactive volunteer should receive one re-engagement notification instead of a weekly recap"
    );
    assert(
      (await countNotifications(admin, inactiveVolunteer.id, { type: "VOLUNTEER_WEEKLY_RECAP" })) === 0,
      "Inactive volunteer must not receive a weekly recap"
    );

    return [
      "PASS review reminder backfill is idempotent across repeated runs",
      "PASS weekly recaps are deduplicated across repeated runs",
      "PASS inactive users receive re-engagement notifications instead of weekly recaps",
    ];
  } finally {
    if (activityId) {
      await admin.from("activity_participants").delete().eq("activity_id", activityId);
      await admin.from("activities").delete().eq("id", activityId);
    }
    await admin.from("applications").delete().eq("npo_id", npo.id).eq("volunteer_id", volunteer.id);
    await admin.from("npo_followers").delete().eq("npo_id", npo.id).eq("follower_id", volunteer.id);
    await admin.from("notifications").delete().eq("user_id", volunteer.id).in("type", ["REVIEW_REMINDER", "VOLUNTEER_WEEKLY_RECAP"]);
    await admin.from("notifications").delete().eq("user_id", npo.id).eq("type", "NPO_WEEKLY_RECAP");
    await admin.from("notifications").delete().eq("user_id", inactiveVolunteer.id).eq("title", "Torna a dare una mano");
    await admin.from("notifications").delete().eq("user_id", inactiveNpo.id).eq("title", "Riattiva la tua community");
    await admin.from("notification_jobs").delete().eq("user_id", volunteer.id).in("type", ["REVIEW_REMINDER", "VOLUNTEER_WEEKLY_RECAP"]);
    await admin.from("notification_jobs").delete().eq("user_id", npo.id).eq("type", "NPO_WEEKLY_RECAP");
    await admin.from("notification_jobs").delete().eq("user_id", inactiveVolunteer.id).eq("title", "Torna a dare una mano");
    await admin.from("notification_jobs").delete().eq("user_id", inactiveNpo.id).eq("title", "Riattiva la tua community");
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
    await deleteProfile(admin, inactiveVolunteer.id);
    await deleteProfile(admin, inactiveNpo.id);
  }
}

async function runNotificationContextTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("NOTIFCTX");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Notification Context Volunteer" });

  try {
    const rows = Array.from({ length: 60 }).map((_, index) => ({
      user_id: volunteer.id,
      type: index % 3 === 0 ? "ACTIVITY_REMINDER" : "INFO",
      title: `${localMarker} notification ${index}`,
      message: `${localMarker} message ${index}`,
      read: index >= 17,
      related_activity_id: null,
      related_conversation_id: null,
      match_score: index === 0 ? 88 : null,
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
    }));
    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) throw insertError;

    const { data: listRows, error: listError } = await admin
      .from("notifications")
      .select("id,user_id,type,title,message,read,related_activity_id,related_conversation_id,created_at,match_score")
      .eq("user_id", volunteer.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (listError) throw listError;

    const { count: unreadCount, error: unreadError } = await admin
      .from("notifications")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", volunteer.id)
      .eq("read", false);
    if (unreadError) throw unreadError;

    assert((listRows || []).length === 50, "Notification list query must cap at 50 rows");
    assert(unreadCount === 17, `Unread count query must stay exact, found ${unreadCount}`);
    assert(
      (listRows || []).every((row: any) => "id" in row && "title" in row && "message" in row && "read" in row),
      "Notification list query must include all fields required by the UI"
    );

    return [
      "PASS notification list query is capped at 50 rows",
      "PASS unread count remains exact with a separate count query",
      "PASS selected notification fields are sufficient for the current UI",
    ];
  } finally {
    await admin.from("notifications").delete().ilike("title", `%${localMarker}%`);
    await deleteProfile(admin, volunteer.id);
  }
}

async function runAuthBanFlowTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("BANFLOW");
  const created = await createProfile(admin, {
    role: "VOLUNTEER",
    fullName: `Ban Flow ${localMarker}`,
  });

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  try {
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: created.email,
      password: "TempPass123",
    });
    if (signInError) throw signInError;
    assert(signInData.session?.user?.id === created.id, "Sign-in should still succeed with auth-hook SignIn path");

    const { error: banUpdateError } = await admin
      .from("profiles")
      .update({
        is_banned: true,
        ban_reason: `${localMarker} reason`,
        ban_report_id: null,
      })
      .eq("id", created.id);
    if (banUpdateError) throw banUpdateError;

    const { data: bannedProfile, error: bannedProfileError } = await anonClient
      .from("profiles")
      .select("is_banned, ban_reason, ban_report_id")
      .eq("id", created.id)
      .single();
    if (bannedProfileError) throw bannedProfileError;

    assert(bannedProfile?.is_banned === true, "Foreground profile sync must observe an immediate ban");
    assert(
      typeof bannedProfile?.ban_reason === "string" && bannedProfile.ban_reason.includes(localMarker),
      "Foreground profile sync must include the current ban reason"
    );

    return [
      "PASS sign-in still succeeds with auth-hook restricted to SignIn",
      "PASS authenticated profile query sees ban changes for live foreground sync",
    ];
  } finally {
    await admin
      .from("profiles")
      .update({ is_banned: false, ban_reason: null, ban_report_id: null })
      .eq("id", created.id);
    await deleteProfile(admin, created.id);
  }
}

Deno.serve(async (req) => {
  try {
    const mode = ((await req.json().catch(() => ({})))?.mode || "full") as Mode;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const runOne = async (target: Exclude<Mode, "full">) => {
      switch (target) {
        case "pipeline":
          return runPipelineTest(admin);
        case "story_metrics":
          return runStoryMetricsTest(admin);
        case "retention":
          return runRetentionTest(admin);
        case "event_driven":
          return runEventDrivenTest(admin);
        case "cron_modes":
          return runCronModesTest(admin);
        case "notification_context":
          return runNotificationContextTest(admin);
        case "auth_ban_flow":
          return runAuthBanFlowTest(admin);
        default:
          throw new Error(`Unsupported smoke mode: ${String(target)}`);
      }
    };

    const results =
      mode === "full"
        ? {
            pipeline: await runOne("pipeline"),
            story_metrics: await runOne("story_metrics"),
            retention: await runOne("retention"),
            event_driven: await runOne("event_driven"),
            cron_modes: await runOne("cron_modes"),
            notification_context: await runOne("notification_context"),
            auth_ban_flow: await runOne("auth_ban_flow"),
          }
        : { [mode]: await runOne(mode) };

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("[notification-refactor-smoke] Error", error);
    const formattedError =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: typeof error === "string" ? error : JSON.stringify(error) };
    return new Response(JSON.stringify({ success: false, error: formattedError }, null, 2), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
