import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runStagingGamificationSmoke(mode: "state_consistency" | "share_invalidation" | "full" = "full") {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("gamification");
  const response = await fetch(`${supabaseUrl}/functions/v1/gamification-refactor-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey),
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Gamification smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Gamification smoke returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}

if (import.meta.main) {
  const modeArg = (process.argv[2] as "state_consistency" | "share_invalidation" | "full" | undefined) || "full";
  runStagingGamificationSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
