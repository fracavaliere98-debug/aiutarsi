import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";
import { isMainModule } from "./lib/isMainModule";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runStagingActivitySmoke(mode: "query_consistency" | "state_transitions" | "full" = "full") {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("activity");
  const response = await fetch(`${supabaseUrl}/functions/v1/activity-refactor-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Activity smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Activity smoke returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}

if (isMainModule(import.meta.url)) {
  const modeArg = (process.argv[2] as "query_consistency" | "state_transitions" | "full" | undefined) || "full";
  runStagingActivitySmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
