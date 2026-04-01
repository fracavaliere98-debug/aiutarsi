import path from "node:path";
import "dotenv/config";

type RuntimeSettingRow = {
  key: string;
  value: string;
  description: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function deriveRuntimeSettings(supabaseUrl: string): RuntimeSettingRow[] {
  const baseUrl = normalizeBaseUrl(supabaseUrl);
  const functionsBaseUrl = `${baseUrl}/functions/v1`;

  return [
    {
      key: "functions_base_url",
      value: functionsBaseUrl,
      description: "Base URL for Supabase Edge Functions, without trailing slash.",
    },
    {
      key: "process_notification_jobs_url",
      value: `${functionsBaseUrl}/process-notification-jobs`,
      description: "Edge Function URL used by pg_cron to process queued notification jobs.",
    },
  ];
}

async function upsertRuntimeSettings(rows: RuntimeSettingRow[], supabaseUrl: string, serviceRoleKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(`${normalizeBaseUrl(supabaseUrl)}/rest/v1/runtime_settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Upsert failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as RuntimeSettingRow[];
}

async function fetchRuntimeSettings(keys: string[], supabaseUrl: string, serviceRoleKey: string) {
  const inClause = keys.map((key) => `"${key}"`).join(",");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(
    `${normalizeBaseUrl(supabaseUrl)}/rest/v1/runtime_settings?select=key,value,description&key=in.(${encodeURIComponent(inClause)})`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    },
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as RuntimeSettingRow[];
}

async function run() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";
  const dryRun = process.argv.includes("--dry-run");

  assert(supabaseUrl, "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL");

  const rows = deriveRuntimeSettings(supabaseUrl);
  console.log("Derived runtime settings:");
  for (const row of rows) {
    console.log(`- ${row.key}=${row.value}`);
  }

  if (dryRun) {
    console.log("Dry run: no changes applied.");
    return;
  }

  assert(serviceRoleKey, "Missing SUPABASE_SERVICE_ROLE_KEY");

  const upserted = await upsertRuntimeSettings(rows, supabaseUrl, serviceRoleKey);
  const fetched = await fetchRuntimeSettings(
    rows.map((row) => row.key),
    supabaseUrl,
    serviceRoleKey,
  );

  assert(upserted.length === rows.length, "Upsert did not return all runtime settings rows");
  assert(fetched.length === rows.length, "Verification fetch did not return all runtime settings rows");

  for (const row of rows) {
    const match = fetched.find((item) => item.key === row.key);
    assert(match, `Missing runtime setting after upsert: ${row.key}`);
    assert(match.value === row.value, `Unexpected value for ${row.key}`);
  }

  console.log("Runtime settings bootstrap applied and verified.");
}

export { deriveRuntimeSettings };

if (path.basename(process.argv[1] || "") === "bootstrap_runtime_settings.ts") {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
