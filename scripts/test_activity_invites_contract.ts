/**
 * D08 (26/10/2026): inviti degli enti alle attivita'. Il flag "gia' invitato" e il tetto di 5 inviti per
 * attivita' stanno in una tabella (le notifiche si cancellano dopo 20 giorni); i volontari consigliati
 * per una attivita' arrivano da una RPC che restituisce solo id, nome, foto e punteggio.
 * Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const migration = read("supabase", "migrations", "20261026210000_d08_activity_invites_and_suggestions.sql");
assert(/create table if not exists public\.npo_activity_invites/.test(migration), "Invites table must exist");
assert(/primary key \(activity_id, volunteer_id\)/.test(migration), "One invite per activity + volunteer");
assert(/enable row level security/.test(migration), "Invites table must have RLS");
assert(/revoke all on public\.npo_activity_invites from anon, authenticated/.test(migration), "Clients must not write the table");
assert(/>= 5 then\s+raise exception 'INVITE_LIMIT_REACHED'/.test(migration), "Server must cap invites at 5 per activity");
assert(/for update;/.test(migration), "Activity row must be locked so the cap holds under concurrent taps");
assert(/profile_access_level\(p\.id\) = 'full'/.test(migration), "Suggestions must follow the profile visibility rule");
assert(/ap0\.npo_id = v_uid and ap0\.volunteer_id = p\.id and ap0\.status::text = 'APPROVED'/.test(migration),
  "Suggestions must come only from the NPO's approved volunteers (followers are invited from the Last Minute flow)");
assert(/returns table \(volunteer_id uuid, full_name text, avatar_url text, score numeric, already_invited boolean\)/.test(migration),
  "Suggestions must return only id, name, photo, score and invite flag");
assert(!/location|phone|email|bio|skill/i.test(migration.split("get_suggested_volunteers_for_activity")[1] ?? ""),
  "Suggestions must not touch location, contacts, bio or skills");

const service = read("services", "NPOService.ts");
assert(/MAX_ACTIVITY_INVITES = 5/.test(service), "Client cap constant must be 5");
assert(/from\('npo_activity_invites'\)\.select\('activity_id, volunteer_id'\)/.test(service), "Client reads invites with explicit columns");
assert(/rpc\('get_suggested_volunteers_for_activity'/.test(service), "Suggestions go through the RPC");

const inviteModal = read("components", "npo", "InviteToActivityModal.tsx");
assert(/Già invitato a questa attività/.test(inviteModal), "Invite modal must show the already-invited flag");
assert(/disabled=\{blocked\}/.test(inviteModal), "Already-invited activities must not be tappable");

const suggested = read("components", "npo", "SuggestedVolunteersModal.tsx");
assert(/Inviti mandati: \$\{invitedCount\} su \$\{maxInvites\}/.test(suggested), "Suggested modal must show the invite counter");
assert(/Già invitato/.test(suggested), "Suggested modal must show the already-invited flag");

const volunteersTab = read("app", "(npo)", "(tabs)", "volunteers.tsx");
assert(/Invita il follower a questa attività/.test(volunteersTab), "Last Minute CTA must say it invites a follower");
assert(/Follower già invitato/.test(volunteersTab), "Last Minute card must show the already-invited flag");

const activityScreen = read("app", "activity", "[id].tsx");
assert(/<SuggestedVolunteersModal/.test(activityScreen), "Activity screen must open the suggested volunteers modal");
assert(/canInviteSuggested = isOwner && /.test(activityScreen), "Only the owner NPO of an open activity can invite");

console.log("activity-invites-contract: ok");
