import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractSupabaseProjectRef(url: string) {
  if (!url) return "";

  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function readRepoFile(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function assertNoForbiddenRefs(filePath: string, forbiddenPatterns: RegExp[]) {
  const content = readRepoFile(...filePath.split("/"));
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(content), `${filePath} still contains forbidden pattern: ${pattern}`);
  }
}

function run() {
  console.log("Running prod migration readiness checks...");

  assert(
    extractSupabaseProjectRef("https://pavnfiladmnwbptwlwpr.supabase.co") === "pavnfiladmnwbptwlwpr",
    "extractSupabaseProjectRef should derive the project ref from a Supabase URL",
  );
  assert(
    extractSupabaseProjectRef("not-a-url") === "",
    "extractSupabaseProjectRef should return an empty string for invalid URLs",
  );

  const forbiddenHardcodedStaging = [
    /pavnfiladmnwbptwlwpr/,
    /b14b866c-c340-4e7d-a7ad-a6ec9a9935b3/,
    /https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/process-notification-jobs/,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/,
  ];

  [
    "utils/runtimeConfig.ts",
    "hooks/usePushNotifications.ts",
    "services/AuthService.ts",
    "context/AuthContext.tsx",
    "scripts/dist_auth/test_auth_flow.js",
    "test-gemma.js",
  ].forEach((filePath) => assertNoForbiddenRefs(filePath, forbiddenHardcodedStaging));

  const legacyCronMigration = readRepoFile("supabase", "migrations", "20260331170000_schedule_process_notification_jobs.sql");
  assert(
    !/net\.http_post\(/.test(legacyCronMigration),
    "Legacy cron migration must not directly call net.http_post anymore",
  );
  assert(
    /Environment-safe scheduling is installed by:/.test(legacyCronMigration),
    "Legacy cron migration should explain the environment-safe replacement",
  );

  const safeCronMigration = readRepoFile("supabase", "migrations", "20260401101500_make_notification_cron_environment_safe.sql");
  assert(
    /create table if not exists public\.runtime_settings/.test(safeCronMigration),
    "Environment-safe cron migration must create runtime_settings",
  );
  assert(
    /create or replace function public\.invoke_process_notification_jobs/.test(safeCronMigration),
    "Environment-safe cron migration must create invoke_process_notification_jobs",
  );
  assert(
    /select cron\.schedule\([\s\S]*invoke_process_notification_jobs\(100\)/.test(safeCronMigration),
    "Environment-safe cron migration must schedule the wrapper function",
  );

  const permissionHardeningMigration = readRepoFile("supabase", "migrations", "20260401104000_lockdown_runtime_settings_permissions.sql");
  assert(
    /revoke all on function public\.invoke_process_notification_jobs\(integer\) from anon, authenticated;/.test(permissionHardeningMigration),
    "Permission migration must revoke invoke_process_notification_jobs from anon/authenticated",
  );
  assert(
    /grant execute on function public\.invoke_process_notification_jobs\(integer\) to service_role;/.test(permissionHardeningMigration),
    "Permission migration must grant invoke_process_notification_jobs to service_role",
  );

  console.log("PASS extractSupabaseProjectRef");
  console.log("PASS app runtime files are free of hardcoded staging refs");
  console.log("PASS legacy cron migration is safe for fresh bootstraps");
  console.log("PASS environment-safe cron migration defines wrapper and runtime settings");
  console.log("PASS permission hardening migration locks down wrapper execution");
  console.log("All prod migration readiness checks passed.");
}

run();
