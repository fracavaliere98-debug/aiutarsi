type Probe = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(value: string | undefined, key: string): string {
  assert(value, `${key} is required`);
  return value as string;
}

async function probe(baseUrl: string, anonKey: string, item: Probe) {
  const response = await fetch(`${baseUrl}${item.path}`, {
    method: item.method ?? "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: item.body ? JSON.stringify(item.body) : undefined,
  });

  const text = await response.text();
  return { status: response.status, text };
}

async function run() {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const checkedBaseUrl = requireEnv(baseUrl, "EXPO_PUBLIC_SUPABASE_URL");
  const checkedAnonKey = requireEnv(anonKey, "EXPO_PUBLIC_SUPABASE_ANON_KEY");

  const probes: Probe[] = [
    {
      name: "runtime_settings table",
      path: "/rest/v1/runtime_settings?select=key,value",
    },
    {
      name: "internal_secrets table",
      path: "/rest/v1/internal_secrets?select=key",
    },
    {
      name: "invoke_process_notification_jobs rpc",
      path: "/rest/v1/rpc/invoke_process_notification_jobs",
      method: "POST",
      body: {},
    },
    {
      name: "invoke_notification_review_backfill rpc",
      path: "/rest/v1/rpc/invoke_notification_review_backfill",
      method: "POST",
      body: {},
    },
    {
      name: "invoke_notification_weekly_recaps rpc",
      path: "/rest/v1/rpc/invoke_notification_weekly_recaps",
      method: "POST",
      body: {},
    },
    {
      name: "invoke_notification_retention_cleanup rpc",
      path: "/rest/v1/rpc/invoke_notification_retention_cleanup",
      method: "POST",
      body: {},
    },
    {
      // Guards the 2026-07-22 account-deletion fix: this RPC wraps
      // internal_secrets.service_role_key into an Authorization header, so it
      // must stay unreachable for anon/authenticated, same as the
      // notification invoke_* functions above.
      name: "invoke_process_account_deletions rpc",
      path: "/rest/v1/rpc/invoke_process_account_deletions",
      method: "POST",
      body: {},
    },
    {
      name: "build_edge_function_url rpc",
      path: "/rest/v1/rpc/build_edge_function_url",
      method: "POST",
      body: { p_function_name: "x" },
    },
    {
      name: "call_generate_embedding rpc",
      path: "/rest/v1/rpc/call_generate_embedding",
      method: "POST",
      body: {},
    },
  ];

  for (const item of probes) {
    const result = await probe(checkedBaseUrl, checkedAnonKey, item);
    assert(
      result.status >= 400,
      `${item.name} is still publicly reachable (status ${result.status}, body: ${result.text})`,
    );
    console.log(`PASS ${item.name} blocked for anon (${result.status})`);
  }

  console.log("Production runtime lockdown checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
