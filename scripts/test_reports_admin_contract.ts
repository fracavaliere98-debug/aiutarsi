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

console.log("reports admin contract OK");
