import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";
import { isMainModule } from "./lib/isMainModule";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runStagingApplicationSmoke(mode: "query_consistency" | "state_transitions" | "full" = "full") {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("application");
  const response = await fetch(`${supabaseUrl}/functions/v1/application-refactor-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Application smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Application smoke returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}

if (isMainModule(import.meta.url)) {
  const modeArg = (process.argv[2] as "query_consistency" | "state_transitions" | "full" | undefined) || "full";
  runStagingApplicationSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
