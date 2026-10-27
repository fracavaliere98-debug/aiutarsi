/**
 * A26 P9 (27/10/2026): la colonna profiles.profile_public non esiste piu'. La visibilita' del profilo la
 * decide solo il server (profile_access_level / get_public_profiles). Controlli statici (no DB):
 * la migration la elimina e il codice dell'app non la nomina piu'.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

const migration = read("supabase", "migrations", "20261027100000_a26_p9_remove_profile_public.sql");
assert(/alter table public\.profiles drop column if exists profile_public/.test(migration), "Migration must drop profiles.profile_public");
assert(!/profile_public = case/.test(migration), "update_my_profile_core must not write profile_public any more");
assert(/drop function if exists public\.update_my_profile_settings\(boolean, boolean, boolean, boolean\)/.test(migration)
  && /drop function if exists public\.update_my_profile_settings\(boolean, boolean, boolean, boolean, boolean\)/.test(migration),
  "Both update_my_profile_settings overloads must be dropped");

const SKIP = new Set(["node_modules", ".git", "backups", "audit", "migrations", ".expo", "dist", "ios", "android"]);
const offenders: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name !== "test_profile_public_removed_contract.ts" && /\.(ts|tsx)$/.test(name)
      && /profile_public(?!_removed)/.test(readFileSync(full, "utf8"))) offenders.push(full.slice(root.length + 1));
  }
};
walk(root);
assert(offenders.length === 0, `profile_public must not appear in app code: ${offenders.join(", ")}`);

console.log("profile-public-removed-contract: ok");
