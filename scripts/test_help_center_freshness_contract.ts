/**
 * Regression/contract test per un problema reale trovato il 2026-09-22: il
 * contesto FAQ passato a Gemma (supabase/functions/gemma-help-assistant)
 * viene da shared/helpCenterContent.ts, un file scritto a mano che NON è
 * collegato a nessuna fonte di documentazione live. L'ultima modifica prima
 * di allora era del 31 marzo 2026 — quasi 6 mesi senza revisione, mentre nel
 * frattempo sono cambiate cose come la conferma presenza/XP delle NPO
 * (migration del 21/09). Gemma dava quindi risposte vecchie o incomplete
 * senza che nessuno se ne accorgesse.
 *
 * Questo test non può giudicare SE il contenuto delle FAQ è ancora corretto
 * (serve una persona per quello), ma può far rispettare una regola meccanica
 * e verificabile: ogni volta che si aggiunge una migration Supabase,
 * HELP_CENTER_LAST_REVIEWED in shared/helpCenterContent.ts deve essere una
 * data pari o successiva alla più recente migration esistente nel repo.
 *
 * Se fallisce: apri shared/helpCenterContent.ts, valuta se la/le nuove
 * migration introducono un comportamento visibile all'utente che merita una
 * FAQ nuova o aggiornata (non sempre serve — una migration puramente tecnica
 * no), poi aggiorna comunque HELP_CENTER_LAST_REVIEWED alla data di oggi.
 *
 * Essendo dentro npm run test:regression, è parte della Definition of Done
 * del progetto (docs/README.md, sezione 6) — quindi questo controllo va
 * eseguito SEMPRE prima di considerare chiuso un lavoro, non solo quando ci
 * si ricorda.
 *
 * Run: npx tsx scripts/test_help_center_freshness_contract.ts
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { HELP_CENTER_LAST_REVIEWED } from "../shared/helpCenterContent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");

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

console.log("Help center freshness contract (2026-09-22)");
console.log("────────────────────────────────────────────────────────────\n");

assert(
  /^\d{4}-\d{2}-\d{2}$/.test(HELP_CENTER_LAST_REVIEWED),
  `HELP_CENTER_LAST_REVIEWED in shared/helpCenterContent.ts non è nel formato YYYY-MM-DD (trovato: "${HELP_CENTER_LAST_REVIEWED}")`,
);
pass("HELP_CENTER_LAST_REVIEWED è una data valida");

const latestMigration = latestMigrationDate();

assert(
  HELP_CENTER_LAST_REVIEWED >= latestMigration,
  `Le FAQ di shared/helpCenterContent.ts risultano NON revisionate da quando è stata aggiunta ` +
    `l'ultima migration Supabase.\n` +
    `    HELP_CENTER_LAST_REVIEWED = ${HELP_CENTER_LAST_REVIEWED}\n` +
    `    ultima migration trovata  = ${latestMigration}\n` +
    `  Apri shared/helpCenterContent.ts: valuta se la/le nuove migration cambiano qualcosa che ` +
    `un volontario o una NPO potrebbe chiedere a Gemma o cercare nell'Help Center, aggiorna le FAQ ` +
    `se serve, poi porta HELP_CENTER_LAST_REVIEWED alla data di oggi in ogni caso.`,
);
pass(`HELP_CENTER_LAST_REVIEWED (${HELP_CENTER_LAST_REVIEWED}) è pari o successiva all'ultima migration (${latestMigration})`);

console.log("\n────────────────────────────────────────────────────────────");
console.log("Help center freshness contract: PASS ✓");
