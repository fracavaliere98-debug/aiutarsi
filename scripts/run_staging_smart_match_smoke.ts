function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publishableKey = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_FKUql9lqBWUtKsFkQJGqvA_GciDonhq";
const supabaseUrl = process.env.STAGING_SUPABASE_URL || "https://pavnfiladmnwbptwlwpr.supabase.co";

export async function runStagingSmartMatchSmoke(mode: "query_consistency" | "state_transitions" | "full" = "full") {
  const response = await fetch(`${supabaseUrl}/functions/v1/smart-match-refactor-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
    },
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Smart match smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Smart match smoke returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}

if (import.meta.main) {
  const modeArg = (process.argv[2] as "query_consistency" | "state_transitions" | "full" | undefined) || "full";
  runStagingSmartMatchSmoke(modeArg)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
