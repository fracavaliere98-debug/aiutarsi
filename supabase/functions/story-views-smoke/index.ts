import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Role = "VOLUNTEER" | "NPO";
type Mode = "idempotence" | "cross_device" | "viewer_scope" | "full";

const jsonHeaders = { "Content-Type": "application/json" };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createProfile(
  admin: ReturnType<typeof createClient>,
  params: { role: Role; fullName: string; npoName?: string; password?: string }
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
    profile_completed: true,
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

async function createStory(admin: ReturnType<typeof createClient>, authorId: string, label: string) {
  const { data, error } = await admin
    .from("stories")
    .insert({
      author_id: authorId,
      image_url: `https://example.com/${label}.jpg`,
      caption: label,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function deleteStory(admin: ReturnType<typeof createClient>, storyId?: string) {
  if (!storyId) return;
  await admin.from("story_views").delete().eq("story_id", storyId);
  await admin.from("stories").delete().eq("id", storyId);
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

async function countStoryViews(admin: ReturnType<typeof createClient>, storyId: string, viewerUserId: string) {
  const { count, error } = await admin
    .from("story_views")
    .select("*", { count: "exact", head: true })
    .eq("story_id", storyId)
    .eq("viewer_user_id", viewerUserId);

  if (error) throw error;
  return count || 0;
}

async function fetchViewedStoryIds(client: ReturnType<typeof createClient>) {
  const { data, error } = await client.from("story_views").select("story_id");
  if (error) throw error;
  return Array.from(new Set((data || []).map((row: any) => row.story_id).filter(Boolean)));
}

async function runIdempotenceTest(admin: ReturnType<typeof createClient>, supabaseUrl: string, anonKey: string) {
  const viewer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Story View Viewer" });
  const author = await createProfile(admin, { role: "NPO", fullName: "Story View Author", npoName: "Story View Author" });
  let storyId = "";

  try {
    storyId = await createStory(admin, author.id, "story-view-idempotence");
    const client = await createAuthenticatedClient(supabaseUrl, anonKey, viewer.email, viewer.password);

    const first = await client.from("story_views").upsert({
      story_id: storyId,
      viewer_user_id: viewer.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: "story_id,viewer_user_id",
      ignoreDuplicates: false,
    });
    if (first.error) throw first.error;

    const second = await client.from("story_views").upsert({
      story_id: storyId,
      viewer_user_id: viewer.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: "story_id,viewer_user_id",
      ignoreDuplicates: false,
    });
    if (second.error) throw second.error;

    assert(
      (await countStoryViews(admin, storyId, viewer.id)) === 1,
      "Repeated views of the same story should remain idempotent server-side"
    );

    await client.auth.signOut();

    return [
      "PASS story view writes stay idempotent via story_id + viewer_user_id uniqueness",
    ];
  } finally {
    await deleteStory(admin, storyId);
    await deleteProfile(admin, viewer.id);
    await deleteProfile(admin, author.id);
  }
}

async function runCrossDeviceTest(admin: ReturnType<typeof createClient>, supabaseUrl: string, anonKey: string) {
  const viewer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Story Cross Device Viewer" });
  const author = await createProfile(admin, { role: "NPO", fullName: "Story Cross Device Author", npoName: "Story Cross Device Author" });
  let storyId = "";

  try {
    storyId = await createStory(admin, author.id, "story-view-cross-device");
    const deviceA = await createAuthenticatedClient(supabaseUrl, anonKey, viewer.email, viewer.password);
    const deviceB = await createAuthenticatedClient(supabaseUrl, anonKey, viewer.email, viewer.password);

    const write = await deviceA.from("story_views").upsert({
      story_id: storyId,
      viewer_user_id: viewer.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: "story_id,viewer_user_id",
      ignoreDuplicates: false,
    });
    if (write.error) throw write.error;

    const viewedOnDeviceB = await fetchViewedStoryIds(deviceB);
    assert(
      viewedOnDeviceB.includes(storyId),
      "A story viewed on device A should be visible as viewed on device B after refetch"
    );

    await deviceA.auth.signOut();
    await deviceB.auth.signOut();

    return [
      "PASS story views are readable cross-device from the canonical server dataset",
    ];
  } finally {
    await deleteStory(admin, storyId);
    await deleteProfile(admin, viewer.id);
    await deleteProfile(admin, author.id);
  }
}

async function runViewerScopeTest(admin: ReturnType<typeof createClient>, supabaseUrl: string, anonKey: string) {
  const viewerA = await createProfile(admin, { role: "VOLUNTEER", fullName: "Story Scope Viewer A" });
  const viewerB = await createProfile(admin, { role: "VOLUNTEER", fullName: "Story Scope Viewer B" });
  const author = await createProfile(admin, { role: "NPO", fullName: "Story Scope Author", npoName: "Story Scope Author" });
  let storyId = "";

  try {
    storyId = await createStory(admin, author.id, "story-view-scope");
    const deviceA = await createAuthenticatedClient(supabaseUrl, anonKey, viewerA.email, viewerA.password);
    const deviceB = await createAuthenticatedClient(supabaseUrl, anonKey, viewerB.email, viewerB.password);

    const write = await deviceA.from("story_views").upsert({
      story_id: storyId,
      viewer_user_id: viewerA.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: "story_id,viewer_user_id",
      ignoreDuplicates: false,
    });
    if (write.error) throw write.error;

    const viewedOnDeviceB = await fetchViewedStoryIds(deviceB);
    assert(
      !viewedOnDeviceB.includes(storyId),
      "Story views must stay scoped to the authenticated viewer"
    );

    await deviceA.auth.signOut();
    await deviceB.auth.signOut();

    return [
      "PASS story views remain scoped to the current viewer and do not leak across users",
    ];
  } finally {
    await deleteStory(admin, storyId);
    await deleteProfile(admin, viewerA.id);
    await deleteProfile(admin, viewerB.id);
    await deleteProfile(admin, author.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders });
  }

  try {
    const mode = ((await req.json().catch(() => ({}))) as { mode?: Mode }).mode || "full";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = (Deno.env.get("LEGACY_SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    assert(supabaseUrl, "Missing SUPABASE_URL");
    assert(serviceRoleKey, "Missing SUPABASE_SERVICE_ROLE_KEY");
    assert(anonKey, "Missing SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const results: Record<string, string[]> = {};

    if (mode === "idempotence" || mode === "full") {
      results.idempotence = await runIdempotenceTest(admin, supabaseUrl, anonKey);
    }
    if (mode === "cross_device" || mode === "full") {
      results.cross_device = await runCrossDeviceTest(admin, supabaseUrl, anonKey);
    }
    if (mode === "viewer_scope" || mode === "full") {
      results.viewer_scope = await runViewerScopeTest(admin, supabaseUrl, anonKey);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
