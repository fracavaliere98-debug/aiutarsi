function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const anonKey =
  process.env.STAGING_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdm5maWxhZG1ud2JwdHdsd3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTgyMzEsImV4cCI6MjA4NjgzNDIzMX0.pmW7FTzjz9QMKhRlILtnvL_DMXYX0HkhpnEkM7WQ39M";
const supabaseUrl = process.env.STAGING_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "https://pavnfiladmnwbptwlwpr.supabase.co";

export async function runStagingStoryViewsSmoke(
  mode: "idempotence" | "cross_device" | "viewer_scope" | "full" = "full"
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/story-views-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
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

if (import.meta.main) {
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
