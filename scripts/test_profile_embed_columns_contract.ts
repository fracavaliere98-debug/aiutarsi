/**
 * Contract test (2026-10-26, task A38): nessuna lettura di profili con `*`.
 *
 * Dopo A26/A22 il ruolo authenticated ha SELECT solo su alcune colonne di public.profiles.
 * Una select con `*` su profiles (diretta o annidata, es. follower:follower_id(*)) fallisce con
 * 42501 "permission denied for table profiles". Era successo in NPOService.getFollowers: la lista
 * follower dell'ente restava vuota senza errori visibili.
 *
 * Controllo statico sul sorgente (no Metro, no DB).
 * Run: npx tsx scripts/test_profile_embed_columns_contract.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const REPO_ROOT = join(__dirname, "..");
const DIRS = ["services", "utils"];

// Embed annidato con `*` su una chiave esterna verso profiles (…_id(*) / profiles(*)),
// oppure .from('profiles') seguito da .select('*').
const EMBED_STAR = /\b\w+_id(?:!\w+)?\s*\(\s*\*|\bprofiles(?:!\w+)?\s*\(\s*\*/;
const FROM_PROFILES_STAR = /from\(\s*['"]profiles['"]\s*\)\s*\.select\(\s*['"`]\s*\*/;

const offenders: string[] = [];
for (const dir of DIRS) {
  for (const name of readdirSync(join(REPO_ROOT, dir))) {
    if (!/\.tsx?$/.test(name)) continue;
    const src = readFileSync(join(REPO_ROOT, dir, name), "utf8");
    if (EMBED_STAR.test(src) || FROM_PROFILES_STAR.test(src)) offenders.push(`${dir}/${name}`);
  }
}
assert(offenders.length === 0, `Select con * su profiles (usa colonne esplicite): ${offenders.join(", ")}`);

const npo = readFileSync(join(REPO_ROOT, "services", "NPOService.ts"), "utf8");
assert(/follower:follower_id\s*\(\s*id,\s*role,\s*full_name,\s*avatar_url,\s*last_seen_at/.test(npo), "getFollowers deve chiedere solo le colonne mostrate (id, role, full_name, avatar_url, last_seen_at)");

console.log("profile-embed-columns-contract: ok");
