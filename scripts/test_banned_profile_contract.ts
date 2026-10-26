/**
 * A37 (26/10/2026) — profilo di un utente bannato. Decisioni di Francesco:
 *  - chi non e' admin vede "Profilo non disponibile" (messaggio neutro, nessun dato); l'admin vede tutto + banner;
 *  - il bannato non compare nella scoperta; post e storie nascosti agli altri;
 *  - al BAN si annullano iscrizioni ad attivita' non concluse, candidature in attesa e, se ente, le sue attivita'.
 * Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const sql = read("supabase", "migrations", "20261026171643_a37_banned_profile_unavailable.sql");
assert(/when coalesce\(c\.is_banned, false\) then 'unavailable'/.test(sql), "get_public_profiles must mark banned users as unavailable");
assert(/not \(a\.access = 'unavailable' and p_ids is null\)/.test(sql), "Banned users must not appear in discovery lists");
assert(/'Utente non disponibile'/.test(sql), "Unavailable profiles must carry a neutral name");
assert(/when \(select banned from t\) then 'none'/.test(sql), "Direct profile rows of banned users must be hidden (profile_access_level)");
assert(/Banned authors hidden \(posts\)/.test(sql) && /Banned authors hidden \(stories\)/.test(sql), "Posts and stories of banned users must be hidden");
assert(/set status = 'CANCELLED'/.test(sql) && /set status = 'REJECTED'/.test(sql) && /set status = 'CANCELLATA'/.test(sql), "Ban must cancel participations, pending applications and (NPO) open activities");
assert(!/delete from public\.activities/i.test(sql), "Activities are cancelled, never deleted (D05)");

const unavailable = read("components", "ui", "ProfileUnavailable.tsx");
assert(/Profilo non disponibile/.test(unavailable) && /non è più visibile su AiutarSi/.test(unavailable), "Neutral unavailable screen text");
assert(!/bannat|sospes/i.test(unavailable.replace(/\/\*\*[\s\S]*?\*\//g, "")), "The unavailable screen must not reveal the ban");

for (const screen of [["app", "(npo)", "volunteer-profile", "[id].tsx"], ["app", "npo-profile", "[id].tsx"]]) {
  const src = read(...screen);
  assert(/profile_access === 'unavailable'/.test(src) && /<ProfileUnavailable/.test(src), `${screen.join("/")} must show ProfileUnavailable for banned users`);
  assert(/BannedUserBanner/.test(src) && /'ADMIN'|"ADMIN"/.test(src), `${screen.join("/")} must show the ban banner to admins`);
}

console.log("banned profile contract OK");
