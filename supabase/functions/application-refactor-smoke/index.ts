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

async function runQueryConsistencyTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("APPLICATION");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Application Smoke NPO", npoName: "Application Smoke NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Application Smoke Volunteer" });
  const secondVolunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Application Smoke Volunteer 2" });
  let seededIds: string[] = [];

  try {
    const { data: insertedRows, error: insertError } = await admin
      .from("applications")
      .insert([
        {
          npo_id: npo.id,
          volunteer_id: volunteer.id,
          message: `${localMarker} pending`,
          status: "PENDING",
        },
        {
          npo_id: npo.id,
          volunteer_id: secondVolunteer.id,
          message: `${localMarker} approved`,
          status: "APPROVED",
          reviewed_at: new Date().toISOString(),
        },
      ])
      .select("id");
    if (insertError) throw insertError;
    seededIds = (insertedRows || []).map((row) => row.id);

    const { data: npoRows, error: npoError } = await admin
      .from("applications")
      .select("id,npo_id,volunteer_id,message,status,created_at,reviewed_at,volunteer:volunteer_id(full_name,avatar_url,user_skills(skill)),npo:npo_id(npo_name,full_name,avatar_url)")
      .eq("npo_id", npo.id)
      .order("created_at", { ascending: false });
    if (npoError) throw npoError;
    assert((npoRows || []).length === 2, "NPO applications query should return both seeded rows");

    const { data: volunteerRows, error: volunteerError } = await admin
      .from("applications")
      .select("id,npo_id,volunteer_id,message,status,created_at,reviewed_at,volunteer:volunteer_id(full_name,avatar_url),npo:npo_id(npo_name,full_name,avatar_url)")
      .eq("volunteer_id", volunteer.id)
      .order("created_at", { ascending: false });
    if (volunteerError) throw volunteerError;
    assert((volunteerRows || []).length === 1, "Volunteer applications query should stay scoped to the volunteer");
    assert(volunteerRows?.[0]?.npo_id === npo.id, "Volunteer application should preserve canonical npo_id");
    assert(volunteerRows?.[0]?.status === "PENDING", "Volunteer application should preserve canonical status");

    const hasApplied = (volunteerRows || []).some((row) => ["PENDING", "APPROVED"].includes(row.status));
    assert(hasApplied, "hasAppliedToNPO should remain derivable from canonical volunteer applications");

    return [
      "PASS NPO and volunteer application queries remain scoped and hydrated",
      "PASS hasAppliedToNPO stays derivable from canonical volunteer application rows",
    ];
  } finally {
    if (seededIds.length > 0) {
      await admin.from("applications").delete().in("id", seededIds);
    }
    await deleteProfile(admin, secondVolunteer.id);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStateTransitionsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("APPLICATIONSTATE");
  const npo = await createProfile(admin, { role: "NPO", fullName: "Application State NPO", npoName: "Application State NPO" });
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Application State Volunteer" });
  let applicationId = "";

  try {
    const { data: inserted, error: insertError } = await admin
      .from("applications")
      .insert({
        npo_id: npo.id,
        volunteer_id: volunteer.id,
        message: `${localMarker} pending`,
        status: "PENDING",
      })
      .select("id,status,reviewed_at")
      .single();
    if (insertError) throw insertError;
    applicationId = inserted.id;
    assert(inserted.status === "PENDING", "New application should start as PENDING");

    const reviewedAt = new Date().toISOString();
    const { error: approveError } = await admin
      .from("applications")
      .update({ status: "APPROVED", reviewed_at: reviewedAt })
      .eq("id", applicationId);
    if (approveError) throw approveError;

    const { data: approvedRow, error: approvedFetchError } = await admin
      .from("applications")
      .select("id,status,reviewed_at")
      .eq("id", applicationId)
      .single();
    if (approvedFetchError) throw approvedFetchError;
    assert(approvedRow.status === "APPROVED", "Approved application should remain visible via canonical query");
    assert(!!approvedRow.reviewed_at, "Approved application should preserve reviewed_at");
    assert(
      new Date(approvedRow.reviewed_at).getTime() >= new Date(reviewedAt).getTime() - 1000,
      "Approved application should preserve a coherent reviewed_at"
    );

    const rejectedAt = new Date(Date.now() + 1000).toISOString();
    const { error: rejectError } = await admin
      .from("applications")
      .update({ status: "REJECTED", reviewed_at: rejectedAt })
      .eq("id", applicationId);
    if (rejectError) throw rejectError;

    const { data: rejectedRow, error: rejectedFetchError } = await admin
      .from("applications")
      .select("id,status,reviewed_at")
      .eq("id", applicationId)
      .single();
    if (rejectedFetchError) throw rejectedFetchError;
    assert(rejectedRow.status === "REJECTED", "Rejected application should remain visible via canonical query");
    assert(!!rejectedRow.reviewed_at, "Rejected application should refresh reviewed_at");
    assert(
      new Date(rejectedRow.reviewed_at).getTime() >= new Date(rejectedAt).getTime() - 1000,
      "Rejected application should refresh reviewed_at coherently"
    );

    return [
      "PASS application approve/reject transitions stay visible through canonical queries",
      "PASS reviewed_at remains aligned with application state transitions",
    ];
  } finally {
    if (applicationId) {
      await admin.from("applications").delete().eq("id", applicationId);
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
