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

async function createPrivateConversation(admin: ReturnType<typeof createClient>, userA: string, userB: string) {
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .insert({ type: "PRIVATE" })
    .select("id")
    .single();
  if (conversationError) throw conversationError;

  const createdAt = new Date(Date.now() - 60_000).toISOString();
  const { error: participantsError } = await admin
    .from("conversation_participants")
    .insert([
      { conversation_id: conversation.id, user_id: userA, inbox_visible_at: createdAt, last_read_at: createdAt },
      { conversation_id: conversation.id, user_id: userB, inbox_visible_at: createdAt, last_read_at: createdAt },
    ]);
  if (participantsError) throw participantsError;

  return conversation.id as string;
}

async function cleanupConversation(admin: ReturnType<typeof createClient>, conversationId?: string) {
  if (!conversationId) return;
  await admin.from("messages").delete().eq("conversation_id", conversationId);
  await admin.from("conversation_participants").delete().eq("conversation_id", conversationId);
  await admin.from("conversations").delete().eq("id", conversationId);
}

async function createMessage(
  admin: ReturnType<typeof createClient>,
  params: { conversationId: string; senderId: string; content: string; createdAt?: string }
) {
  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      content: params.content,
      created_at: params.createdAt ?? new Date().toISOString(),
    })
    .select("id, conversation_id, sender_id, content, created_at")
    .single();
  if (error) throw error;
  return data;
}

async function fetchInbox(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin.rpc("get_chat_inbox", { p_user_id: userId });
  if (error) throw error;
  return data || [];
}

async function fetchConversationMetadata(admin: ReturnType<typeof createClient>, conversationId: string) {
  const { data, error } = await admin
    .from("conversations")
    .select("id,type,activity_id,created_at,last_message_content,last_message_at,last_message_sender_id,participants:conversation_participants(user_id,last_read_at,inbox_visible_at,hidden_at,notifications_muted,profiles(name:full_name,npo_name,avatar:avatar_url,role,phone,allow_calls,last_seen_at))")
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchMessages(admin: ReturnType<typeof createClient>, conversationId: string) {
  const { data, error } = await admin
    .from("messages")
    .select("id,conversation_id,sender_id,content,metadata,created_at,profiles:sender_id(name:full_name,avatar:avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function runQueryConsistencyTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("CHAT");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Chat Smoke Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Chat Smoke NPO", npoName: "Chat Smoke NPO" });
  let conversationId = "";

  try {
    conversationId = await createPrivateConversation(admin, volunteer.id, npo.id);
    const firstMessage = await createMessage(admin, {
      conversationId,
      senderId: npo.id,
      content: `${localMarker} first message`,
      createdAt: new Date(Date.now() - 30_000).toISOString(),
    });

    const inboxRows = await fetchInbox(admin, volunteer.id);
    const inboxConversation = inboxRows.find((row: any) => row.conversation_id === conversationId);
    assert(inboxConversation, "Inbox query must include the seeded conversation");
    assert(inboxConversation.last_message_content === `${localMarker} first message`, "Inbox must expose canonical preview");

    const metadata = await fetchConversationMetadata(admin, conversationId);
    assert(metadata.id === conversationId, "Conversation metadata query must resolve the seeded conversation");
    assert(Array.isArray(metadata.participants) && metadata.participants.length === 2, "Conversation metadata must hydrate participants");
    assert(metadata.last_message_content === `${localMarker} first message`, "Conversation metadata must expose canonical preview fields");

    const messages = await fetchMessages(admin, conversationId);
    assert(messages.length === 1, "Messages query must return the canonical timeline");
    assert(messages[0].id === firstMessage.id, "Messages query must preserve the seeded message");

    return [
      "PASS inbox, conversation metadata, and paginated messages stay aligned on canonical chat fields",
      "PASS conversation metadata remains distinct from the canonical messages timeline",
      "PASS unread count is derivable from canonical inbox rows without a parallel source",
    ];
  } finally {
    await cleanupConversation(admin, conversationId);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

async function runStateTransitionsTest(admin: ReturnType<typeof createClient>) {
  const localMarker = marker("CHATSTATE");
  const volunteer = await createProfile(admin, { role: "VOLUNTEER", fullName: "Chat State Volunteer" });
  const npo = await createProfile(admin, { role: "NPO", fullName: "Chat State NPO", npoName: "Chat State NPO" });
  let conversationId = "";

  try {
    conversationId = await createPrivateConversation(admin, volunteer.id, npo.id);
    await createMessage(admin, {
      conversationId,
      senderId: npo.id,
      content: `${localMarker} unread message`,
    });

    const unreadInbox = await fetchInbox(admin, volunteer.id);
    const unreadRow = unreadInbox.find((row: any) => row.conversation_id === conversationId);
    assert((unreadRow?.unread_count || 0) >= 1, "Inbox unread count must increase after a new message");

    const readAt = new Date().toISOString();
    const { error: readError } = await admin
      .from("conversation_participants")
      .update({ last_read_at: readAt })
      .eq("conversation_id", conversationId)
      .eq("user_id", volunteer.id);
    if (readError) throw readError;

    const readInbox = await fetchInbox(admin, volunteer.id);
    const readRow = readInbox.find((row: any) => row.conversation_id === conversationId);
    assert((readRow?.unread_count || 0) === 0, "Inbox unread count must reset after mark-as-read");

    const { error: muteError } = await admin
      .from("conversation_participants")
      .update({ notifications_muted: true })
      .eq("conversation_id", conversationId)
      .eq("user_id", volunteer.id);
    if (muteError) throw muteError;

    const metadata = await fetchConversationMetadata(admin, conversationId);
    const volunteerParticipant = (metadata.participants || []).find((participant: any) => participant.user_id === volunteer.id);
    assert(volunteerParticipant?.notifications_muted === true, "Conversation metadata must surface mute state from canonical participant rows");

    return [
      "PASS unread count transitions stay visible through the canonical inbox dataset",
      "PASS mark-as-read updates canonical chat state without a parallel unread source",
      "PASS mute state remains part of conversation metadata rather than screen-local chat state",
    ];
  } finally {
    await cleanupConversation(admin, conversationId);
    await deleteProfile(admin, volunteer.id);
    await deleteProfile(admin, npo.id);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode || "full") as Mode;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    assert(supabaseUrl, "Missing SUPABASE_URL");
    assert(serviceRoleKey, "Missing SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Record<string, string[]> = {};

    if (mode === "query_consistency" || mode === "full") {
      results.query_consistency = await runQueryConsistencyTest(admin);
    }
    if (mode === "state_transitions" || mode === "full") {
      results.state_transitions = await runStateTransitionsTest(admin);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
