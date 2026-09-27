/**
 * Regression/contract test per un problema reale trovato il 2026-09-22: il
 * contesto FAQ passato a Gemma (supabase/functions/gemma-help-assistant)
 * viene da shared/helpCenterContent.ts, un file scritto a mano che NON è
 * collegato a nessuna fonte di documentazione live. L'ultima modifica prima
 * di allora era del 31 marzo 2026 — quasi 6 mesi senza revisione, mentre nel
 * frattempo erano cambiate cose come la conferma presenza/XP delle NPO
 * (migration del 21/09). Gemma dava quindi risposte vecchie o incomplete
 * senza che nessuno se ne accorgesse.
 *
 * Esteso il 2026-09-27 su richiesta esplicita: legare la revisione solo alle
 * migration Supabase lasciava scoperto tutto il resto — un cambio di
 * comportamento/flusso/copy in app/, components/ o shared/ senza una
 * migration (il caso più comune) non faceva scattare nulla. La regola ora
 * è: HELP_CENTER_LAST_REVIEWED deve essere pari o successiva alla PIÙ
 * RECENTE tra (a) l'ultima migration Supabase e (b) l'ultimo cambiamento —
 * committato o ancora nel working tree — sotto app/, components/ o shared/
 * (esclusi questo script e lo stesso helpCenterContent.ts, altrimenti il
 * solo bump della data si ritriggerebbe da solo).
 *
 * Questo test non può giudicare SE il contenuto delle FAQ è ancora corretto
 * (serve una persona per quello), ma può far rispettare una regola meccanica
 * e verificabile, ora su entrambi i trigger.
 *
 * Se fallisce: apri shared/helpCenterContent.ts, valuta se il cambiamento
 * (migration e/o modifica app) introduce un comportamento visibile
 * all'utente che merita una FAQ nuova o aggiornata (non sempre serve — una
 * migration puramente tecnica o un refactor interno no), poi aggiorna
 * comunque HELP_CENTER_LAST_REVIEWED alla data di oggi.
 *
 * Essendo dentro npm run test:regression, è parte della Definition of Done
 * del progetto (docs/README.md, sezione 6) — quindi questo controllo va
 * eseguito SEMPRE prima di considerare chiuso un lavoro, non solo quando ci
 * si ricorda.
 *
 * Run: npx tsx scripts/test_help_center_freshness_contract.ts
 */

import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { HELP_CENTER_LAST_REVIEWED } from "../shared/helpCenterContent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");

// Percorsi che, se cambiati, valgono come "cambiamento in app" — l'intera
// superficie client-facing più il codice condiviso con le edge function.
// Esclusi da questi stessi percorsi: questo script e helpCenterContent.ts,
// così il solo bump della data non ritrigghera se stesso all'infinito
// (innocuo comunque, ma il messaggio d'errore sarebbe fuorviante).
const APP_CHANGE_PATHS = ["app", "components", "shared"];
const SELF_EXCLUDE = [
  "shared/helpCenterContent.ts",
  "scripts/test_help_center_freshness_contract.ts",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  } catch {
    return "";
  }
}

// Le migration sono nominate YYYYMMDDHHMMSS_descrizione.sql: il prefisso
// numerico ordina cronologicamente senza bisogno di leggere il contenuto.
const MIGRATION_PREFIX = /^(\d{14})_/;

function latestMigrationDate(): string {
  const files = readdirSync(MIGRATIONS_DIR);
  let latest = "00000000000000";

  for (const file of files) {
    const match = file.match(MIGRATION_PREFIX);
    if (!match) continue;
    if (match[1] > latest) latest = match[1];
  }

  assert(latest !== "00000000000000", "nessuna migration trovata in supabase/migrations — controlla il path");

  // YYYYMMDD dalle prime 8 cifre, per confrontarla con HELP_CENTER_LAST_REVIEWED (YYYY-MM-DD).
  return `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}`;
}

// Data dell'ultimo commit che tocca app/, components/ o shared/ (esclusi i
// due file in SELF_EXCLUDE). "0000-00-00" se non trova nulla (repo nuovo o
// path non ancora esistenti) — in quel caso questo trigger non blocca nulla.
function latestCommittedAppChangeDate(): string {
  const log = git([
    "log",
    "-1",
    "--format=%ad",
    "--date=short",
    "--",
    ...APP_CHANGE_PATHS,
  ]).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(log) ? log : "0000-00-00";
}

// True se ci sono modifiche non ancora committate (staged, unstaged o
// untracked) sotto app/, components/ o shared/, esclusi i due file in
// SELF_EXCLUDE — in quel caso il "cambiamento in app" è di oggi, anche se
// non ancora committato: la Definition of Done va rispettata prima del
// commit, non dopo.
function hasUncommittedAppChanges(): boolean {
  const status = git(["status", "--porcelain", "--", ...APP_CHANGE_PATHS]);
  if (!status.trim()) return false;

  const excluded = new Set(SELF_EXCLUDE);
  return status
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => {
      // Formato "XY path" o "XY path -> newPath" per i rename.
      const path = line.slice(3).split(" -> ").pop() ?? "";
      const rel = relative(REPO_ROOT, join(REPO_ROOT, path)).replace(/\\/g, "/");
      return !excluded.has(rel);
    });
}

function latestAppChangeDate(): string {
  const committed = latestCommittedAppChangeDate();
  return hasUncommittedAppChanges() ? (committed > todayIso() ? committed : todayIso()) : committed;
}

console.log("Help center freshness contract (2026-09-22, esteso 2026-09-27)");
console.log("────────────────────────────────────────────────────────────\n");

assert(
  /^\d{4}-\d{2}-\d{2}$/.test(HELP_CENTER_LAST_REVIEWED),
  `HELP_CENTER_LAST_REVIEWED in shared/helpCenterContent.ts non è nel formato YYYY-MM-DD (trovato: "${HELP_CENTER_LAST_REVIEWED}")`,
);
pass("HELP_CENTER_LAST_REVIEWED è una data valida");

const migrationDate = latestMigrationDate();
const appChangeDate = latestAppChangeDate();
const requiredDate = migrationDate > appChangeDate ? migrationDate : appChangeDate;
const trigger = migrationDate > appChangeDate ? "una migration Supabase" : "un cambiamento in app/, components/ o shared/";

assert(
  HELP_CENTER_LAST_REVIEWED >= requiredDate,
  `Le FAQ di shared/helpCenterContent.ts risultano NON revisionate da quando è stato introdotto ` +
    `${trigger}.\n` +
    `    HELP_CENTER_LAST_REVIEWED    = ${HELP_CENTER_LAST_REVIEWED}\n` +
    `    ultima migration trovata     = ${migrationDate}\n` +
    `    ultimo cambiamento app trovato = ${appChangeDate}\n` +
    `  Apri shared/helpCenterContent.ts: valuta se il cambiamento più recente introduce qualcosa ` +
    `che un volontario o una NPO potrebbe chiedere a Gemma o cercare nell'Help Center, aggiorna le ` +
    `FAQ se serve, poi porta HELP_CENTER_LAST_REVIEWED alla data di oggi in ogni caso.`,
);
pass(`HELP_CENTER_LAST_REVIEWED (${HELP_CENTER_LAST_REVIEWED}) è pari o successiva sia all'ultima migration (${migrationDate}) sia all'ultimo cambiamento app (${appChangeDate})`);

console.log("\n────────────────────────────────────────────────────────────");
console.log("Help center freshness contract: PASS ✓");
