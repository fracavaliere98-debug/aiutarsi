/**
 * Contract test per utils/monitoringLogic.ts: decide come un errore viene classificato per
 * Sentry (severità/livello) e quali messaggi sono "attesi" (validazione utente) da non
 * trattare come bug applicativi — sbagliare qui vuol dire silenziare bug veri o inondare
 * Sentry di rumore da errori di validazione normali.
 *
 * Run: npx tsx scripts/test_monitoring_contract.ts
 */

import {
  EXPECTED_USER_ERROR_MATCHERS,
  getClassification,
  getClassificationLevel,
  getPriorityLevel,
  isExpectedUserInputError,
  normalizeErrorMessage,
  toError,
} from "../utils/monitoringLogic";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

// ── toError / normalizeErrorMessage ─────────────────────────────────────────

function testToError() {
  console.log("\n[monitoring] toError / normalizeErrorMessage");

  assert(toError(new Error("boom")).message === "boom", "Error instance passa invariato");
  assert(toError("plain string").message === "plain string", "stringa diventa Error con lo stesso messaggio");
  assert(toError({ code: 42 }).message === JSON.stringify({ code: 42 }), "oggetto non-Error viene serializzato in JSON");
  assert(normalizeErrorMessage("  spazi  ") === "spazi", "il messaggio viene trimmato");
  pass("normalizzazione errori coerente per Error/string/object");
}

// ── getPriorityLevel / getClassificationLevel ──────────────────────────────

function testPriorityLevels() {
  console.log("\n[monitoring] getPriorityLevel");

  assert(getPriorityLevel("critical") === "fatal", "critical → fatal");
  assert(getPriorityLevel("high") === "error", "high → error");
  assert(getPriorityLevel("normal") === "error", "normal → error");
  assert(getPriorityLevel("low") === "warning", "low → warning (mai silenzioso)");
  pass("mappatura priorità → livello Sentry invariata");
}

function testClassificationLevels() {
  console.log("\n[monitoring] getClassificationLevel");

  assert(getClassificationLevel("critical_crash") === "fatal", "critical_crash → fatal");
  assert(getClassificationLevel("error_technical") === "error", "error_technical → error");
  assert(getClassificationLevel("warning_functional") === "error", "warning_functional → error (visibile, non silenziato)");
  assert(getClassificationLevel("expected_user") === "warning", "expected_user → warning (non fatal)");
  pass("ogni classificazione ha un livello Sentry definito");
}

// ── getClassification: precedenza tra expected/classification/priority ────

function testClassificationPrecedence() {
  console.log("\n[monitoring] getClassification — precedenza");

  assert(getClassification({ expected: true, priority: "critical" }) === "expected_user", "expected:true vince sempre, anche su priority critical");
  pass("expected:true ha priorità assoluta (evita falsi allarmi critici su errori attesi)");

  assert(getClassification({ classification: "warning_functional", priority: "critical" }) === "warning_functional", "classification esplicita vince su priority quando expected non è settato");
  pass("classification esplicita ha priorità su priority quando non c'è override 'expected'");

  assert(getClassification({ priority: "critical" }) === "critical_crash", "priority:critical senza altro → critical_crash");
  assert(getClassification({ priority: "high" }) === "error_technical", "priority:high → error_technical");
  assert(getClassification({ priority: "normal" }) === "warning_functional", "priority:normal → warning_functional");
  assert(getClassification({ priority: "low" }) === "expected_user", "priority:low → expected_user");
  assert(getClassification(undefined) === "error_technical", "nessuna opzione → default error_technical (mai silenzioso di default)");
  assert(getClassification({}) === "error_technical", "options vuoto (nessuna priority) → default error_technical");
  pass("fallback su priority coerente, default prudente (error_technical) quando non specificato");
}

// ── isExpectedUserInputError ────────────────────────────────────────────────

function testExpectedUserInputError() {
  console.log("\n[monitoring] isExpectedUserInputError");

  assert(EXPECTED_USER_ERROR_MATCHERS.length > 0, "la lista matcher non deve essere vuota");

  for (const matcher of EXPECTED_USER_ERROR_MATCHERS) {
    assert(isExpectedUserInputError(new Error(matcher)) === true, `matcher riconosciuto: "${matcher}"`);
  }
  pass(`tutti i ${EXPECTED_USER_ERROR_MATCHERS.length} matcher noti vengono riconosciuti come errori attesi`);

  assert(isExpectedUserInputError(new Error("CREDENZIALI ERRATE")) === true, "il match è case-insensitive");
  pass("case-insensitive: non perde match per maiuscole/minuscole");

  assert(
    isExpectedUserInputError(new Error("Errore imprevisto: qualcosa è andato storto nel server")) === false,
    "un errore tecnico generico non deve essere classificato come atteso"
  );
  assert(
    isExpectedUserInputError(new Error("Cannot read properties of undefined (reading 'map')")) === false,
    "REGRESSIONE: un crash da bug (TypeError-like) non deve mai finire silenziato come 'atteso'"
  );
  pass("errori tecnici/crash reali non vengono mai classificati come attesi (nessun falso negativo su bug)");

  assert(isExpectedUserInputError("compila tutti i campi obbligatori prima di continuare") === true, "match parziale (substring) funziona anche su stringhe pure, non solo Error");
  pass("accetta anche input non-Error (string) grazie a toError");
}

// ── Runner ────────────────────────────────────────────────────────────────

function run() {
  console.log("Monitoring/telemetry classification contract tests");
  console.log("─".repeat(60));

  testToError();
  testPriorityLevels();
  testClassificationLevels();
  testClassificationPrecedence();
  testExpectedUserInputError();

  console.log("\n" + "─".repeat(60));
  console.log("All monitoring contract checks passed ✓");
}

run();
