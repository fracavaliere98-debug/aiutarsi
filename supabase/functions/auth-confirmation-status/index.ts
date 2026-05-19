import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// 10 requests per hour per IP — prevents email enumeration via brute-force
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: "Email mancante." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Rate limit by IP
    const ip = getClientIp(req);
    const scopeKey = `auth-confirmation:${ip}`;
    const { data: allowed, error: rlError } = await supabase.rpc(
      "try_consume_ai_rate_limit",
      {
        p_scope_key: scopeKey,
        p_max_calls: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }
    );
    if (rlError || !allowed) {
      return new Response(JSON.stringify({ error: "Too many requests." }), {
        status: 429,
        headers: { ...corsHeaders, "Retry-After": "3600" },
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email_confirmed")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Role is intentionally omitted — returning it enables user enumeration by role
    return new Response(
      JSON.stringify({
        exists: !!data,
        confirmed: data?.email_confirmed === true,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
