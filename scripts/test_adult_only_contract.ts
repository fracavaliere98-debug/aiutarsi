/**
 * A26 P7 (27/10/2026): niente minorenni, controllo anche sul server. Prima il divieto 18+ stava solo nel
 * client; ora un trigger su profiles rifiuta con ADULT_REQUIRED una data da minorenne e il completamento
 * del profilo di un volontario senza data di nascita. Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const migration = read("supabase", "migrations", "20261027090000_a26_p7_adult_only.sql");
assert(/current_date - interval '18 years'/.test(migration), "Server must compare the date of birth with today minus 18 years");
assert(/raise exception 'ADULT_REQUIRED'/.test(migration), "Server must refuse with ADULT_REQUIRED");
assert(/new\.role::text = 'VOLUNTEER'/.test(migration) && /new\.date_of_birth is null/.test(migration),
  "A volunteer must not complete the profile without a date of birth");
assert(/before insert or update of date_of_birth, profile_completed on public\.profiles/.test(migration),
  "Trigger must fire on insert and on changes to date_of_birth / profile_completed");
assert(/tg_op = 'INSERT' or new\.date_of_birth is distinct from old\.date_of_birth/.test(migration),
  "Existing profiles must not be touched unless the date changes");

const onboarding = read("app", "onboarding", "profile.tsx");
assert(/includes\("ADULT_REQUIRED"\)/.test(onboarding), "Onboarding must show a friendly message for ADULT_REQUIRED");
assert(/isAdult\(birthDateIso\)/.test(onboarding), "The client check must stay in place");

console.log("adult-only-contract: ok");
