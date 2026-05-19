import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
    // Called by DB webhook via net.http_post with service_role key as Authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const payload = await req.json();

        // Webhook payload from Supabase: payload.type === 'INSERT', payload.table === 'messages'
        const message = payload.record;

        if (!message) {
            return new Response("No message provided", { status: 400 });
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: participants, error: participantsError } = await supabaseClient
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", message.conversation_id)
            .neq("user_id", message.sender_id);

        if (participantsError || !participants) {
            console.error("Error fetching participants:", participantsError);
            return new Response("Error fetching participants", { status: 500 });
        }

        const { data: senderProfile } = await supabaseClient
            .from("profiles")
            .select("full_name")
            .eq("id", message.sender_id)
            .single();

        const senderName = senderProfile?.full_name || "Nuovo Messaggio";
        const recipientIds = participants.map((p) => p.user_id);

        const { data: profiles, error: profilesError } = await supabaseClient
            .from("profiles")
            .select("id, expo_push_token")
            .in("id", recipientIds)
            .not("expo_push_token", "is", null);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return new Response("Error fetching profiles", { status: 500 });
        }

        const pushMessages = [];

        for (const profile of profiles) {
            const { data: unreadMsgs } = await supabaseClient
                .rpc("get_unread_messages_count", { p_user_id: profile.id });

            const { count: unreadNotifs } = await supabaseClient
                .from("notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", profile.id)
                .eq("read", false);

            const badgeCount = (unreadMsgs || 0) + (unreadNotifs || 0);

            pushMessages.push({
                to: profile.expo_push_token,
                sound: "default",
                title: senderName,
                priority: "high",
                body: message.content.substring(0, 100),
                badge: badgeCount,
                data: {
                    conversationId: message.conversation_id,
                    type: "chat_message",
                },
            });
        }

        if (pushMessages.length > 0) {
            await fetch(EXPO_PUSH_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(pushMessages),
            });
        }

        return new Response(JSON.stringify({ success: true, recipients: pushMessages.length }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Internal server error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
});
