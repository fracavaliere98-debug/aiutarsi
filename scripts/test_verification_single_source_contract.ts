// A28: lo stato di verifica di un ente ha una sola fonte (profiles.verification_status).
// is_verified e' derivata dal database; il client non scrive nessuno dei due.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const migrationName = readdirSync(join(process.cwd(), "supabase", "migrations")).find((f) => f.includes("a28_verification_single_source"));
assert(migrationName, "Manca la migrazione a28_verification_single_source");
const migration = read("supabase", "migrations", migrationName);

assert(/new\.is_verified := \(new\.verification_status = 'verified'\)/.test(migration), "is_verified deve derivare da verification_status");
assert(/profiles_is_verified_matches_status/.test(migration), "Serve il vincolo che impedisce la divergenza");
assert(/create trigger verification_request_sets_pending/.test(migration), "Il pending lo imposta il database");
assert(/admin_review_verification/.test(migration) && /for update/.test(migration), "Approvazione/rifiuto atomici in una sola funzione");
assert(/drop function if exists public\.admin_set_npo_verification/.test(migration), "La vecchia funzione a due scritture esce");

const admin = read("app", "admin", "verification", "[id].tsx");
assert(/rpc\('admin_review_verification'/.test(admin), "L'admin usa la funzione atomica");
assert(!/admin_set_npo_verification/.test(admin) && !/from\('verification_requests'\)\s*\.update/.test(admin), "L'admin non aggiorna richiesta e profilo in due passaggi");

for (const parts of [
  ["components", "npo", "NPOVerificationFlow.tsx"],
  ["app", "(npo)", "(tabs)", "profile.tsx"],
  ["services", "AuthService.ts"],
]) {
  const src = read(...parts);
  assert(!/verification_status:\s*["']pending["']/.test(src), `${parts.join("/")}: il client non scrive verification_status`);
}

// Le funzioni di prova scrivono solo verification_status (is_verified la deriva il database).
const functionsDir = join(process.cwd(), "supabase", "functions");
for (const dir of readdirSync(functionsDir).filter((d) => d.endsWith("-smoke"))) {
  const src = read("supabase", "functions", dir, "index.ts");
  assert(!/is_verified:\s*(true|false)/.test(src), `${dir}: non deve scrivere is_verified`);
}

console.log("verification single source contract passed");
