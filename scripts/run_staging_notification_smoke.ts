function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publishableKey = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_FKUql9lqBWUtKsFkQJGqvA_GciDonhq";
const supabaseUrl = process.env.STAGING_SUPABASE_URL || "https://pavnfiladmnwbptwlwpr.supabase.co";

export async function runStagingNotificationSmoke(mode: "pipeline" | "story_metrics" | "retention" | "event_driven" | "cron_modes" | "full") {
  const response = await fetch(`${supabaseUrl}/functions/v1/notification-refactor-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
    },
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Smoke function returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}
