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

function mapDbActivity(dbActivity: any) {
  return {
    id: dbActivity.id,
    npoId: dbActivity.npo_id,
    npoName:
      dbActivity.profiles?.npo_name ||
      dbActivity.profiles?.full_name ||
      dbActivity.npo_name ||
      dbActivity.full_name ||
      "NPO Sconosciuta",
    title: dbActivity.title,
    description: dbActivity.description,
    dateTime: dbActivity.date_start,
    endDateTime: dbActivity.date_end,
    slots: dbActivity.slots_total,
    status: dbActivity.status,
    category: dbActivity.category,
    isUrgent: dbActivity.is_urgent || false,
    skills: (dbActivity.activity_skills || []).map((row: any) => row.skill),
    iscritti: (dbActivity.activity_participants || [])
      .filter((row: any) => ["REGISTERED", "APPROVED", "PENDING"].includes(row.status))
      .map((row: any) => row.user_id),
    location: {
      address: dbActivity.location_address || "",
      coords: {
        lat: dbActivity.location_lat || 0,
        lng: dbActivity.location_lng || 0,
      },
    },
  };
}

async function fetchActivityRow(admin: ReturnType<typeof createClient>, activityId: string) {
  const { data, error } = await admin
    .from("activities")
    .select(`
      *,
      profiles:npo_id (npo_name, full_name, public_email, email, is_verified),
      activity_skills (skill),
      activity_participants (user_id, status)
    `)
    .eq("id", activityId)
    .single();

  if (error) throw error;
  return data;
}

