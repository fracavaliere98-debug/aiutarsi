/**
 * A26 P6a (26/10/2026): accesso alle chat. Prima qualunque utente loggato poteva iscriversi a una chat
 * altrui o aggiungervi altri; le chat private si aprivano senza controllare ban, blocchi o relazione.
 * Controlli statici (no DB). Provato anche su staging con utenti che NON devono entrare (vedi Registro A26).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const migration = read("supabase", "migrations", "20261026233000_a26_p6_chat_access.sql");

assert(/drop policy if exists "Authenticated users can insert participants" on public\.conversation_participants/.test(migration),
  "The open INSERT policy on conversation_participants must be dropped");
assert(/drop policy if exists "Users can join their own conversations" on public\.conversation_participants/.test(migration),
  "Self-join to any conversation must be dropped");
assert(/drop policy if exists "Authenticated users can insert conversations" on public\.conversations/.test(migration),
  "The open INSERT policy on conversations must be dropped");
assert(/c\.type::text = 'ACTIVITY_GROUP'/.test(migration), "Client inserts are limited to activity group chats");
assert(/revoke all on table public\.conversations from anon/.test(migration), "anon must have no access to conversations");
assert(/revoke all on table public\.conversation_participants from anon/.test(migration), "anon must have no access to participants");

// Chat private: ban, blocchi, relazione
const privateFn = migration.split("function public.start_private_conversation_between")[1] ?? "";
assert(/raise exception 'CHAT_NOT_ALLOWED'/.test(privateFn), "Private chat must be refused with CHAT_NOT_ALLOWED");
assert(/not coalesce\(pr\.is_banned, false\)/.test(privateFn), "Banned users must not open private chats");
assert(/public\.blocked_users b/.test(privateFn), "Blocks must be checked");
assert(/b\.blocker_id = v_me and b\.blocked_id = v_other/.test(privateFn) && /b\.blocker_id = v_other and b\.blocked_id = v_me/.test(privateFn),
  "Blocks must be checked in both directions");
assert(/public\.applications a where a\.npo_id = v_me and a\.volunteer_id = v_other/.test(privateFn), "NPO -> volunteer needs an application");
assert(/public\.npo_followers f where f\.npo_id = v_me and f\.follower_id = v_other/.test(privateFn), "NPO -> volunteer may also be a follower");
assert(/a1\.status::text = 'APPROVED' and a2\.status::text = 'APPROVED'/.test(privateFn), "Volunteer -> volunteer needs the same approved NPO");
assert(/revoke execute on function public\.start_private_conversation_between\(uuid, uuid\) from public, anon/.test(migration),
  "anon must not execute the private chat RPC");

// Sync gruppo: chi chiama deve avere titolo
const syncFn = migration.split("function public.sync_group_conversation_participants")[1] ?? "";
assert(/c\.activity_id = p_activity_id/.test(syncFn), "Sync must be bound to the activity's own group chat");
assert(/a\.npo_id = v_caller/.test(syncFn), "Sync allows the owner NPO");
assert(/p_initiator_id <> v_caller/.test(syncFn), "Initiator must be the caller");
assert(/revoke execute on function public\.sync_group_conversation_participants\(uuid, uuid, uuid\) from public, anon/.test(migration),
  "anon must not execute the group sync RPC");

// App: errore atteso mostrato con un messaggio chiaro
const service = read("services", "ChatService.ts");
assert(/class ChatNotAllowedError/.test(service), "ChatService must expose ChatNotAllowedError");
assert(/includes\('CHAT_NOT_ALLOWED'\)/.test(service), "ChatService must map CHAT_NOT_ALLOWED");

const screens: [string, string[]][] = [
  ["NPO volunteer profile", ["app", "(npo)", "volunteer-profile", "[id].tsx"]],
  ["NPO volunteers tab", ["app", "(npo)", "(tabs)", "volunteers.tsx"]],
  ["NPO public profile", ["app", "npo-profile", "[id].tsx"]],
  ["messages list", ["app", "messages", "index.tsx"]],
];
for (const [label, path] of screens) {
  const src = read(...path);
  assert(/instanceof ChatNotAllowedError/.test(src) && /CHAT_NOT_ALLOWED_TOAST/.test(src),
    `${label} must show a friendly message when the chat is not allowed`);
}

// P6b: privacy nelle chat (inbox, riga di profilo, nota di primo contatto)
const p6b = read("supabase", "migrations", "20261026235000_a26_p6b_chat_privacy.sql");
assert(/p_user_id = auth\.uid\(\) OR coalesce\(auth\.role\(\), ''\) = 'service_role'/.test(p6b),
  "get_chat_inbox must serve only the caller's own inbox (service_role excepted)");
assert(/public\.get_public_profiles\(p_ids => ARRAY\[other_part\.user_id\]/.test(p6b),
  "Inbox title/photo must come from get_public_profiles (masked name for non-public volunteers)");
const rowRule = p6b.split("function public.can_view_profile_row")[1]?.split("$function$;")[0] ?? "";
assert(/profile_access_level\(p_target\) in \('self', 'admin', 'full'\)/.test(rowRule) && !/conversation_participants/.test(rowRule),
  "A shared conversation alone must not unlock a profile row");
assert(/p_user_id is distinct from auth\.uid\(\) and coalesce\(auth\.role\(\), ''\) <> 'service_role'/.test(p6b),
  "get_unread_messages_count must check the caller");
assert(/_fillHiddenProfiles/.test(service) && /get_public_profiles/.test(service),
  "ChatService must fill hidden participant/sender profiles from get_public_profiles");
const chatScreen = read("app", "messages", "[id].tsx");
assert(/Se rispondi, accetti di condividere il tuo profilo pubblico con \$\{displayTitle\}\. Email e telefono restano privati\./.test(chatScreen),
  "First-contact note must be shown to the volunteer when the NPO writes first");

console.log("chat-access-contract: ok");
