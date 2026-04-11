function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const anonKey =
  process.env.STAGING_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";
const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "https://pavnfiladmnwbptwlwpr.supabase.co";

export async function runStagingApplicationSmoke(mode: "query_consistency" | "state_transitions" | "full" = "full") {
  const response = await fetch(`${supabaseUrl}/functions/v1/application-refactor-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `Application smoke function failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `Application smoke returned failure: ${JSON.stringify(payload)}`);

  return payload.results?.[mode] || payload.results;
}

if (import.meta.main) {
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
