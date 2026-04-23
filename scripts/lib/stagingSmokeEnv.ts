type RequiredEnvName = "STAGING_SUPABASE_URL" | "STAGING_SUPABASE_ANON_KEY";

function missingEnvError(smokeName: string, requiredEnv: readonly RequiredEnvName[]) {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length === 0) return;

  throw new Error(
    [
      `missing required env for staging smoke: ${smokeName}`,
      `required: ${requiredEnv.join(", ")}`,
      `missing: ${missing.join(", ")}`,
    ].join("\n")
  );
}

export function requireStagingSupabaseEnv(smokeName: string) {
  const requiredEnv = ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY"] as const;
  missingEnvError(smokeName, requiredEnv);

  return {
    supabaseUrl: process.env.STAGING_SUPABASE_URL as string,
    anonKey: process.env.STAGING_SUPABASE_ANON_KEY as string,
  };
}

export function buildStagingSupabaseHeaders(anonKey: string, withAuthorization = false) {
  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    ...(withAuthorization ? { Authorization: `Bearer ${anonKey}` } : {}),
  };
}
