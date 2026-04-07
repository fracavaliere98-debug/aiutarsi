import { createClient } from "@supabase/supabase-js";
import { computeNPOReportSummary } from "../services/ReportService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function main() {
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || "";
  const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
  assert(supabaseUrl, "Missing STAGING_SUPABASE_URL");
  assert(serviceRoleKey, "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = uniqueEmail("story.metrics.npo");
  const marker = `E2E_STORY_METRICS_${Date.now()}`;
  let userId = "";
  let storyId = "";

  try {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: "TempPass123",
      email_confirm: true,
      user_metadata: {
        full_name: "Story Metrics NPO Test",
        role: "NPO",
        npo_name: "Story Metrics NPO Test",
      },
    });
    if (authError) throw authError;
    assert(authUser.user, "Missing auth user");
    userId = authUser.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: "Story Metrics NPO Test",
      role: "NPO",
      npo_name: "Story Metrics NPO Test",
      profile_completed: true,
      email_confirmed: true,
      verification_status: "verified",
    });
    if (profileError) throw profileError;

    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const currentMonthStoryDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const { error: insertStoriesError } = await admin.from("stories").insert([
      {
        author_id: userId,
        image_url: `https://example.com/${marker}-month.jpg`,
        caption: `${marker} current month`,
        created_at: currentMonthStoryDate.toISOString(),
        expires_at: new Date(currentMonthStoryDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author_id: userId,
        image_url: `https://example.com/${marker}-week.jpg`,
        caption: `${marker} current week`,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author_id: userId,
        image_url: `https://example.com/${marker}-old.jpg`,
        caption: `${marker} old month`,
        created_at: tenDaysAgo.toISOString(),
        expires_at: new Date(tenDaysAgo.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
    if (insertStoriesError) throw insertStoriesError;

    const { data: stories, error: storiesError } = await admin
      .from("stories")
      .select("id,caption")
      .ilike("caption", `%${marker}%`)
      .order("created_at", { ascending: false });
    if (storiesError) throw storiesError;
    assert((stories || []).length === 3, "Expected 3 test stories");
    storyId = stories?.[0]?.id || "";

    const { data: metricsRows, error: metricsError } = await (admin as any)
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", userId);
    if (metricsError) throw metricsError;

    const summary = computeNPOReportSummary({
      npoId: userId,
      activities: [],
      applications: [],
      activityApplications: [],
      followerRows: [],
      postRows: [],
      storyMetricRows: metricsRows || [],
      reactionRows: [],
    });

    assert(summary.storiesThisMonth >= 2, "Expected at least 2 stories this month");
    assert(summary.storiesThisWeek >= 1, "Expected at least 1 story this week");

    if (storyId) {
      const { error: deleteStoryError } = await admin.from("stories").delete().eq("id", storyId);
      if (deleteStoryError) throw deleteStoryError;
    }

    const { data: metricsAfterDelete, error: metricsAfterDeleteError } = await (admin as any)
      .from("story_metrics_daily")
      .select("metric_date,stories_count")
      .eq("author_id", userId);
    if (metricsAfterDeleteError) throw metricsAfterDeleteError;

    const summaryAfterDelete = computeNPOReportSummary({
      npoId: userId,
      activities: [],
      applications: [],
      activityApplications: [],
      followerRows: [],
      postRows: [],
      storyMetricRows: metricsAfterDelete || [],
      reactionRows: [],
    });

    assert(
      summaryAfterDelete.storiesThisMonth === summary.storiesThisMonth,
      "Deleting a story should not decrement published story counts"
    );

    console.log("PASS story insert increments daily metrics");
    console.log("PASS NPO report reads story counts from metrics");
    console.log("PASS deleting a story does not decrement published counts");
  } finally {
    await admin.from("stories").delete().ilike("caption", `%${marker}%`);
    await (admin as any).from("story_metrics_daily").delete().eq("author_id", userId);
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
