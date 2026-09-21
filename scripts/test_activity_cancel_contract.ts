import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const service = readRepoFile("services", "ActivityService.ts");
const hooks = readRepoFile("hooks", "activities", "mutations.ts");
const editScreen = readRepoFile("app", "(npo)", "edit-activity", "[id].tsx");
const form = readRepoFile("components", "npo", "ActivityForm.tsx");
const detail = readRepoFile("app", "activity", "[id].tsx");
const projects = readRepoFile("app", "(npo)", "(tabs)", "projects.tsx");

// 1. Nessun percorso di eliminazione fisica delle attività lato app.
assert(!/deleteActivity/.test(service + hooks + editScreen), "deleteActivity non deve tornare: le attività si annullano, non si eliminano");
assert(!/\.from\('activities'\)\s*\.delete\(/.test(service), "Nessun DELETE fisico su activities dal service");
assert(!/Elimina/.test(editScreen + form), "Nessuna azione 'Elimina' nel flusso attività: solo 'Annulla attività'");

// 2. cancelActivity: soft cancel condizionato allo stato (la notifica agli iscritti è generata dal trigger DB, vedi punto 7).
const cancelBody = service.slice(service.indexOf("async cancelActivity("), service.indexOf("async joinActivity("));
assert(/status: 'CANCELLATA'/.test(cancelBody), "cancelActivity deve impostare status CANCELLATA");
assert(/\.in\('status', \['APERTA', 'IN_CORSO'\]\)/.test(cancelBody), "L'update deve essere condizionato a APERTA/IN_CORSO (idempotenza, niente doppie notifiche)");
assert(/ACTIVITY_NOT_CANCELLABLE/.test(cancelBody), "Se nessuna riga è aggiornata deve fallire esplicitamente, non notificare");
assert(!/from\('notifications'\)/.test(service), "ActivityService non deve inserire notifiche dal client (generate dal trigger DB)");

// 3. UI ente: azione visibile solo su attività annullabili, storico 'Annullate', edit bloccato.
assert(/isCancellable/.test(editScreen) && /onCancelActivity=\{isCancellable/.test(editScreen), "L'azione di annullo deve comparire solo se APERTA/IN_CORSO");
assert(/activity\.status === "CANCELLATA"/.test(editScreen), "Un'attività annullata non deve poter essere modificata");
assert(/"annullate"/.test(projects) && /p\.status === "CANCELLATA"/.test(projects), "L'ente deve poter vedere le attività annullate nello storico");

// 4. UI volontario: attività annullata visibile, ma non iscrivibile.
assert(/CANCELLATA: \{ label: 'Cancellata'/.test(detail), "Badge 'Cancellata' sulla scheda");
assert(/isClosed = activity\?\.status === 'COMPLETATA' \|\| activity\?\.status === 'CANCELLATA'/.test(detail), "Iscrizione bloccata anche per CANCELLATA");

// 5. DB: nessuna policy DELETE su activities dopo la migration di hardening.
const migrations = readdirSync(join(process.cwd(), "supabase", "migrations")).sort();
const hardening = migrations.find((f) => f.endsWith("_activities_no_hard_delete.sql"));
assert(hardening && existsSync(join(process.cwd(), "supabase", "migrations", hardening)), "Migration activities_no_hard_delete mancante");
const sql = readRepoFile("supabase", "migrations", hardening);
assert(/DROP POLICY IF EXISTS "NPOs can manage own activities"/.test(sql), "Deve rimuovere la policy FOR ALL");
assert(!/FOR DELETE|FOR ALL/i.test(sql.replace(/--.*$/gm, "")), "La migration non deve creare policy DELETE/ALL su activities");

// 6) Blocco DB dell'iscrizione ad attività annullate + notifica all'ente su iscrizione/ritiro.
const guard = migrations.find((f) => f.endsWith("_participation_guard_and_npo_notifications.sql"));
assert(guard, "Migration participation_guard_and_npo_notifications mancante");
const guardSql = readRepoFile("supabase", "migrations", guard);
assert(/before insert or update of status on public\.activity_participants/i.test(guardSql), "Il blocco deve scattare BEFORE INSERT/UPDATE OF status (copre anche l'upsert merge-duplicates)");
assert(/raise exception 'ACTIVITY_CANCELLED'/.test(guardSql), "Il blocco deve sollevare ACTIVITY_CANCELLED");
assert(/auth\.uid\(\) is distinct from v_row\.user_id/.test(guardSql), "La notifica deve partire solo per azioni del volontario stesso (no service role / cascade)");
assert(/interval '10 minutes'/.test(guardSql), "Deve esserci una dedup anti-spam sulle notifiche all'ente");
assert(/'VOLUNTEER_ENROLLED'/.test(guardSql) && /'VOLUNTEER_WITHDRAWN'/.test(guardSql), "Tipi notifica iscrizione/ritiro");
assert(/revoke all on function public\.notify_npo_on_participation_change\(\)/i.test(guardSql) && /revoke all on function public\.block_join_cancelled_activity\(\)/i.test(guardSql), "Le funzioni trigger non devono essere invocabili via RPC");

const reviewApplication = readRepoFile("app", "(volunteer)", "review-application.tsx");
assert(/ACTIVITY_CANCELLED/.test(reviewApplication), "review-application deve gestire l'errore ACTIVITY_CANCELLED con un messaggio chiaro");
const mappers = readRepoFile("hooks", "notifications", "mappers.ts");
const resolver = readRepoFile("hooks", "notifications", "routeResolver.ts");
assert(/"VOLUNTEER_WITHDRAWN"/.test(mappers) && /case "VOLUNTEER_WITHDRAWN"/.test(resolver), "VOLUNTEER_WITHDRAWN deve essere un tipo noto con routing esplicito");

// 7) Notifiche generate lato server: nessun INSERT client, policy INSERT rimossa.
const ns = migrations.find((f) => f.endsWith("_notifications_server_side.sql"));
assert(ns, "Migration notifications_server_side mancante");
const nsSql = readRepoFile("supabase", "migrations", ns);
assert(/drop policy[^;]*"System\/Trigger insert"/i.test(nsSql), "Deve rimuovere la policy INSERT permissiva su notifications");
assert(/revoke insert on public\.notifications from anon, authenticated/i.test(nsSql), "Deve revocare INSERT su notifications a anon/authenticated");
assert(/create or replace function public\.send_npo_invite\(/i.test(nsSql) && /create or replace function public\.admin_send_notification\(/i.test(nsSql), "RPC send_npo_invite e admin_send_notification");
assert(/notify_participants_on_activity_change/.test(nsSql) && /notify_on_application_change/.test(nsSql), "Trigger per attività e candidature");
const clientFiles = ["services", "hooks", "app", "components", "context", "utils"];

const offenders = execSync(`grep -rlE "from\\(['\\"]notifications['\\"]\\)\\s*\\.insert" ${clientFiles.join(" ")} || true`, { cwd: process.cwd() }).toString().trim();
assert(!offenders, `INSERT client su notifications non ammesso: ${offenders}`);
assert(/send_npo_invite/.test(readRepoFile("services", "NPOService.ts")), "NPOService.sendInvite deve usare la RPC");
assert(/admin_send_notification/.test(readRepoFile("services", "AdminNotificationService.ts")), "AdminNotificationService deve usare la RPC");

console.log("PASS activity cancel contract: annullo soft, storico visibile, nessuna eliminazione fisica");
