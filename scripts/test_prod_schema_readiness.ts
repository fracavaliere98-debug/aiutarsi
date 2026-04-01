import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const schemaPath = process.argv[2] || "/tmp/prod_ready_public_schema.sql";

function run() {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema dump not found: ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");

  assert(
    !/https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\//.test(schema),
    "Remote public schema still contains direct Edge Function URLs",
  );
  assert(
    !/pavnfiladmnwbptwlwpr/.test(schema),
    "Remote public schema still contains the staging project ref",
  );
  assert(
    !/Authorization":"Bearer eyJ/.test(schema),
    "Remote public schema still contains a hardcoded bearer token",
  );
  assert(
    /CREATE OR REPLACE FUNCTION "public"\."build_edge_function_url"/.test(schema),
    "Remote public schema is missing build_edge_function_url",
  );
  assert(
    /CREATE OR REPLACE FUNCTION "public"\."invoke_community_moderator_webhook"/.test(schema),
    "Remote public schema is missing invoke_community_moderator_webhook",
  );
  assert(
    /CREATE OR REPLACE TRIGGER "moderation-webhook".*EXECUTE FUNCTION "public"\."invoke_community_moderator_webhook"\(\)/s.test(schema),
    "Moderation trigger is not using the environment-safe wrapper",
  );
  assert(
    /GRANT ALL ON FUNCTION "public"\."invoke_process_notification_jobs"\("p_limit" integer\) TO "service_role";/.test(schema),
    "invoke_process_notification_jobs is not granted to service_role",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_process_notification_jobs"\("p_limit" integer\) TO "anon";/.test(schema),
    "invoke_process_notification_jobs is still granted to anon",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_process_notification_jobs"\("p_limit" integer\) TO "authenticated";/.test(schema),
    "invoke_process_notification_jobs is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."build_edge_function_url"\("p_function_name" "text"\) TO "anon";/.test(schema),
    "build_edge_function_url is still granted to anon",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."build_edge_function_url"\("p_function_name" "text"\) TO "authenticated";/.test(schema),
    "build_edge_function_url is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."call_generate_embedding"\(\) TO "anon";/.test(schema),
    "call_generate_embedding is still granted to anon",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."call_generate_embedding"\(\) TO "authenticated";/.test(schema),
    "call_generate_embedding is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_community_moderator_webhook"\(\) TO "anon";/.test(schema),
    "invoke_community_moderator_webhook is still granted to anon",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_community_moderator_webhook"\(\) TO "authenticated";/.test(schema),
    "invoke_community_moderator_webhook is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_push_notification_webhook"\(\) TO "anon";/.test(schema),
    "invoke_push_notification_webhook is still granted to anon",
  );
  assert(
    !/GRANT ALL ON FUNCTION "public"\."invoke_push_notification_webhook"\(\) TO "authenticated";/.test(schema),
    "invoke_push_notification_webhook is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON TABLE "public"\."runtime_settings" TO "anon";/.test(schema),
    "runtime_settings is still granted to anon",
  );
  assert(
    !/GRANT ALL ON TABLE "public"\."runtime_settings" TO "authenticated";/.test(schema),
    "runtime_settings is still granted to authenticated",
  );
  assert(
    !/GRANT ALL ON TABLE "public"\."internal_secrets" TO "anon";/.test(schema),
    "internal_secrets is still granted to anon",
  );
  assert(
    !/GRANT ALL ON TABLE "public"\."internal_secrets" TO "authenticated";/.test(schema),
    "internal_secrets is still granted to authenticated",
  );
  assert(
    /where key = 'functions_base_url';/.test(schema),
    "build_edge_function_url is not driven by runtime_settings.functions_base_url",
  );

  console.log("PASS no direct Edge Function URLs in remote public schema");
  console.log("PASS no staging project ref in remote public schema");
  console.log("PASS no hardcoded bearer token in remote public schema");
  console.log("PASS moderation trigger uses environment-safe wrapper");
  console.log("PASS process_notification_jobs wrapper is not public");
  console.log("PASS internal wrappers and secrets tables are not public");
  console.log("PASS build_edge_function_url is driven by runtime_settings");
  console.log("Remote schema prod-readiness checks passed.");
}

run();
