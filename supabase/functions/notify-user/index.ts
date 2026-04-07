import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeNotificationRequestBody } from "../_shared/notifyUserPayload.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { userId, title, body, data } = normalizeNotificationRequestBody(payload);

        if (!userId || !title || !body) {
            return new Response(JSON.stringify({ error: "Missing userId/title/body" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("expo_push_token")
            .eq("id", userId)
            .single();

        if (profileError) {
            return new Response(JSON.stringify({ error: profileError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!profile?.expo_push_token) {
            return new Response(JSON.stringify({ success: true, skipped: "missing_push_token" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const unreadNotifsPromise = supabaseClient
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("read", false);

        const unreadMsgsPromise = supabaseClient.rpc("get_unread_messages_count", { p_user_id: userId });

        const [{ count: unreadNotifs }, { data: unreadMsgs }] = await Promise.all([
            unreadNotifsPromise,
            unreadMsgsPromise,
        ]);

        const badge = (unreadNotifs || 0) + (unreadMsgs || 0);

        const expoRes = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: profile.expo_push_token,
                sound: "default",
                title,
                body,
                badge,
                data: data || {},
            }),
        });

        const expoData = await expoRes.json();

        return new Response(JSON.stringify({ success: true, expo: expoData }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[notify-user] Error", error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
