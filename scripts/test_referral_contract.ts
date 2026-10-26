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

console.log("referral contract OK");
