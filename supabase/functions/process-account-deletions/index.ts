import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

const DEFAULT_GRACE_PERIOD_DAYS = 30;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

type DueProfile = {
  id: string;
  deletion_requested_at: string;
};

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      (Deno.env.get("LEGACY_SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "",
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const gracePeriodDays = Number(body?.gracePeriodDays) > 0
      ? Number(body.gracePeriodDays)
      : DEFAULT_GRACE_PERIOD_DAYS;
    const limit = Math.min(Math.max(Number(body?.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const dryRun = Boolean(body?.dryRun);

    const cutoff = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();

    // Users who requested deletion more than `gracePeriodDays` ago and never
    // cancelled (cancelling clears deletion_requested_at back to null, see
    // ProfileService.cancelAccountDeletion / AccountDeletionAlert).
    const { data: dueProfiles, error: selectError } = await supabase
      .from("profiles")
      .select("id, deletion_requested_at")
      .not("deletion_requested_at", "is", null)
      .lte("deletion_requested_at", cutoff)
      .limit(limit);

    if (selectError) throw selectError;

    const due = (dueProfiles ?? []) as DueProfile[];

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          gracePeriodDays,
          cutoff,
          dueCount: due.length,
          ids: due.map((p) => p.id),
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    let deleted = 0;
    const failures: { id: string; error: string }[] = [];

    for (const profile of due) {
      // Deletes from auth.users; public.profiles cascades via
      // profiles_id_fkey (ON DELETE CASCADE), which cascades further into
      // every other table that references profiles, except
      // admin_audit_logs.admin_id (kept ON DELETE NO ACTION on purpose, to
      // protect the audit trail — admin accounts are not expected to
      // self-delete through this flow).
      const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
      if (deleteError) {
        console.error(`[process-account-deletions] Failed to delete user ${profile.id}`, deleteError);
        failures.push({ id: profile.id, error: deleteError.message });
        continue;
      }
      deleted += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        gracePeriodDays,
        cutoff,
        dueCount: due.length,
        deleted,
        failed: failures.length,
        failures,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("[process-account-deletions] Error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
