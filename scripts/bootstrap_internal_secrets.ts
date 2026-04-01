type SecretRow = {
  key: string;
  value: string;
};

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function upsertSecrets(baseUrl: string, serviceRoleKey: string, rows: SecretRow[]) {
  const response = await fetch(`${baseUrl}/rest/v1/internal_secrets?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`internal_secrets bootstrap failed (${response.status}): ${text}`);
  }

  return text;
}

async function verifySecrets(baseUrl: string, serviceRoleKey: string, expectedKeys: string[]) {
  const filter = expectedKeys.map((key) => `"${key}"`).join(",");
  const response = await fetch(
    `${baseUrl}/rest/v1/internal_secrets?select=key&key=in.(${filter})`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`internal_secrets verification failed (${response.status}): ${text}`);
  }

  const rows = JSON.parse(text) as { key: string }[];
  const actual = new Set(rows.map((row) => row.key));
  for (const key of expectedKeys) {
    assert(actual.has(key), `Missing internal secret after bootstrap: ${key}`);
  }
}

async function run() {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
  const dryRun = process.argv.includes("--dry-run");

  assert(baseUrl, "EXPO_PUBLIC_SUPABASE_URL is required");
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");

  const rows: SecretRow[] = [
    {
      key: "service_role_key",
      value: serviceRoleKey!,
    },
  ];

  if (huggingFaceApiKey) {
    rows.push({
      key: "HUGGINGFACE_API_KEY",
      value: huggingFaceApiKey,
    });
  }

  console.log("Derived internal secrets bootstrap payload:");
  for (const row of rows) {
    console.log(`- ${row.key}=<redacted>`);
  }

  if (dryRun) {
    console.log("Dry run only, no changes applied.");
    return;
  }

  await upsertSecrets(baseUrl!, serviceRoleKey!, rows);
  await verifySecrets(
    baseUrl!,
    serviceRoleKey!,
    rows.map((row) => row.key),
  );

  console.log("Internal secrets bootstrap applied and verified.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
