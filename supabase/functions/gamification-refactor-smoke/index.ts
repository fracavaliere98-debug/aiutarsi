import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Role = "VOLUNTEER" | "NPO";
type Mode = "state_consistency" | "share_invalidation" | "full";

const jsonHeaders = { "Content-Type": "application/json" };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function marker(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createProfile(
  admin: ReturnType<typeof createClient>,
  params: { role: Role; fullName: string; npoName?: string; profileCompleted?: boolean; password?: string }
) {
  const email = `${crypto.randomUUID()}@example.com`;
  const password = params.password || "TempPass123";
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      role: params.role,
      npo_name: params.npoName || null,
    },
  });
  if (authError) throw authError;
  assert(authUser.user, "Missing auth user");

  const { error } = await admin.from("profiles").upsert({
    id: authUser.user.id,
    email,
    full_name: params.fullName,
    role: params.role,
    npo_name: params.npoName || null,
    profile_completed: params.profileCompleted ?? true,
    email_confirmed: true,
    verification_status: params.role === "NPO" ? "verified" : "none",
    expo_push_token: null,
  });
  if (error) throw error;

  return { id: authUser.user.id, email, password };
}

async function deleteProfile(admin: ReturnType<typeof createClient>, id?: string) {
  if (!id) return;
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

async function createActivity(
  admin: ReturnType<typeof createClient>,
  npoId: string,
  params: { title: string; category: string }
) {
  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const { data, error } = await admin
    .from("activities")
    .insert({
      npo_id: npoId,
      title: params.title,
      description: `${params.title} description`,
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      location_address: `${params.title} address`,
      location_lat: 45.4642,
      location_lng: 9.19,
      slots_total: 8,
      category: params.category,
      status: "APERTA",
      is_urgent: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function cleanupActivity(admin: ReturnType<typeof createClient>, activityId?: string) {
  if (!activityId) return;
  await admin.from("activity_participants").delete().eq("activity_id", activityId);
  await admin.from("activity_skills").delete().eq("activity_id", activityId);
  await admin.from("activities").delete().eq("id", activityId);
}

async function fetchGamificationState(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("gamification_state")
    .select("user_id, xp, level, badges, shared_activity_ids, total_hours, completed_activities_count")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchProfileSnapshot(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("impact_points, badges")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function createAuthenticatedClient(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string
) {
  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function runStateConsistencyTest(admin: ReturnType<typeof createClient>) {
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Gamification Smoke Volunteer" });

  try {
    const state = await fetchGamificationState(admin, volunteer.id);
    const profile = await fetchProfileSnapshot(admin, volunteer.id);

    assert(typeof state.xp === "number", "Canonical gamification_state should expose numeric XP");
    assert(typeof state.level === "number", "Canonical gamification_state should expose numeric level");
    assert(Array.isArray(state.badges), "Canonical gamification_state should expose badges");
    assert(profile.impact_points === state.xp, "Profile impact_points snapshot should stay synced from canonical XP");
    assert(JSON.stringify(profile.badges || []) === JSON.stringify(state.badges || []), "Profile badges snapshot should stay synced from canonical badges");

    return [
      "PASS volunteer profile XP and badges can be read from canonical gamification_state",
      "PASS profile-side impact_points and badges remain synced snapshots of the canonical state",
    ];
  } finally {
    await deleteProfile(admin, volunteer.id);
  }
}

async function runShareInvalidationTest(admin: ReturnType<typeof createClient>, supabaseUrl: string, anonKey: string) {
  const localMarker = marker("GAMIFY");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Gamification Share Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Gamification Share NPO", npoName: "Gamification Share NPO" });
  let activityId = "";

  try {
    activityId = await createActivity(admin, npo.id, { title: `${localMarker} activity`, category: "Ambiente" });
    const beforeState = await fetchGamificationState(admin, volunteer.id);
    const client = await createAuthenticatedClient(supabaseUrl, anonKey, volunteer.email, volunteer.password);

    const firstShare = await client.rpc("record_activity_share", { p_activity_id: activityId });
    if (firstShare.error) throw firstShare.error;

    const afterFirst = await fetchGamificationState(admin, volunteer.id);
    const afterFirstProfile = await fetchProfileSnapshot(admin, volunteer.id);
    assert(
      (afterFirst.shared_activity_ids || []).some((id: string) => String(id) === activityId),
      "Shared activity should be tracked in canonical state"
    );
    assert((afterFirst.xp ?? 0) === (beforeState.xp ?? 0) + 10, "First activity share should award canonical XP");
    assert(afterFirstProfile.impact_points === afterFirst.xp, "Profile impact_points snapshot should sync after share");

    const secondShare = await client.rpc("record_activity_share", { p_activity_id: activityId });
    if (secondShare.error) throw secondShare.error;

    const afterSecond = await fetchGamificationState(admin, volunteer.id);
    assert(afterSecond.xp === afterFirst.xp, "Repeated share of the same activity should be idempotent");
    assert(
      (afterSecond.shared_activity_ids || []).filter((id: string) => String(id) === activityId).length === 1,
      "Shared activity id should not duplicate"
    );

    await client.auth.signOut();

    return [
      "PASS activity share updates canonical gamification_state and synced profile snapshot",
      "PASS record_activity_share remains idempotent for repeated shares of the same activity",
    ];
  } finally {
    await cleanupActivity(admin, activityId);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders });
  }

  try {
    const mode = ((await req.json().catch(() => ({}))) as { mode?: Mode }).mode || "full";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    assert(supabaseUrl, "Missing SUPABASE_URL");
    assert(serviceRoleKey, "Missing SUPABASE_SERVICE_ROLE_KEY");
    assert(anonKey, "Missing SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, string[]> = {};

    if (mode === "state_consistency" || mode === "full") {
      results.state_consistency = await runStateConsistencyTest(admin);
    }
    if (mode === "share_invalidation" || mode === "full") {
      results.share_invalidation = await runShareInvalidationTest(admin, supabaseUrl, anonKey);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (error) {
    const errorPayload = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error), raw: JSON.stringify(error, null, 2) };
    return new Response(JSON.stringify({
      success: false,
      error: errorPayload,
    }), {
      headers: jsonHeaders,
      status: 500,
    });
  }
});
