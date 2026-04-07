import { createClient } from "@supabase/supabase-js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function createUserAndProfile(
  admin: ReturnType<typeof createClient>,
  params: { email: string; role: "VOLUNTEER" | "NPO"; fullName: string; npoName?: string }
) {
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: params.email,
    password: "TempPass123",
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      role: params.role,
      npo_name: params.npoName || null,
    },
  });
  if (authError) throw authError;
  assert(authUser.user, `Missing auth user for ${params.email}`);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authUser.user.id,
    email: params.email,
    full_name: params.fullName,
    role: params.role,
    npo_name: params.npoName || null,
    profile_completed: true,
    email_confirmed: true,
    verification_status: params.role === "NPO" ? "verified" : "none",
    expo_push_token: null,
  });
  if (profileError) throw profileError;

  return authUser.user.id;
}

async function countNotifications(admin: ReturnType<typeof createClient>, userId: string, marker: string) {
  const { count, error } = await admin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .ilike("title", `%${marker}%`);
  if (error) throw error;
  return count || 0;
}

async function main() {
  const supabaseUrl = process.env.STAGING_SUPABASE_URL || "";
  const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
  assert(supabaseUrl, "Missing STAGING_SUPABASE_URL");
  assert(serviceRoleKey, "Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const marker = `E2E_NOTIFY_${Date.now()}`;
  const volunteerEmail = uniqueEmail("notif.volunteer");
  const npoEmail = uniqueEmail("notif.npo");

  let volunteerId = "";
  let npoId = "";

  try {
    volunteerId = await createUserAndProfile(admin, {
      email: volunteerEmail,
      role: "VOLUNTEER",
      fullName: "Volunteer Notification Test",
    });
    npoId = await createUserAndProfile(admin, {
      email: npoEmail,
      role: "NPO",
      fullName: "NPO Notification Test",
      npoName: "NPO Notification Test",
    });

    const verificationTitle = `${marker} Verification approved`;
    const verificationMessage = "Test admin verification approval";
    const approvalTitle = `${marker} Application approved`;
    const approvalMessage = "Test volunteer application approved";

    const { error: insertDirectError } = await admin.from("notifications").insert([
      {
        user_id: npoId,
        type: "SUCCESS",
        title: verificationTitle,
        message: verificationMessage,
        read: false,
      },
      {
        user_id: volunteerId,
        type: "APPLICATION_APPROVED",
        title: approvalTitle,
        message: approvalMessage,
        read: false,
      },
    ]);
    if (insertDirectError) throw insertDirectError;

    assert(
      (await countNotifications(admin, npoId, marker)) === 1,
      "Expected exactly one direct notification for NPO"
    );
    assert(
      (await countNotifications(admin, volunteerId, marker)) === 1,
      "Expected exactly one direct notification for volunteer"
    );

    const npoJobKey = `${marker}:npo_weekly:${npoId}`;
    const volunteerJobKey = `${marker}:volunteer_weekly:${volunteerId}`;

    const { error: jobsError } = await admin.from("notification_jobs").insert([
      {
        user_id: npoId,
        type: "NPO_WEEKLY_RECAP",
        title: `${marker} NPO weekly recap`,
        message: "Test NPO weekly recap",
        payload: { source: "e2e", marker },
        dedupe_key: npoJobKey,
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        status: "pending",
      },
      {
        user_id: volunteerId,
        type: "VOLUNTEER_WEEKLY_RECAP",
        title: `${marker} Volunteer weekly recap`,
        message: "Test volunteer weekly recap",
        payload: { source: "e2e", marker },
        dedupe_key: volunteerJobKey,
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        status: "pending",
      },
    ]);
    if (jobsError) throw jobsError;

    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ limit: 10 }),
    });
    assert(processResponse.ok, `process-notification-jobs failed with ${processResponse.status}`);

    const { data: jobsAfterFirstRun, error: jobsAfterFirstRunError } = await admin
      .from("notification_jobs")
      .select("dedupe_key,status")
      .in("dedupe_key", [npoJobKey, volunteerJobKey]);
    if (jobsAfterFirstRunError) throw jobsAfterFirstRunError;

    assert(
      jobsAfterFirstRun?.every((job) => job.status === "sent"),
      "Expected queued notification jobs to be marked as sent"
    );

    assert(
      (await countNotifications(admin, npoId, marker)) === 2,
      "Expected exactly two total notifications for NPO after first processing run"
    );
    assert(
      (await countNotifications(admin, volunteerId, marker)) === 2,
      "Expected exactly two total notifications for volunteer after first processing run"
    );

    const secondProcessResponse = await fetch(`${supabaseUrl}/functions/v1/process-notification-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ limit: 10 }),
    });
    assert(secondProcessResponse.ok, `Second process-notification-jobs failed with ${secondProcessResponse.status}`);

    assert(
      (await countNotifications(admin, npoId, marker)) === 2,
      "Unexpected duplicate NPO notifications after second processing run"
    );
    assert(
      (await countNotifications(admin, volunteerId, marker)) === 2,
      "Unexpected duplicate volunteer notifications after second processing run"
    );

    console.log("PASS direct insert -> single notification row for NPO");
    console.log("PASS direct insert -> single notification row for volunteer");
    console.log("PASS queued jobs -> single notification row per job");
    console.log("PASS second processing run -> no duplicates");
  } finally {
    if (marker) {
      await admin.from("notification_jobs").delete().ilike("dedupe_key", `%${marker}%`);
      await admin.from("notifications").delete().ilike("title", `%${marker}%`);
    }

    if (volunteerId) {
      await admin.from("profiles").delete().eq("id", volunteerId);
      await admin.auth.admin.deleteUser(volunteerId);
    }
    if (npoId) {
      await admin.from("profiles").delete().eq("id", npoId);
      await admin.auth.admin.deleteUser(npoId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
