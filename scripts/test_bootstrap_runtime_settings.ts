import { deriveRuntimeSettings } from "./bootstrap_runtime_settings";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const rows = deriveRuntimeSettings("https://example-project.supabase.co/");
  assert(rows.length === 2, "Expected two runtime settings rows");

  const functionsBase = rows.find((row) => row.key === "functions_base_url");
  const processJobs = rows.find((row) => row.key === "process_notification_jobs_url");

  assert(functionsBase?.value === "https://example-project.supabase.co/functions/v1", "Unexpected functions_base_url");
  assert(
    processJobs?.value === "https://example-project.supabase.co/functions/v1/process-notification-jobs",
    "Unexpected process_notification_jobs_url",
  );

  console.log("PASS bootstrap runtime settings derivation");
}

run();
