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

  assert(baseUrl, "EXPO_PUBLIC_SUPABASE_URL is required");
  assert(anonKey, "EXPO_PUBLIC_SUPABASE_ANON_KEY is required");

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
    const result = await probe(baseUrl, anonKey, item);
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
