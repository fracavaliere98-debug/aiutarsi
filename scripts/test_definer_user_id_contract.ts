/**
 * A26 P10 (27/10/2026): le funzioni SECURITY DEFINER non si fidano piu' di un id utente passato dal
 * chiamante. Controlli statici sulla migration (no DB) e sul chiamante dell'app.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const m = read("supabase", "migrations", "20261027110000_a26_p10_definer_user_id_checks.sql");

assert(/IF coalesce\(auth\.role\(\), ''\) <> 'service_role' THEN\s+p_user_id := auth\.uid\(\);\s+END IF;/.test(m),
  "get_activities_with_match must force p_user_id to auth.uid() unless the caller is service_role");
assert(m.indexOf("p_user_id := auth.uid()") < m.indexOf("IF p_user_id IS NOT NULL THEN"),
  "The p_user_id guard must run before the profile is read");
assert(/SELECT \(p_user_id = auth\.uid\(\) OR coalesce\(auth\.role\(\), ''\) = 'service_role'\)\s+AND EXISTS/.test(m),
  "is_conversation_participant must answer only for the caller (or service_role)");
assert(/revoke execute on function public\.sync_activity_reminder_job\(uuid, uuid\) from public, anon, authenticated/.test(m),
  "sync_activity_reminder_job must not be callable by clients");
assert(/revoke execute on function public\.sync_activity_reminder_jobs_for_activity\(uuid\) from public, anon, authenticated/.test(m),
  "sync_activity_reminder_jobs_for_activity must not be callable by clients");

// Le edge function che chiamano get_activities_with_match con un id utente devono usare service_role.
const gemma = read("supabase", "functions", "gemma-help-assistant", "index.ts");
assert(/serviceClient\.rpc\("get_activities_with_match"/.test(gemma), "gemma-help-assistant must call it with the service client");

console.log("definer-user-id-contract: ok");
