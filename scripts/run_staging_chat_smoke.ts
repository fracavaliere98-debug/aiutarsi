import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runStagingChatSmoke(
  mode: "query_consistency" | "state_transitions" | "inbox_visibility" | "full" = "full"
) {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("chat");
  const response = await fetch(`${supabaseUrl}/functions/v1/chat-refactor-smoke`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Chat smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Chat smoke returned failure: ${JSON.stringify(payload)}`);
  if (mode === "full") {
    const keys = Object.keys(payload.results || {});
    for (const expectedKey of ["query_consistency", "state_transitions", "inbox_visibility"]) {
      assert(keys.includes(expectedKey), `Full chat smoke is missing '${expectedKey}' results`);
    }
  }

  return payload.results?.[mode] || payload.results;
}

if (import.meta.main) {
  const modeArg =
    (process.argv[2] as "query_consistency" | "state_transitions" | "inbox_visibility" | "full" | undefined) || "full";
  runStagingChatSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
