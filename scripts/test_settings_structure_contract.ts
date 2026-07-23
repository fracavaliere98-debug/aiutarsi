/**
 * Regression/contract test per il refactor settings del 2026-07-23:
 *  - NPO: canonicalizzato su app/(npo)/settings/{index,edit-profile,security,privacy}.tsx
 *    (rimossi i duplicati orfani app/(npo)/edit-profile.tsx e app/(npo)/security.tsx,
 *    lasciati da una migrazione precedente mai completata — vedi scripts/verify_npo_structure.ts,
 *    anch'esso rimosso perché documentava il tentativo inverso e mai finito)
 *  - Volontario: app/(volunteer)/settings.tsx (un file da 900 righe con Modal inline) sostituito
 *    da app/(volunteer)/settings/{index,edit-profile,security,privacy}.tsx, stesso pattern di
 *    navigazione a sotto-schermate già usato da NPO (niente più Modal)
 *  - Rimossa la sezione "Opzioni Sviluppatore" / "Resetta Dati App (Debug)", visibile senza
 *    alcun gate __DEV__ a ogni utente volontario reale in produzione
 *
 * Sono controlli statici sul codice sorgente (no Metro, no rendering React Native), stesso
 * approccio già usato da test_activity_form_contract.ts in questo repo.
 *
 * Run: npx tsx scripts/test_settings_structure_contract.ts
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function fileExists(relativePath: string): boolean {
  return existsSync(join(REPO_ROOT, relativePath));
}

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function listSourceFiles(dir: string): string[] {
  const absDir = join(REPO_ROOT, dir);
  let files: string[] = [];
  for (const entry of readdirSync(absDir)) {
    const relPath = join(dir, entry);
    const absPath = join(REPO_ROOT, relPath);
    if (statSync(absPath).isDirectory()) {
      files = files.concat(listSourceFiles(relPath));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      files.push(relPath);
    }
  }
  return files;
}

// ── NPO: settings/ è l'unica posizione canonica ─────────────────────────────

function testNpoSettingsStructure() {
  console.log("\n[NPO] settings/ è l'unica posizione canonica per edit-profile/security/privacy");

  for (const path of [
    "app/(npo)/settings/index.tsx",
    "app/(npo)/settings/edit-profile.tsx",
    "app/(npo)/settings/security.tsx",
    "app/(npo)/settings/privacy.tsx",
  ]) {
    assert(fileExists(path), `${path} deve esistere`);
  }
  pass("le 4 schermate canoniche di settings NPO esistono");

  for (const path of ["app/(npo)/edit-profile.tsx", "app/(npo)/security.tsx"]) {
    assert(!fileExists(path), `REGRESSIONE: ${path} è un duplicato morto, non deve tornare ad esistere al top level`);
  }
  pass("nessun duplicato edit-profile.tsx/security.tsx al top level di app/(npo)/");

  const editProfile = readSource("app/(npo)/settings/edit-profile.tsx");
  assert(editProfile.includes("npo_vat_id: vatId"), "settings/edit-profile.tsx deve salvare npo_vat_id (fix 2026-07-21)");
  assert(
    editProfile.includes("user?.public_email || user?.publicEmail"),
    "settings/edit-profile.tsx deve precompilare da public_email con fallback (fix 2026-07-21)"
  );
  assert(
    editProfile.includes("user?.address_full || user?.locationString"),
    "settings/edit-profile.tsx deve precompilare da address_full con fallback (fix 2026-07-21)"
  );
  pass("settings/edit-profile.tsx mantiene i fix di mappatura campi del 2026-07-21");

  const layout = readSource("app/(npo)/_layout.tsx");
  assert(
    layout.includes('name="settings/edit-profile"'),
    "_layout.tsx deve dichiarare settings/edit-profile per mantenere la transizione modale"
  );
  assert(!layout.includes('name="edit-profile"'), "REGRESSIONE: _layout.tsx non deve più referenziare la route top-level edit-profile rimossa");
  assert(!layout.includes('name="security"'), "REGRESSIONE: _layout.tsx non deve più referenziare la route top-level security rimossa");
  pass("_layout.tsx punta a settings/edit-profile, non alle route top-level rimosse");
}

function testNoDanglingNpoReferences() {
  console.log("\n[NPO] nessun riferimento vivo alle route rimosse");

  const filesToCheck = [
    "app/(npo)/settings/index.tsx",
    "app/(npo)/(tabs)/profile.tsx",
    "hooks/notifications/useNotificationsDomain.ts",
  ];

  for (const path of filesToCheck) {
    const source = readSource(path);
    assert(!source.includes('"/(npo)/edit-profile"'), `REGRESSIONE: ${path} referenzia ancora "/(npo)/edit-profile"`);
    assert(!source.includes('"/(npo)/security"'), `REGRESSIONE: ${path} referenzia ancora "/(npo)/security"`);
  }
  pass("settings/index.tsx, (tabs)/profile.tsx e QUIET_ROUTES puntano tutti a settings/edit-profile");
}

// ── Volontario: settings/ rispecchia il pattern NPO ─────────────────────────

function testVolunteerSettingsStructure() {
  console.log("\n[Volontario] settings/ rispecchia il pattern a sotto-schermate di NPO");

  for (const path of [
    "app/(volunteer)/settings/index.tsx",
    "app/(volunteer)/settings/edit-profile.tsx",
    "app/(volunteer)/settings/security.tsx",
    "app/(volunteer)/settings/privacy.tsx",
  ]) {
    assert(fileExists(path), `${path} deve esistere`);
  }
  pass("le 4 schermate canoniche di settings volontario esistono");

  for (const path of ["app/(volunteer)/settings.tsx", "app/(volunteer)/privacy.tsx"]) {
    assert(!fileExists(path), `REGRESSIONE: ${path} (il vecchio monolite/route top-level) non deve tornare ad esistere`);
  }
  pass("il vecchio app/(volunteer)/settings.tsx e app/(volunteer)/privacy.tsx non esistono più");

  const index = readSource("app/(volunteer)/settings/index.tsx");
  assert(!/<Modal\b/.test(index), "REGRESSIONE: settings/index.tsx non deve più renderizzare <Modal> (niente più modali inline)");
  assert(index.includes('"/(volunteer)/settings/edit-profile"'), "settings/index.tsx deve linkare a settings/edit-profile");
  assert(index.includes('"/(volunteer)/settings/security"'), "settings/index.tsx deve linkare a settings/security");
  assert(index.includes('"/(volunteer)/settings/privacy"'), "settings/index.tsx deve linkare a settings/privacy");
  pass("settings/index.tsx naviga verso sotto-schermate a schermo intero, non modali");

  const layout = readSource("app/(volunteer)/_layout.tsx");
  assert(
    layout.includes('name="settings/edit-profile"'),
    "_layout.tsx (volontario) deve dichiarare settings/edit-profile per la transizione modale"
  );
  assert(!layout.includes('name="privacy"'), "REGRESSIONE: _layout.tsx non deve più referenziare la route top-level privacy rimossa");
  pass("_layout.tsx (volontario) punta a settings/edit-profile, non alla route privacy top-level rimossa");
}

function testDebugSectionRemoved() {
  console.log('\n[Volontario] sezione debug "Opzioni Sviluppatore" rimossa');

  for (const path of [
    "app/(volunteer)/settings/index.tsx",
    "app/(volunteer)/settings/edit-profile.tsx",
    "app/(volunteer)/settings/security.tsx",
    "app/(volunteer)/settings/privacy.tsx",
  ]) {
    const source = readSource(path);
    assert(!source.includes("Opzioni Sviluppatore"), `REGRESSIONE: ${path} contiene di nuovo "Opzioni Sviluppatore"`);
    assert(!source.includes("Resetta Dati App"), `REGRESSIONE: ${path} contiene di nuovo il bottone "Resetta Dati App"`);
    assert(!source.includes("resetUsers"), `REGRESSIONE: ${path} chiama di nuovo resetUsers()`);
    assert(!source.includes("useResetApplicationsQueryState"), `REGRESSIONE: ${path} chiama di nuovo useResetApplicationsQueryState()`);
  }
  pass('nessuna traccia di "Opzioni Sviluppatore" / resetUsers() sotto app/(volunteer)/settings/');
}

function testNoLiveDebugResetCallsAnywhere() {
  console.log("\n[Repo] resetUsers()/useResetApplicationsQueryState non sono chiamati da nessuna schermata viva");

  const appFiles = listSourceFiles("app");
  const offenders = appFiles.filter((path) => {
    const source = readSource(path);
    return source.includes("resetUsers()") || source.includes("useResetApplicationsQueryState(");
  });

  assert(
    offenders.length === 0,
    `REGRESSIONE: resetUsers()/useResetApplicationsQueryState ancora chiamati da: ${offenders.join(", ")}`
  );
  pass("nessuna schermata sotto app/ chiama resetUsers() o useResetApplicationsQueryState()");
}

function testAbandonedVerificationScriptRemoved() {
  console.log("\n[Repo] lo script di verifica abbandonato non è tornato");
  assert(
    !fileExists("scripts/verify_npo_structure.ts"),
    "REGRESSIONE: scripts/verify_npo_structure.ts documentava una migrazione abbandonata e opposta a quella corrente — non deve tornare"
  );
  pass("scripts/verify_npo_structure.ts non esiste");
}

// ── Runner ───────────────────────────────────────────────────────────────

function run() {
  console.log("Settings structure contract tests (NPO + Volontario, 2026-07-23)");
  console.log("─".repeat(60));

  testNpoSettingsStructure();
  testNoDanglingNpoReferences();
  testVolunteerSettingsStructure();
  testDebugSectionRemoved();
  testNoLiveDebugResetCallsAnywhere();
  testAbandonedVerificationScriptRemoved();

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sulla struttura settings sono passati ✓");
}

run();
