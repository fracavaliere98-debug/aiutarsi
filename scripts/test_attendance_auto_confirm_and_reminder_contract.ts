/**
 * Contract test per la migration 20260922100000_attendance_auto_confirm_and_reminder.sql
 * (auto-conferma presenza dopo 72h + confirmed_by npo/auto + reminder
 * volontario -> NPO). Nessuna copertura esisteva prima: il contract test
 * esistente (test_attendance_confirmation_contract.ts) riguarda solo la
 * migration precedente (20260921150000), non questa logica.
 *
 * Come gli altri contract test del repo, verifica staticamente il testo SQL
 * e il client, non lo stato reale del DB (per quello: mcp__Supabase__get_advisors
 * dopo ogni apply_migration, come da guida MCP Supabase).
 *
 * Run: npx tsx scripts/test_attendance_auto_confirm_and_reminder_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function pass(label: string) {
  console.log(`  ✓ ${label}`);
}
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

console.log("Attendance auto-confirm (72h) + reminder contract (2026-09-22)");
console.log("────────────────────────────────────────────────────────────\n");

const sql = read("supabase", "migrations", "20260922100000_attendance_auto_confirm_and_reminder.sql");

// 1) Colonna confirmed_by con default 'npo' e check su npo/auto.
assert(
  /add column if not exists confirmed_by text not null default 'npo'/.test(sql),
  "confirmed_by deve avere default 'npo' (le conferme reali della NPO restano invariate senza toccare il client)"
);
assert(
  /check \(confirmed_by in \('npo', 'auto'\)\)/.test(sql),
  "confirmed_by deve essere vincolata a soli 'npo'/'auto'"
);
pass("colonna confirmed_by: default 'npo', check su ('npo','auto')");

// 2) La guardia deve forzare 'npo' a meno che il flag di sessione del cron non sia attivo:
//    nessun client (incluso uno malevolo) deve poter scrivere 'auto' direttamente.
assert(
  /new\.confirmed_by = 'auto' and coalesce\(current_setting\('app\.attendance_auto_confirm', true\), ''\) = 'on'/.test(sql),
  "guard_volunteer_review_attendance deve concedere 'auto' SOLO se il GUC di sessione app.attendance_auto_confirm è 'on'"
);
assert(
  /new\.confirmed_by := 'npo';/.test(sql),
  "guard_volunteer_review_attendance deve avere un else esplicito che forza 'npo'"
);
pass("guard_volunteer_review_attendance: 'auto' scrivibile solo con il GUC di sessione attivo");

// 3) L'auto-conferma non deve MAI sovrascrivere una riga già esistente (in particolare
//    un volontario segnato assente dalla NPO: is_present = false).
assert(
  /not exists \(\s*select 1 from public\.volunteer_reviews vr\s*where vr\.activity_id = a\.id and vr\.volunteer_id = ap\.user_id\s*\)/.test(sql),
  "auto_confirm_stale_attendance deve selezionare solo partecipanti SENZA nessuna riga volunteer_reviews esistente"
);
assert(/date_end < now\(\) - interval '72 hours'/.test(sql), "la soglia deve essere 72 ore da date_end");
assert(/on conflict \(activity_id, npo_id, volunteer_id\) do nothing/.test(sql), "l'insert deve essere no-op su conflitto (difesa aggiuntiva)");
pass("auto_confirm_stale_attendance: mai sovrascrive una riga esistente, soglia 72h da date_end");

// 4) Grant/revoke: la funzione di cron NON deve essere chiamabile da client.
assert(
  /revoke all on function public\.auto_confirm_stale_attendance\(\) from public, anon, authenticated;/.test(sql),
  "auto_confirm_stale_attendance deve essere revocata a public/anon/authenticated"
);
assert(
  /grant execute on function public\.auto_confirm_stale_attendance\(\) to postgres, service_role;/.test(sql),
  "auto_confirm_stale_attendance deve essere eseguibile solo da postgres/service_role"
);
assert(/cron\.schedule\(\s*'auto-confirm-stale-attendance-hourly'/.test(sql), "il cron deve essere registrato con questo nome");
pass("auto_confirm_stale_attendance: non eseguibile da client, schedulata via cron.schedule");

// 5) La RPC di reminder è invece pensata per il volontario autenticato, non per anon.
assert(
  /revoke all on function public\.request_attendance_confirmation_reminder\(uuid\) from public, anon;/.test(sql),
  "request_attendance_confirmation_reminder deve essere revocata a public/anon"
);
assert(
  /grant execute on function public\.request_attendance_confirmation_reminder\(uuid\) to authenticated;/.test(sql),
  "request_attendance_confirmation_reminder deve essere eseguibile da authenticated"
);
assert(/interval '24 hours'/.test(sql), "il cooldown del reminder deve essere di 24h");
for (const code of ["'sent'", "'already_sent_recently'", "'not_a_participant'", "'already_confirmed'", "'activity_not_completed'"]) {
  assert(sql.includes(`return ${code}`), `la RPC deve poter ritornare ${code}`);
}
pass("request_attendance_confirmation_reminder: solo authenticated, cooldown 24h, tutti i codici di esito presenti");

// 6) Client: il service layer chiama la RPC con il nome esatto, e la schermata attività
//    gestisce tutti i codici di esito con showToast (mai Alert.alert, per la convenzione
//    feedback UI del progetto).
const service = read("services", "ActivityService.ts");
assert(
  service.includes("supabase.rpc('request_attendance_confirmation_reminder'"),
  "ActivityService deve avere un metodo che chiama la RPC via _withTimeout"
);
pass("ActivityService.requestAttendanceConfirmationReminder() presente");

const screen = read("app", "activity", "[id].tsx");
for (const code of ["'sent'", "'already_sent_recently'", "'already_confirmed'", "'not_a_participant'", "'activity_not_completed'"]) {
  assert(screen.includes(code), `app/activity/[id].tsx deve gestire l'esito ${code} della RPC`);
}
assert(screen.includes("showToast"), "l'esito della CTA reminder deve passare da showToast, non da Alert.alert");
assert(!/Alert\.alert.*In attesa conferma|In attesa conferma[\s\S]{0,400}Alert\.alert/.test(screen), "il box 'In attesa conferma' non deve usare Alert.alert");
pass("app/activity/[id].tsx: tutti gli esiti della RPC mappati, feedback via showToast");

// 7) Badge visibile (verde/grigio) sulla card condivisa, non sul componente morto.
const card = read("components", "ActivityCard.tsx");
assert(card.includes("confirmedBy"), "ActivityCard deve leggere confirmedBy da volunteer_reviews per decidere il colore del badge");
assert(card.includes("ThumbsUp"), "ActivityCard deve mostrare un'icona thumb-up per la presenza confermata");
pass("components/ActivityCard.tsx: badge conferma presenza basato su confirmedBy");

console.log("\n────────────────────────────────────────────────────────────");
console.log("Attendance auto-confirm + reminder contract: PASS ✓");
