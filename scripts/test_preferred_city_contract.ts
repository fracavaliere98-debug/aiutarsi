/**
 * P11 (2026-10-26) — Regola di Francesco: la posizione attuale del volontario non la vede nessuno (serve solo in
 * background per suggerire attivita'); "Posizione preferita" = capoluogo scelto dal volontario, mostrata sul profilo
 * solo se la rende pubblica. Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const sql = read("supabase", "migrations", "20261026170000_p11_preferred_city_and_volunteer_location.sql");
assert(/new\.role = 'VOLUNTEER'::public\.user_role[\s\S]*new\.location_string := null/.test(sql), "Trigger must null location_string for volunteers");
assert(/before insert or update on public\.profiles/.test(sql), "Trigger must run on insert and update");
assert(/a\.role in \(''NPO'', ''CORPORATE''\) then a\.location_string end/.test(sql), "get_public_profiles must return location_string only for NPO and CORPORATE");
assert((sql.match(/\('[^']+(?:''[^']*)*','[A-Z]{2}','[^']+(?:''[^']*)*'\)/g) || []).length === 119, "Seed must contain the 119 provincial capitals");
assert(/is_public and public\.can_view_profile_row\(user_id\)/.test(sql), "Others see the preferred city only when public and the profile is visible to them");
assert(/revoke all on table public\.volunteer_preferred_city from anon, authenticated/.test(sql), "No direct writes to volunteer_preferred_city");
assert(/set_my_preferred_city[\s\S]*'VOLUNTEER'::public\.user_role/.test(sql), "Only volunteers can set a preferred city");
assert(/p_is_public boolean default false/.test(sql) && /coalesce\(p_is_public, false\)/.test(sql), "Preferred city is private unless the volunteer says otherwise");
assert(!/grant select \([^)]*location_(lat|lng|coords)/.test(sql), "Coordinates must never be granted to clients");

const service = read("services", "PreferredCityService.ts");
assert(/rpc\('set_my_preferred_city'/.test(service), "Writes go through the RPC");
assert(!/\.(insert|upsert|update|delete)\(/.test(service), "Client must not write volunteer_preferred_city directly");

const header = read("components", "profile", "ProfileHeader.tsx");
assert(!/user\??\.location_string/.test(header), "Profile header must not show the free-text location of a volunteer");
assert(/preferredCity/.test(header), "Profile header shows the preferred city");

const onboarding = read("app", "onboarding", "profile.tsx");
assert(/PreferredCityPicker/.test(onboarding) && /setMyPreferredCity\(/.test(onboarding), "Onboarding must let the volunteer choose the preferred city");

const edit = read("app", "(volunteer)", "settings", "edit-profile.tsx");
assert(/PreferredCityPicker/.test(edit), "Volunteer settings must let the volunteer change the preferred city");
assert(!/updateUserProfile\([\s\S]{0,400}location_string/.test(edit), "Volunteer settings must not save a free-text location");

console.log("preferred-city-contract: ok");
