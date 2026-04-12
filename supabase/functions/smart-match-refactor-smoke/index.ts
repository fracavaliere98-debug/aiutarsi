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

async function createActivity(
  admin: ReturnType<typeof createClient>,
  npoId: string,
  params: { title: string; category: string; isUrgent?: boolean; skill?: string }
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
      is_urgent: params.isUrgent ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (params.skill) {
    const { error: skillError } = await admin.from("activity_skills").insert({
      activity_id: data.id,
      skill: params.skill,
    });
    if (skillError) throw skillError;
  }

  return data.id as string;
}

async function cleanupActivity(admin: ReturnType<typeof createClient>, activityId?: string) {
  if (!activityId) return;
  await admin.from("activity_participants").delete().eq("activity_id", activityId);
  await admin.from("activity_skills").delete().eq("activity_id", activityId);
  await admin.from("activities").delete().eq("id", activityId);
}

async function seedVolunteerProfileSignals(
  admin: ReturnType<typeof createClient>,
  volunteerId: string,
  params: { interest: string; skill: string }
) {
  const { error: interestError } = await admin.from("user_interests").insert({
    user_id: volunteerId,
    interest: params.interest,
  });
  if (interestError) throw interestError;

  const { error: skillError } = await admin.from("user_skills").insert({
    user_id: volunteerId,
    skill: params.skill,
  });
  if (skillError) throw skillError;
}

async function cleanupVolunteerSignals(admin: ReturnType<typeof createClient>, volunteerId: string) {
  await admin.from("user_interests").delete().eq("user_id", volunteerId);
  await admin.from("user_skills").delete().eq("user_id", volunteerId);
}

async function fetchActivitiesWithMatch(
  admin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const { data, error } = await admin.rpc("get_activities_with_match", payload);
  if (error) throw error;
  return data || [];
}

function deriveConfidence(score: number) {
  if (score >= 80) return "top";
  if (score >= 65) return "good";
  return "explore";
}

function rerankPreview(
  matches: { id: string; score: number; isUrgent?: boolean; category?: string; npoId?: string; iscritti?: string[] }[],
  prefs: {
    hiddenActivityIds: string[];
    savedActivityIds: string[];
    seenActivityIds: string[];
    likedActivityIds: string[];
    likedCategories: string[];
    likedNpoIds: string[];
  },
  relations: { followedNpoIds: Set<string>; affiliatedNpoIds: Set<string> },
  options?: { ignoreHidden?: boolean; excludeEnrolledUserId?: string | null }
) {
  return matches
    .filter((match) => options?.ignoreHidden || !prefs.hiddenActivityIds.includes(match.id))
    .filter((match) => {
      const enrolledUserId = options?.excludeEnrolledUserId;
      if (!enrolledUserId) return true;
      return !(match.iscritti || []).includes(enrolledUserId);
    })
    .map((match) => {
      let adjustedScore = match.score || 0;
      if (prefs.savedActivityIds.includes(match.id)) adjustedScore += 8;
      if (prefs.likedActivityIds.includes(match.id)) adjustedScore += 10;
      if (match.category && prefs.likedCategories.includes(match.category)) adjustedScore += 7;
      if (match.npoId && prefs.likedNpoIds.includes(match.npoId)) adjustedScore += 6;
      if (prefs.seenActivityIds.includes(match.id)) adjustedScore -= 4;
      if (match.isUrgent) adjustedScore += 3;
      if (match.npoId && relations.affiliatedNpoIds.has(match.npoId)) adjustedScore += 10;
      else if (match.npoId && relations.followedNpoIds.has(match.npoId)) adjustedScore += 5;

      return {
        ...match,
        score: Math.max(0, Math.min(99, Math.round(adjustedScore))),
        confidence: deriveConfidence(adjustedScore),
      };
    })
    .sort((a, b) => b.score - a.score);
}

