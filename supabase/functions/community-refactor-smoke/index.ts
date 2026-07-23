import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Role = "VOLUNTEER" | "NPO";
type Mode = "query_consistency" | "state_transitions" | "full";

const jsonHeaders = { "Content-Type": "application/json" };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function marker(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createProfile(
  admin: ReturnType<typeof createClient>,
  params: { role: Role; fullName: string; npoName?: string; profileCompleted?: boolean }
) {
  const email = `${crypto.randomUUID()}@example.com`;
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: "TempPass123",
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

  return { id: authUser.user.id, email };
}

async function deleteProfile(admin: ReturnType<typeof createClient>, id?: string) {
  if (!id) return;
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
}

async function createActivity(admin: ReturnType<typeof createClient>, npoId: string, title: string) {
  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const { data, error } = await admin
    .from("activities")
    .insert({
      npo_id: npoId,
      title,
      description: `${title} description`,
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      location_address: `${title} address`,
      location_lat: 45.4642,
      location_lng: 9.19,
      slots_total: 8,
      category: "Ambiente",
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

const COMMUNITY_POST_SELECT = `
  id,
  caption,
  image_url,
  images_urls,
  author_id,
  linked_activity_id,
  created_at,
  status,
  author:profiles!author_id (
    id,
    full_name,
    npo_name,
    avatar_url,
    role
  ),
  linked_activity:activities!linked_activity_id (
    id,
    title,
    date_start,
    status
  ),
  reactions:post_reactions (
    id, post_id, user_id, reaction, created_at
  )
`;

async function fetchFeed(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("community_posts")
    .select(COMMUNITY_POST_SELECT)
    .not("status", "in", '("shadow_banned","removed")')
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

async function fetchActivityPosts(admin: ReturnType<typeof createClient>, activityId: string) {
  const { data, error } = await admin
    .from("community_posts")
    .select(COMMUNITY_POST_SELECT)
    .eq("linked_activity_id", activityId)
    .not("status", "in", '("shadow_banned","removed")')
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function fetchPost(admin: ReturnType<typeof createClient>, postId: string) {
  const { data, error } = await admin
    .from("community_posts")
    .select(COMMUNITY_POST_SELECT)
    .eq("id", postId)
    .single();
  if (error) throw error;
  return data;
}

async function runQueryConsistencyTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("COMMUNITY");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Community Smoke NPO", npoName: "Community Smoke NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Community Smoke Volunteer" });
  let activityId = "";
  let postId = "";

  try {
    activityId = await createActivity(admin, npo.id, `${localMarker} activity`);

    const { data: insertedPost, error: insertError } = await admin
      .from("community_posts")
      .insert({
        author_id: npo.id,
        caption: `${localMarker} caption`,
        image_url: "https://example.com/community-smoke.jpg",
        images_urls: ["https://example.com/community-smoke.jpg"],
        linked_activity_id: activityId,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    postId = insertedPost.id;

    const { error: reactionError } = await admin.from("post_reactions").insert({
      post_id: postId,
      user_id: volunteer.id,
      reaction: "heart",
    });
    if (reactionError) throw reactionError;

    const feedRows = await fetchFeed(admin);
    const feedPost = feedRows.find((row: any) => row.id === postId);
    assert(feedPost, "Feed query must include the seeded post");
    assert(feedPost.caption === `${localMarker} caption`, "Feed query must preserve canonical caption");

    const activityRows = await fetchActivityPosts(admin, activityId);
    assert(activityRows.length === 1, "Activity posts query should return the linked post");
    assert(activityRows[0].id === postId, "Activity posts query must preserve canonical post id");

    const detailPost = await fetchPost(admin, postId);
    assert(detailPost.id === postId, "Post detail query should resolve the seeded post");
    assert(detailPost.linked_activity_id === activityId, "Post detail query must preserve linked activity");
    assert((detailPost.reactions || []).length === 1, "Post detail query should hydrate reactions");

    return [
      "PASS feed, activityPosts, and post detail stay aligned on canonical post fields",
      "PASS post detail remains queryable without relying on feed fallback",
      "PASS linked activity and reactions stay hydrated across canonical community queries",
    ];
  } finally {
    if (postId) {
      await admin.from("community_reports").delete().eq("post_id", postId);
      await admin.from("post_reactions").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    await cleanupActivity(admin, activityId);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStateTransitionsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("COMMUNITYSTATE");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Community State NPO", npoName: "Community State NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Community State Volunteer" });
  let postId = "";

  try {
    const { data: insertedPost, error: insertError } = await admin
      .from("community_posts")
      .insert({
        author_id: npo.id,
        caption: `${localMarker} original`,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    postId = insertedPost.id;

    const { error: updateError } = await admin
      .from("community_posts")
      .update({ caption: `${localMarker} updated` })
      .eq("id", postId);
    if (updateError) throw updateError;

    const updatedPost = await fetchPost(admin, postId);
    assert(updatedPost.caption === `${localMarker} updated`, "Updated post must remain visible via canonical post query");

    const { error: reactionInsertError } = await admin.from("post_reactions").insert({
      post_id: postId,
      user_id: volunteer.id,
      reaction: "clap",
    });
    if (reactionInsertError) throw reactionInsertError;

    const withReaction = await fetchPost(admin, postId);
    assert((withReaction.reactions || []).length === 1, "Reaction insert must remain visible via canonical post query");

    const { error: reportError } = await admin.from("community_reports").insert({
      post_id: postId,
      reporter_id: volunteer.id,
      reason: `${localMarker} report`,
      status: "pending",
    });
    if (reportError) throw reportError;

    const { data: reportRows, error: reportFetchError } = await admin
      .from("community_reports")
      .select("id")
      .eq("post_id", postId)
      .eq("reporter_id", volunteer.id);
    if (reportFetchError) throw reportFetchError;
    assert((reportRows || []).length === 1, "Community reports should remain queryable after report mutation");

    const { error: deleteReactionError } = await admin
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", volunteer.id)
      .eq("reaction", "clap");
    if (deleteReactionError) throw deleteReactionError;

    const withoutReaction = await fetchPost(admin, postId);
    assert((withoutReaction.reactions || []).length === 0, "Reaction delete must remain visible via canonical post query");

    const { error: deletePostError } = await admin.from("community_posts").delete().eq("id", postId);
    if (deletePostError) throw deletePostError;
    postId = "";

    const { data: deletedRows, error: deletedFeedError } = await admin
      .from("community_posts")
      .select("id")
      .eq("id", insertedPost.id);
    if (deletedFeedError) throw deletedFeedError;
    assert((deletedRows || []).length === 0, "Deleted post must disappear from canonical community queries");

    return [
      "PASS create/edit/delete transitions stay visible through canonical community queries",
      "PASS report and reaction mutations remain observable without local optimistic state",
    ];
  } finally {
    if (postId) {
      await admin.from("community_reports").delete().eq("post_id", postId);
      await admin.from("post_reactions").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      (Deno.env.get("LEGACY_SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode || "full") as Mode;
    const results: Record<string, string[]> = {};

    if (mode === "query_consistency" || mode === "full") {
      results.query_consistency = await runQueryConsistencyTest(admin);
    }

    if (mode === "state_transitions" || mode === "full") {
      results.state_transitions = await runStateTransitionsTest(admin);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: jsonHeaders,
        status: 500,
      }
    );
  }
});
