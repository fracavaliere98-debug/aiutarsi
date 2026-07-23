import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";
import { isMainModule } from "./lib/isMainModule";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runStagingStoryViewsSmoke(
  mode: "idempotence" | "cross_device" | "viewer_scope" | "full" = "full"
) {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("story-views");
  const response = await fetch(`${supabaseUrl}/functions/v1/story-views-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Story views smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Story views smoke returned failure: ${JSON.stringify(payload)}`);
  if (mode === "full") {
    const keys = Object.keys(payload.results || {});
    for (const expectedKey of ["idempotence", "cross_device", "viewer_scope"]) {
      assert(keys.includes(expectedKey), `Full story views smoke is missing '${expectedKey}' results`);
    }
  }

  return payload.results?.[mode] || payload.results;
}

if (isMainModule(import.meta.url)) {
  const modeArg =
    (process.argv[2] as "idempotence" | "cross_device" | "viewer_scope" | "full" | undefined) || "full";
  runStagingStoryViewsSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
