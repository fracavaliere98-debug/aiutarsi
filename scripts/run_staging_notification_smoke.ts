import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";
import { isMainModule } from "./lib/isMainModule";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("notifications");
  const response = await fetch(`${supabaseUrl}/functions/v1/notification-refactor-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
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

if (isMainModule(import.meta.url)) {
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
