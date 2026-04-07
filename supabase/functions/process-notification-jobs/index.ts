import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  cleanupRetention,
  processDueJobs,
  queueReviewReminderFallbackJobs,
  queueWeeklyNpoRecaps,
  queueWeeklyVolunteerRecaps,
} from "../_shared/notificationJobs.ts";

type RequestMode = "all" | "due" | "review_backfill" | "weekly_recaps" | "cleanup";

const jsonHeaders = { "Content-Type": "application/json" };

async function runMode(supabase: any, mode: RequestMode, now: Date, limit: number) {
  switch (mode) {
    case "due":
      return { processed: await processDueJobs(supabase, now, limit) };
    case "review_backfill":
      await queueReviewReminderFallbackJobs(supabase, now);
      return { processed: await processDueJobs(supabase, now, limit) };
    case "weekly_recaps":
      await queueWeeklyNpoRecaps(supabase, now);
      await queueWeeklyVolunteerRecaps(supabase, now);
      return { processed: await processDueJobs(supabase, now, limit) };
    case "cleanup":
      return { cleaned: await cleanupRetention(supabase, now) };
    case "all":
    default:
      await queueReviewReminderFallbackJobs(supabase, now);
      await queueWeeklyNpoRecaps(supabase, now);
      await queueWeeklyVolunteerRecaps(supabase, now);
      return {
        processed: await processDueJobs(supabase, now, limit),
        cleaned: await cleanupRetention(supabase, now),
      };
  }
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Number(body?.limit || 100);
    const mode = ((body?.mode as RequestMode | undefined) || "due") as RequestMode;
    const now = new Date();
    const result = await runMode(supabase, mode, now, limit);

    return new Response(JSON.stringify({ success: true, mode, ...result }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("[process-notification-jobs] Error", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