async function runQueryConsistencyTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("ACTIVITY");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Activity Smoke Volunteer" });
  const volunteerRejected = await createProfile(admin, { role: "VOLUNTEER", fullName: "Activity Smoke Rejected" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Activity Smoke NPO", npoName: "Activity Smoke NPO" });
  let activityId = "";

  try {
    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const { data: activityRow, error: activityError } = await admin
      .from("activities")
      .insert({
        npo_id: npo.id,
        title: `${localMarker} title`,
        description: `${localMarker} description`,
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        location_address: `${localMarker} address`,
        location_lat: 45.4642,
        location_lng: 9.19,
        slots_total: 6,
        category: "Ambiente",
        status: "APERTA",
        is_urgent: true,
      })
      .select("id")
      .single();
    if (activityError) throw activityError;
    activityId = activityRow.id;

    const { error: skillsError } = await admin.from("activity_skills").insert([
      { activity_id: activityId, skill: "EMPATIA" },
      { activity_id: activityId, skill: "ORGANIZZAZIONE" },
    ]);
    if (skillsError) throw skillsError;

    const { error: participantsError } = await admin.from("activity_participants").insert([
      { activity_id: activityId, user_id: volunteer.id, status: "APPROVED" },
      { activity_id: activityId, user_id: npo.id, status: "REJECTED" },
      { activity_id: activityId, user_id: volunteerRejected.id, status: "REJECTED" },
    ]);
    if (participantsError) throw participantsError;

    const { error: reviewError } = await admin.from("reviews").insert({
      activity_id: activityId,
      npo_id: npo.id,
      volunteer_id: volunteer.id,
      stars: 5,
      comment: `${localMarker} review`,
      feelings: ["GRATITUDINE"],
    });
    if (reviewError) throw reviewError;

    const { error: volunteerReviewError } = await admin.from("volunteer_reviews").insert({
      activity_id: activityId,
      npo_id: npo.id,
      volunteer_id: volunteer.id,
      is_present: true,
      stars: 4,
      comment: `${localMarker} volunteer review`,
    });
    if (volunteerReviewError) throw volunteerReviewError;

    const { error: applicationError } = await admin.from("applications").insert({
      npo_id: npo.id,
      volunteer_id: volunteer.id,
      status: "PENDING",
      message: `${localMarker} application`,
      created_at: new Date().toISOString(),
    });
    if (applicationError) throw applicationError;

    const detailRow = await fetchActivityRow(admin, activityId);
    const detail = mapDbActivity(detailRow);

    const { data: listRows, error: listError } = await admin
      .from("activities")
      .select(`
        *,
        profiles:npo_id (npo_name, full_name, public_email, email, is_verified),
        activity_skills (skill),
        activity_participants (user_id, status)
      `)
      .eq("id", activityId);
    if (listError) throw listError;
    assert((listRows || []).length === 1, "Expected seeded activity in list query");
    const listActivity = mapDbActivity(listRows?.[0]);

    assert(listActivity.title === detail.title, "List/detail title must stay aligned");
    assert(listActivity.status === detail.status, "List/detail status must stay aligned");
    assert(listActivity.skills.length === 2, "Skills should be hydrated consistently");
    assert(
      listActivity.iscritti.length === 1 && listActivity.iscritti[0] === volunteer.id,
      "Participant filtering must exclude rejected participants from canonical iscritti"
    );
    assert(
      detail.iscritti.length === 1 && detail.iscritti[0] === volunteer.id,
      "Detail participant filtering must match list filtering"
    );

    const { data: reviewsRows, error: reviewsFetchError } = await admin
      .from("reviews")
      .select("*")
      .eq("activity_id", activityId);
    if (reviewsFetchError) throw reviewsFetchError;
    assert((reviewsRows || []).length === 1, "Review query must return seeded activity review");

    const { data: volunteerReviewRows, error: volunteerReviewsFetchError } = await admin
      .from("volunteer_reviews")
      .select("*")
      .eq("activity_id", activityId)
      .eq("volunteer_id", volunteer.id);
    if (volunteerReviewsFetchError) throw volunteerReviewsFetchError;
    assert((volunteerReviewRows || []).length === 1, "Volunteer reviews query must return seeded review");

    const { data: applicationRows, error: applicationsFetchError } = await admin
      .from("applications")
      .select("*")
      .eq("npo_id", npo.id)
      .eq("volunteer_id", volunteer.id);
    if (applicationsFetchError) throw applicationsFetchError;
    assert((applicationRows || []).length === 1, "Applications query must return seeded application");

    return [
      "PASS activities list/detail stay aligned for canonical fields",
      "PASS canonical participant filtering excludes rejected rows",
      "PASS reviews, volunteer reviews, and applications remain queryable for activity flows",
    ];
  } finally {
    if (activityId) {
      await admin.from("volunteer_reviews").delete().eq("activity_id", activityId);
      await admin.from("reviews").delete().eq("activity_id", activityId);
      await admin.from("activity_participants").delete().eq("activity_id", activityId);
      await admin.from("activity_skills").delete().eq("activity_id", activityId);
      await admin.from("activities").delete().eq("id", activityId);
    }
    await admin.from("applications").delete().eq("npo_id", npo.id).eq("volunteer_id", volunteer.id);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, volunteerRejected.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStateTransitionsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("ACTIVITYSTATE");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Activity State NPO", npoName: "Activity State NPO" });
  let activityId = "";

  try {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data: activityRow, error: createError } = await admin
      .from("activities")
      .insert({
        npo_id: npo.id,
        title: `${localMarker} title`,
        description: `${localMarker} description`,
        date_start: start.toISOString(),
        date_end: end.toISOString(),
        slots_total: 4,
        status: "APERTA",
      })
      .select("id")
      .single();
    if (createError) throw createError;
    activityId = activityRow.id;

    const openRow = await fetchActivityRow(admin, activityId);
    assert(openRow.status === "APERTA", "Seeded activity should start as APERTA");

    const { error: updateError } = await admin
      .from("activities")
      .update({
        title: `${localMarker} updated`,
        status: "IN_CORSO",
      })
      .eq("id", activityId);
    if (updateError) throw updateError;

    const updatedRow = await fetchActivityRow(admin, activityId);
    const updated = mapDbActivity(updatedRow);
    assert(updated.title === `${localMarker} updated`, "Updated detail should expose the latest title");
    assert(updated.status === "IN_CORSO", "Updated detail should expose the latest status");

    const { error: cancelError } = await admin
      .from("activities")
      .update({ status: "CANCELLATA" })
      .eq("id", activityId);
    if (cancelError) throw cancelError;

    const cancelledRow = await fetchActivityRow(admin, activityId);
    assert(cancelledRow.status === "CANCELLATA", "Soft-delete path must leave the activity readable as CANCELLATA");

    return [
      "PASS activity updates remain visible through the canonical detail query",
      "PASS activity soft-delete keeps the row readable as CANCELLATA",
    ];
  } finally {
    if (activityId) {
      await admin.from("activities").delete().eq("id", activityId);
    }
    await deleteProfile(admin, npo.id);
  }
}

Deno.serve(async (req) => {
  try {
    const mode = ((await req.json().catch(() => ({})))?.mode || "full") as Mode;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const runOne = async (target: Exclude<Mode, "full">) => {
      switch (target) {
        case "query_consistency":
          return runQueryConsistencyTest(admin);
        case "state_transitions":
          return runStateTransitionsTest(admin);
        default:
          throw new Error(`Unsupported activity smoke mode: ${String(target)}`);
      }
    };

    const results =
      mode === "full"
        ? {
            query_consistency: await runOne("query_consistency"),
            state_transitions: await runOne("state_transitions"),
          }
        : { [mode]: await runOne(mode) };

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("[activity-refactor-smoke] Error", error);
    const formattedError =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: typeof error === "string" ? error : JSON.stringify(error) };
    return new Response(JSON.stringify({ success: false, error: formattedError }, null, 2), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
