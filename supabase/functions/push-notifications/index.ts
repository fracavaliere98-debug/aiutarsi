import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
    try {
        const payload = await req.json();

        // Webhook payload from Supabase
        // payload.type === 'INSERT', payload.table === 'messages'
        const message = payload.record;

        if (!message) {
            return new Response("No message provided", { status: 400 });
        }

        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Get the conversation participants (recipients)
        const { data: participants, error: participantsError } = await supabaseClient
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", message.conversation_id)
            .neq("user_id", message.sender_id);

        if (participantsError || !participants) {
            console.error("Error fetching participants:", participantsError);
            return new Response("Error fetching participants", { status: 500 });
        }

        // 2. Get the sender's profile for the notification title
        const { data: senderProfile } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', message.sender_id)
            .single();

        const senderName = senderProfile?.full_name || 'Nuovo Messaggio';

        const recipientIds = participants.map((p) => p.user_id);

        // Also save a notification in DB
        const internalNotifications = recipientIds.map(userId => ({
            user_id: userId,
            type: 'INFO',
            title: `Nuovo messaggio da ${senderName}`,
            message: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
            read: false
        }));

        await supabaseClient.from('notifications').insert(internalNotifications);

        // Now get the Expo tokens for sending actual Push Notifications
        const { data: profiles, error: profilesError } = await supabaseClient
            .from("profiles")
            .select("expo_push_token")
            .in("id", recipientIds)
            .not("expo_push_token", "is", null);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return new Response("Error fetching profiles", { status: 500 });
        }

        // 4. Send Expo Push Notifications
        const pushMessages = profiles
            .filter((profile) => profile.expo_push_token)
            .map((profile) => ({
                to: profile.expo_push_token,
                sound: "default",
                title: senderName,
                body: message.content.substring(0, 100),
                data: { conversationId: message.conversation_id },
            }));

        if (pushMessages.length > 0) {
            const expoRes = await fetch(EXPO_PUSH_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(pushMessages),
            });

            const expoData = await expoRes.json();
            console.log("Expo Push Response:", expoData);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Internal server error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
});