async function runQueryConsistencyTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("SMARTMATCH");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Smart Match Smoke NPO", npoName: "Smart Match Smoke NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Smart Match Smoke Volunteer" });
  let activityId = "";

  try {
    await seedVolunteerProfileSignals(admin, volunteer.id, { interest: "Ambiente", skill: "Logistica" });
    activityId = await createActivity(admin, npo.id, {
      title: `${localMarker} activity`,
      category: "Ambiente",
      isUrgent: true,
      skill: "Logistica",
    });

    const baseRows = await fetchActivitiesWithMatch(admin, {
      p_user_id: volunteer.id,
      p_limit: 20,
      p_offset: 0,
      p_statuses: ["APERTA"],
    });
    const baseRow = baseRows.find((row: any) => row.id === activityId);
    assert(baseRow, "Broad smart match query should include the seeded activity");
    assert(typeof baseRow.match_percentage === "number", "Canonical activity score should be numeric");

    const searchRows = await fetchActivitiesWithMatch(admin, {
      p_user_id: volunteer.id,
      p_search: localMarker,
      p_limit: 20,
      p_offset: 0,
      p_statuses: ["APERTA"],
    });
    const searchRow = searchRows.find((row: any) => row.id === activityId);
    assert(searchRow, "Search-scoped smart match query should include the seeded activity");
    assert(
      searchRow.match_percentage === baseRow.match_percentage,
      "Search-scoped lookup should preserve the canonical activity score"
    );

    const categoryRows = await fetchActivitiesWithMatch(admin, {
      p_user_id: volunteer.id,
      p_category: "Ambiente",
      p_limit: 20,
      p_offset: 0,
      p_statuses: ["APERTA"],
    });
    const categoryRow = categoryRows.find((row: any) => row.id === activityId);
    assert(categoryRow, "Category-scoped smart match query should include the seeded activity");
    assert(
      categoryRow.match_percentage === baseRow.match_percentage,
      "Category-scoped lookup should preserve the canonical activity score"
    );

    return [
      "PASS canonical activity score stays stable across broad, search, and category smart match queries",
      "PASS activity plus user score is derivable as a first-class smart match lookup",
    ];
  } finally {
    await cleanupActivity(admin, activityId);
    await cleanupVolunteerSignals(admin, volunteer.id);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStateTransitionsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("SMARTMATCHSTATE");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Smart Match State NPO", npoName: "Smart Match State NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Smart Match State Volunteer" });
  let firstActivityId = "";
  let secondActivityId = "";

  try {
    await seedVolunteerProfileSignals(admin, volunteer.id, { interest: "Ambiente", skill: "Logistica" });
    firstActivityId = await createActivity(admin, npo.id, {
      title: `${localMarker} first`,
      category: "Ambiente",
      isUrgent: false,
      skill: "Logistica",
    });
    secondActivityId = await createActivity(admin, npo.id, {
      title: `${localMarker} second`,
      category: "Ambiente",
      isUrgent: true,
      skill: "Logistica",
    });

    const rows = await fetchActivitiesWithMatch(admin, {
      p_user_id: volunteer.id,
      p_search: localMarker,
      p_limit: 20,
      p_offset: 0,
      p_statuses: ["APERTA"],
    });
    const baseMatches = rows.map((row: any) => ({
      id: row.id as string,
      score: row.match_percentage as number,
      isUrgent: row.is_urgent as boolean,
      category: row.category as string,
      npoId: row.npo_id as string,
      iscritti: [] as string[],
    }));
    assert(baseMatches.length >= 2, "State transition smoke should have at least two activities");

    const prefs = {
      hiddenActivityIds: [firstActivityId],
      savedActivityIds: [secondActivityId],
      seenActivityIds: [firstActivityId],
      likedActivityIds: [secondActivityId],
      likedCategories: ["Ambiente"],
      likedNpoIds: [npo.id],
    };
    const relations = {
      followedNpoIds: new Set<string>([npo.id]),
      affiliatedNpoIds: new Set<string>(),
    };

    const allMatches = rerankPreview(baseMatches, prefs, relations, { ignoreHidden: true });
    const visibleMatches = rerankPreview(baseMatches, prefs, relations, {
      excludeEnrolledUserId: volunteer.id,
    });

    const hiddenInAll = allMatches.find((match) => match.id === firstActivityId);
    const hiddenInVisible = visibleMatches.find((match) => match.id === firstActivityId);
    assert(hiddenInAll, "Canonical smart match lookup should still exist for hidden activities");
    assert(!hiddenInVisible, "Visible smart match ranking should exclude hidden activities");

    const promoted = allMatches.find((match) => match.id === secondActivityId);
    assert(promoted, "Saved and liked activity should remain queryable in canonical smart match results");
    assert(promoted.score >= (baseMatches.find((match) => match.id === secondActivityId)?.score || 0), "Preference-aware ranking should preserve or improve the promoted activity score");

    return [
      "PASS canonical activity lookup survives local preference filtering",
      "PASS visible ranking can change without losing a stable all-matches score lookup",
    ];
  } finally {
    await cleanupActivity(admin, secondActivityId);
    await cleanupActivity(admin, firstActivityId);
    await cleanupVolunteerSignals(admin, volunteer.id);
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
