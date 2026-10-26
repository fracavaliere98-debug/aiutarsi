/**
 * A40 (2026-10-26) — La notifica "Aggiornamento Segnalazione" apre l'esito per chi ha segnalato.
 * Scelta di Francesco: due esiti (provvedimenti presi / nessuna violazione), mai la sanzione esatta (coerente con A37).
 * Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_UPDATE_NOTIFICATION_TITLE } from "../utils/reportCategory";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

const sql = read("supabase", "migrations", "20261026230000_a40_my_reports_outcome.sql");
const body = sql.slice(sql.indexOf("returns table"), sql.indexOf("$$;"));
assert(/r\.reporter_id = auth\.uid\(\)/.test(sql), "get_my_reports must return only the caller's own reports");
assert(/revoke all on function public\.get_my_reports\(\) from public, anon/.test(sql), "anon must not call get_my_reports");
for (const col of ["reported_id", "admin_id", "admin_notes", "evidence_snapshot"]) {
  assert(!body.includes(col), `get_my_reports must not expose ${col}`);
}
assert(!/^\s*r\.status,?\s*$/m.test(body), "get_my_reports must not return the raw status");
assert(/when r\.status = 'dismissed' then 'no_violation'/.test(sql) && /else 'action_taken'/.test(sql), "Only two decided outcomes");

const service = read("services", "MyReportsService.ts");
assert(/rpc\('get_my_reports'\)/.test(service), "Reporter reads outcomes through the RPC");
assert(!/from\('reports'\)/.test(service), "Reporter must not read the reports table directly");

const screen = read("app", "my-reports.tsx");
assert(!/supabase/.test(screen), "Screen must not call Supabase directly");
assert(!/bannat|ban\b|avvertiment/i.test(screen), "Screen must not reveal the exact sanction");

const admin = read("app", "admin", "report", "[id].tsx");
assert(/REPORT_UPDATE_NOTIFICATION_TITLE/.test(admin), "Admin screen must send the shared notification title");
assert(REPORT_UPDATE_NOTIFICATION_TITLE === "Aggiornamento Segnalazione", "Title must stay equal to notifications already sent");

console.log("my-reports-contract: ok");
