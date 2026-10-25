// A29/A30: email e telefono condivisi dal volontario con l'ente.
// Contratto: i contatti si leggono solo da get_shared_contacts_for_npo (mai con una SELECT diretta),
// il client li scrive solo dalla schermata di iscrizione/candidatura, la email del profilo non arriva piu' agli enti.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const migrationName = readdirSync(join(process.cwd(), "supabase", "migrations")).find((f) => f.includes("a29_a30_shared_contacts"));
assert(migrationName, "Manca la migrazione a29_a30_shared_contacts");
const migration = read("supabase", "migrations", migrationName);

assert(/revoke select on public\.activity_participants from anon, authenticated/.test(migration), "activity_participants: SELECT di tabella da revocare");
assert(/grant select \(activity_id, user_id, status, created_at\) on public\.activity_participants/.test(migration), "activity_participants: solo le colonne base restano leggibili");
assert(/revoke select on public\.applications from anon, authenticated/.test(migration), "applications: SELECT di tabella da revocare");
assert(!/grant select \([^)]*\b(email|phone)\b[^)]*\) on public\.(applications|activity_participants)/.test(migration), "email/phone non devono tornare leggibili per colonna");
assert(/drop policy if exists "Participants viewable by everyone"/.test(migration), "La policy per tutti (anche anonimi) va tolta");
assert(/get_shared_contacts_for_npo/.test(migration) && /coalesce\(p\.is_verified, false\)/.test(migration), "La funzione contatti e' solo per l'ente verificato");
assert(/in \('CANCELLED', 'REJECTED'\)/.test(migration) && /status::text = 'REJECTED'/.test(migration), "I contatti spariscono se annullata/rifiutata");
assert(/case when a\.access in \('self', 'admin'\) then a\.email end/.test(migration), "get_public_profiles: email solo a se stessi e admin");

// Client: nessuna SELECT diretta di contatti.
const clientFiles = [
  ["utils", "profileRest.ts"],
  ["services", "ActivityService.ts"],
  ["services", "NPOService.ts"],
];
for (const parts of clientFiles) {
  const src = read(...parts);
  assert(
    !/activity_participants\?select=[^`"']*\b(phone|email)\b/.test(src) && !/applications\?select=[^`"']*\b(phone|email)\b/.test(src),
    `${parts.join("/")}: telefono/email non si leggono con una SELECT diretta`
  );
}
const profileRest = read("utils", "profileRest.ts");
assert(/rpc\/get_shared_contacts_for_npo/.test(profileRest), "profileRest deve leggere i contatti dalla funzione del server");
assert(/email\?: string \| null/.test(profileRest), "joinActivity/submitApplication devono poter portare email");

// Schermata di iscrizione/candidatura: campo email precompilato dal profilo, modificabile, validato.
const review = read("app", "(volunteer)", "review-application.tsx");
assert(/useState\(user\?\.email \|\| ""\)/.test(review), "L'email parte dall'email del profilo");
assert(/isValidEmail\(sharedEmail\)/.test(review), "L'email e' validata prima dell'invio");
assert(/email: sharedEmail \|\| undefined/.test(review), "L'email viene inviata sia in iscrizione sia in candidatura");
assert(/applyToNPOMutation\.mutateAsync\(\{[^}]*phone: sharedPhone/s.test(review), "Il telefono della candidatura non va piu' scartato");

// Nessuna schermata dell'ente legge l'email del profilo del volontario.
const activityDetail = read("app", "activity", "[id].tsx");
assert(!/\{v\.email\}/.test(activityDetail), "Il dettaglio attivita' non mostra l'email del profilo del volontario");
assert(/SharedContactBlock/.test(activityDetail), "Il dettaglio attivita' mostra i contatti condivisi");

// Privacy volontario: nessun interruttore show_email.
const privacy = read("app", "(volunteer)", "settings", "privacy.tsx");
assert(!/show_email/.test(privacy) && !/showEmail/.test(privacy), "Il toggle 'Mostra email' e' stato tolto");

console.log("shared contacts contract passed");
