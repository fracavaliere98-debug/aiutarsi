import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getReportCategory } from "../utils/reportCategory";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

// Le segnalazioni dei post devono arrivare nella tabella letta dagli admin.
const mutations = read("hooks", "community", "mutations.ts");
assert(!/from\("community_reports"\)/.test(mutations), "Post reports must not go to community_reports (nobody reads it)");
assert(/from\("reports"\)[\s\S]{0,400}content_type: "community_post"/.test(mutations), "Post reports must insert into reports with content_type community_post");

// Il flag AI non deve più usare un reporter inesistente (FK) né ignorare l'errore.
const moderator = read("supabase", "functions", "community-moderator-ai", "index.ts");
assert(!/from\('community_reports'\)/.test(moderator), "AI moderation must write to reports");
assert(/is_ai_generated: true/.test(moderator) && /Could not record AI report/.test(moderator), "AI report insert must be flagged and its error logged");

// `reports` non ha report_category: nessuna select deve richiederla.
assert(!/select\([^)]*report_category/.test(read("services", "AdminNotificationService.ts")), "reports has no report_category column");

// Categoria derivata dal prefisso del motivo.
assert(getReportCategory({ reason: "Spam: segnalato dal feed" }) === "SPAM", "category from reason prefix");
assert(getReportCategory({ reason: "Testo libero senza prefisso" }) === "ALTRO", "fallback category");

// L'ammonimento deve avvisare l'utente segnalato.
const detail = read("app", "admin", "report", "[id].tsx");
assert(/action === 'warned'[\s\S]{0,200}report\.reported_id/.test(detail), "Warn action must notify the reported user");

// A31 (2026-10-25): chiusura segnalazione e ban passano da una sola RPC lato server.
// Il client non puo' scrivere il profilo di un altro utente (RLS solo propria riga + trigger
// protect_privileged_profile_fields): con la PATCH diretta il ban non aveva effetto e l'audit log
// (admin_audit_logs senza policy INSERT) non veniva salvato.
assert(!/from\('profiles'\)[\s\S]{0,80}\.update\(/.test(detail), "Admin report screen must not update profiles directly (ban goes through admin_resolve_report)");
assert(!/from\('admin_audit_logs'\)\.insert/.test(detail), "Audit log is written by admin_resolve_report, not by the client");
assert(!/from\('reports'\)[\s\S]{0,80}\.update\(/.test(detail), "Report status is updated by admin_resolve_report");
assert(/adminNotificationService\.resolveReport\(/.test(detail), "Admin report screen must call adminNotificationService.resolveReport");
const adminService = read("services", "AdminNotificationService.ts");
assert(/withTimeout\(\s*supabase\.rpc\('admin_resolve_report'/.test(adminService), "resolveReport must call rpc admin_resolve_report with a timeout");
const a31 = read("supabase", "migrations", "20261025225000_a31_admin_resolve_report.sql");
assert(/is_current_user_admin\(\)/.test(a31) && /app\.bypass_profile_guard/.test(a31), "admin_resolve_report must check ADMIN before bypassing the profile guard");
assert(/new\.role := old\.role/.test(a31) && /new\.is_banned := old\.is_banned/.test(a31), "Profile guard must protect role and is_banned");

// A31 (26/10/2026): una segnalazione si decide una volta sola e 'Nascondi' (resolved) non esiste piu'.
assert(!/handleAction\('resolved'/.test(detail), "'Nascondi' was removed: it did not hide any content");
assert(/isDecided/.test(detail) && /Decisione presa/.test(detail), "A decided report must show the decision instead of the action buttons");
assert(/already_decided/.test(detail), "The screen must handle a report already decided by someone else");
const once = read("supabase", "migrations", "20261026153500_a31_report_decision_once.sql");
assert(/p_action not in \('dismissed', 'warned', 'banned'\)/.test(once), "Only dismissed, warned, banned are allowed");
assert(/already_decided/.test(once), "The server must refuse a second decision on the same report");

// A31 (26/10/2026): il ban vale anche nel database e l'admin puo' revocarlo.
const enforce = read("supabase", "migrations", "20261026160000_a31_ban_enforcement_and_revoke.sql");
assert(/pgrst\.db_pre_request = 'public\.check_request'/.test(enforce), "Banned users must be blocked on every Data API write (pre-request)");
assert(/USER_BANNED/.test(enforce) && /rpc\/get_my_profile/.test(enforce), "Pre-request must block writes but keep get_my_profile for the banned screen");
assert(/as restrictive for insert to authenticated/.test(enforce), "Banned users must not upload to Storage");
assert(/admin_revoke_ban/.test(enforce) && /'UNBANNED'/.test(enforce), "Ban revocation must be audited");
assert(/adminNotificationService\.revokeBan\(/.test(detail) && /Alert\.alert\(/.test(detail), "Revoke ban must go through the service with an explicit confirmation");
assert(/rpc\('admin_revoke_ban'/.test(adminService), "revokeBan must call rpc admin_revoke_ban");

console.log("reports admin contract OK");
