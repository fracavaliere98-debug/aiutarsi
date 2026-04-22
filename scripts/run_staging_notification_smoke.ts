function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const anonKey =
  process.env.STAGING_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";
const supabaseUrl = process.env.STAGING_SUPABASE_URL || "https://pavnfiladmnwbptwlwpr.supabase.co";

export async function runStagingNotificationSmoke(
  mode:
    | "pipeline"
    | "routing_payloads"
    | "story_metrics"
    | "retention"
    | "event_driven"
    | "cron_modes"
    | "notification_context"
    | "auth_ban_flow"
    | "full"
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/notification-refactor-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Smoke function returned failure: ${JSON.stringify(payload)}`);
  if (mode === "full") {
    const keys = Object.keys(payload.results || {});
    for (const expectedKey of [
      "pipeline",
      "routing_payloads",
      "story_metrics",
      "retention",
      "event_driven",
      "cron_modes",
      "notification_context",
      "auth_ban_flow",
    ]) {
      assert(keys.includes(expectedKey), `Full notification smoke is missing '${expectedKey}' results`);
    }
  }

  return payload.results?.[mode] || payload.results;
}

if (import.meta.main) {
  const modeArg =
    (process.argv[2] as
      | "pipeline"
      | "routing_payloads"
      | "story_metrics"
      | "retention"
      | "event_driven"
      | "cron_modes"
      | "notification_context"
      | "auth_ban_flow"
      | "full"
      | undefined) || "full";

  runStagingNotificationSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
