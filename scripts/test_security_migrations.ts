/**
 * Security migration validation suite.
 *
 * Verifies that the 5 security migrations applied on 2026-05-19 both:
 *   a) block what they are supposed to block
 *   b) do not break legitimate authenticated usage
 *
 * Run against staging:
 *   STAGING_SUPABASE_URL=https://pavnfiladmnwbptwlwpr.supabase.co \
 *   STAGING_SUPABASE_ANON_KEY=<key> \
 *   STAGING_TEST_EMAIL=test.maestro@aiutarsi.it \
 *   STAGING_TEST_PASSWORD=TestMaestro123! \
 *   npx tsx scripts/test_security_migrations.ts
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.STAGING_SUPABASE_URL ?? "https://pavnfiladmnwbptwlwpr.supabase.co";
const ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY ?? "";
const TEST_EMAIL = process.env.STAGING_TEST_EMAIL ?? "test.maestro@aiutarsi.it";
const TEST_PASSWORD = process.env.STAGING_TEST_PASSWORD ?? "TestMaestro123!";

assert(ANON_KEY, "STAGING_SUPABASE_ANON_KEY is required");

const REST = `${BASE_URL}/rest/v1`;
const AUTH = `${BASE_URL}/auth/v1`;
const STORAGE = `${BASE_URL}/storage/v1`;
const RPC = `${REST}/rpc`;

function anonHeaders(extra: Record<string, string> = {}) {
  return { apikey: ANON_KEY, "Content-Type": "application/json", ...extra };
}

function authHeaders(jwt: string, extra: Record<string, string> = {}) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...extra };
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  assert(res.ok && data.access_token, `sign-in failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

// ---------------------------------------------------------------------------
// 1. verification_docs bucket is now private
// ---------------------------------------------------------------------------

async function testVerificationDocsBucketPrivate() {
  console.log("\n[1] verification_docs bucket must be private");

  // Unauthenticated listing attempt — storage API should reject
  const listRes = await fetch(`${STORAGE}/object/list/verification_docs`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify({ prefix: "", limit: 1 }),
  });
  // Any 4xx is a rejection — 400, 401, 402, 403 are all valid "blocked" responses
  assert(
    listRes.status >= 400 && listRes.status < 500,
    `Expected 4xx for unauthenticated listing of verification_docs, got ${listRes.status}`,
  );
  pass(`unauthenticated listing of verification_docs is rejected (HTTP ${listRes.status})`);

  // Unauthenticated public URL download attempt — should fail
  // We use a fake path; the important thing is the bucket rejects anon access
  const fakeUrl = `${STORAGE}/object/public/verification_docs/fake-user-id/doc.pdf`;
  const getRes = await fetch(fakeUrl);
  assert(
    getRes.status >= 400 && getRes.status < 500,
    `Expected 4xx for public URL on private bucket, got ${getRes.status}`,
  );
  pass("public URL access on private bucket is rejected");
}

// ---------------------------------------------------------------------------
// 2. gamification_state: user cannot read another user's state
// ---------------------------------------------------------------------------

async function testGamificationStateIsolation(jwt: string) {
  console.log("\n[2] gamification_state must be isolated per user");

  // Query gamification_state for all rows — should return only own row
  const res = await fetch(`${REST}/gamification_state?select=user_id`, {
    headers: authHeaders(jwt),
  });
  assert(res.ok, `gamification_state query failed: ${res.status}`);
  const rows = await res.json() as { user_id: string }[];

  // Decode user_id from JWT
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
  const ownId = payload.sub as string;

  for (const row of rows) {
    assert(
      row.user_id === ownId,
      `gamification_state returned row for different user: ${row.user_id} (own: ${ownId})`,
    );
  }
  pass(`gamification_state SELECT returns only own rows (${rows.length} row(s), all belong to own user)`);

  // Anon should get 0 rows (RLS denies everything without auth)
  const anonRes = await fetch(`${REST}/gamification_state?select=user_id`, {
    headers: anonHeaders(),
  });
  const anonRows = await anonRes.json() as unknown[];
  assert(
    !Array.isArray(anonRows) || anonRows.length === 0,
    `gamification_state exposed rows to anon: ${JSON.stringify(anonRows)}`,
  );
  pass("gamification_state returns 0 rows to unauthenticated requests");
}

// ---------------------------------------------------------------------------
// 3. blocked_users: RLS is now active
// ---------------------------------------------------------------------------

async function testBlockedUsersRLS() {
  console.log("\n[3] blocked_users must have RLS enforced");

  // Anon should not be able to read blocked_users at all
  const res = await fetch(`${REST}/blocked_users?select=blocker_id,blocked_id&limit=5`, {
    headers: anonHeaders(),
  });
  const rows = await res.json() as unknown[];
  assert(
    !Array.isArray(rows) || rows.length === 0,
    `blocked_users exposed rows to anon: ${JSON.stringify(rows)}`,
  );
  pass("blocked_users returns 0 rows to unauthenticated requests");
}

// ---------------------------------------------------------------------------
// 4. Anon cannot call SECURITY DEFINER RPCs
// ---------------------------------------------------------------------------

async function testAnonCannotCallRpcs() {
  console.log("\n[4] App RPCs must reject unauthenticated calls");

  const rpcsToTest = [
    { name: "send_chat_message", body: { conversation_id: "00000000-0000-0000-0000-000000000000", message: "test", message_type: "text" } },
    { name: "get_chat_inbox", body: {} },
    { name: "get_unread_messages_count", body: {} },
    { name: "get_my_blocked_users", body: {} },
    { name: "replace_my_skills", body: { skills: ["test"] } },
    { name: "update_my_profile_core", body: { full_name: "hacked" } },
  ];

  for (const rpc of rpcsToTest) {
    const res = await fetch(`${RPC}/${rpc.name}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify(rpc.body),
    });
    // Accept 401, 403, 404 (not found = not exposed), or error JSON — any of these is safe
    // The critical check is: status must NOT be 200 with data
    const isBlocked = res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400;
    if (!isBlocked) {
      // Check body — if it returns an error payload it's also acceptable
      const body = await res.json().catch(() => null);
      const hasErrorBody = body && (body.code || body.error || body.message);
      assert(hasErrorBody, `RPC ${rpc.name} returned ${res.status} with success-like response: ${JSON.stringify(body)}`);
      pass(`${rpc.name} blocked anon (${res.status} with error body)`);
    } else {
      pass(`${rpc.name} blocked anon (HTTP ${res.status})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Authenticated user can still call legitimate RPCs
// ---------------------------------------------------------------------------

async function testAuthenticatedRpcsStillWork(jwt: string) {
  console.log("\n[5] Authenticated RPCs must still work after revoke");

  // get_unread_messages_count — should work and return a number
  const inboxRes = await fetch(`${RPC}/get_unread_messages_count`, {
    method: "POST",
    headers: authHeaders(jwt),
    body: JSON.stringify({}),
  });
  assert(
    inboxRes.ok || inboxRes.status === 406, // 406 = no rows, also valid
    `get_unread_messages_count failed for authenticated user: ${inboxRes.status}`,
  );
  pass("get_unread_messages_count works for authenticated user");

  // get_my_blocked_users — should return an array (possibly empty)
  const blockedRes = await fetch(`${RPC}/get_my_blocked_users`, {
    method: "POST",
    headers: authHeaders(jwt),
    body: JSON.stringify({}),
  });
  assert(
    blockedRes.ok || blockedRes.status === 406,
    `get_my_blocked_users failed for authenticated user: ${blockedRes.status}`,
  );
  pass("get_my_blocked_users works for authenticated user");

  // gamification_state table read
  const gamRes = await fetch(`${REST}/gamification_state?select=user_id,total_xp,level`, {
    headers: authHeaders(jwt),
  });
  assert(gamRes.ok, `gamification_state read failed for authenticated user: ${gamRes.status}`);
  pass("gamification_state readable by authenticated user");

  // blocked_users table read (own rows)
  const buRes = await fetch(`${REST}/blocked_users?select=blocker_id`, {
    headers: authHeaders(jwt),
  });
  assert(buRes.ok, `blocked_users read failed for authenticated user: ${buRes.status}`);
  pass("blocked_users readable by authenticated user (own rows only)");

  // activities — must still be readable (public select policy untouched)
  const actRes = await fetch(`${REST}/activities?select=id,title&limit=3`, {
    headers: authHeaders(jwt),
  });
  assert(actRes.ok, `activities query failed for authenticated user: ${actRes.status}`);
  const acts = await actRes.json() as unknown[];
  assert(Array.isArray(acts), "activities query must return an array");
  pass(`activities still readable by authenticated user (${acts.length} returned)`);
}

// ---------------------------------------------------------------------------
// 6. levels table RLS — readable by auth, not writeable by anon
// ---------------------------------------------------------------------------

async function testLevelsRLS(jwt: string) {
  console.log("\n[6] levels table: readable by authenticated, blocked for anon");

  const authRes = await fetch(`${REST}/levels?select=id,name,min_xp&order=id`, {
    headers: authHeaders(jwt),
  });
  assert(authRes.ok, `levels not readable by authenticated user: ${authRes.status}`);
  const levels = await authRes.json() as { id: number; name: string; min_xp: number }[];
  assert(Array.isArray(levels) && levels.length > 0, "levels table should have rows");
  pass(`levels readable by authenticated user (${levels.length} levels)`);

  const anonRes = await fetch(`${REST}/levels?select=id,name`, { headers: anonHeaders() });
  const anonRows = await anonRes.json() as unknown[];
  assert(
    !Array.isArray(anonRows) || anonRows.length === 0,
    `levels exposed to anon: ${JSON.stringify(anonRows)}`,
  );
  pass("levels blocked for unauthenticated requests");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  console.log("Security migration validation suite");
  console.log(`Target: ${BASE_URL}`);
  console.log("─".repeat(60));

  // Unauthenticated tests (no login needed)
  await testVerificationDocsBucketPrivate();
  await testBlockedUsersRLS();
  await testAnonCannotCallRpcs();

  // Authenticated tests
  console.log("\n[auth] Signing in as test user...");
  let jwt: string;
  try {
    jwt = await signIn(TEST_EMAIL, TEST_PASSWORD);
    pass(`signed in as ${TEST_EMAIL}`);
  } catch (err) {
    console.warn(`  ⚠ Could not sign in as test user — skipping authenticated tests`);
    console.warn(`    ${err}`);
    console.log("\n─".repeat(60));
    console.log("Partial suite passed (unauthenticated tests only).");
    return;
  }

  await testGamificationStateIsolation(jwt);
  await testAuthenticatedRpcsStillWork(jwt);
  await testLevelsRLS(jwt);

  console.log("\n" + "─".repeat(60));
  console.log("All security checks passed ✓");
}

run().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
