/**
 * A32 (2026-10-26) — codice amico. Regola di Francesco:
 *  - referral_code = codice PROPRIO da condividere: ogni utente ne ha uno, lo crea il server;
 *  - referred_by   = "invitato da": solo da un codice inserito in onboarding, mai inventato, una volta sola.
 * Prima il referred_by di onboarding veniva scartato da AuthService.updateProfile (mai salvato) e il premio
 * "Coppia Vincente" non scattava mai. Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const onboarding = read("app", "onboarding", "profile.tsx");
assert(/authService\.setMyReferrer\(/.test(onboarding), "Onboarding must save the referrer through authService.setMyReferrer");
assert(/if \(referralCode\.trim\(\)\)/.test(onboarding), "Referrer is set only when the user typed a code");
assert(!/referred_by\s*:/.test(onboarding), "Onboarding must not pass referred_by to updateUserProfile (it was silently dropped)");
assert(/'not_found'/.test(onboarding) && /'self'/.test(onboarding), "Onboarding must tell the user when the code is wrong or is their own");

const auth = read("services", "AuthService.ts");
assert(/rpc\('set_my_referrer'/.test(auth), "setMyReferrer must call rpc set_my_referrer");
assert(/rpc\('ensure_my_referral_code'\)/.test(auth), "Own referral code must be ensured server-side");
assert(!/updateVolunteerProfile\([^)]*referral_code/.test(auth), "Client must not write referral_code directly");

const rest = read("utils", "profileRest.ts");
assert(!/resolveReferralCode/.test(rest), "Client-side referral code resolution (case-sensitive) was removed");

const sql = read("supabase", "migrations", "20261026100000_a22_a32_referral_and_profile_guard.sql");
assert(/upper\(referral_code\) = v_code/.test(sql), "Referral code lookup must be case-insensitive");
assert(/referred_by is null/.test(sql) && /'self'/.test(sql), "Referrer is set once and never to yourself");
assert(!/referred_by_id/.test(sql.split("-- 2)")[1] || ""), "Signup must not accept referred_by from user metadata");
assert(/new\.referred_by := old\.referred_by/.test(sql) && /new\.referral_code := old\.referral_code/.test(sql), "Profile guard must protect referred_by and referral_code");

// A22 secondo giro: email/email_confirmed protetti; le funzioni di Supabase Auth usano l'eccezione;
// la sync email non accetta piu' il ruolo dai metadata; la gamification non lascia l'eccezione accesa.
const guard2 = read("supabase", "migrations", "20261026110000_a22_a32_email_guard_single_award.sql");
assert(/new\.email := old\.email/.test(guard2) && /new\.email_confirmed := old\.email_confirmed/.test(guard2), "Profile guard must protect email and email_confirmed");
assert((guard2.match(/'app\.bypass_profile_guard', 'true'/g) || []).length >= 2, "Auth sync functions must set the profile guard bypass");
assert(!/raw_user_meta_data->>'role'\)::public\.user_role/.test(guard2), "Email sync must not trust the role from user metadata");
const gam = read("supabase", "migrations", "20261026113000_a22_gamification_bypass_restore.sql");
assert(/v_prev/.test(gam), "sync_gamification_to_profile must restore the previous bypass value");

console.log("referral contract OK");
