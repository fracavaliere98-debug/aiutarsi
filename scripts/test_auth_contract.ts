/**
 * Contract test per context/authLogic.ts: validazione registrazione, pulizia storage al
 * logout/reset, referral da deep link, debounce dell'evento SIGNED_IN dopo login manuale,
 * e sincronizzazione Realtime dello stato ban/email del profilo. Comportamento invariato
 * rispetto a context/AuthContext.tsx, solo estratto per essere testabile senza Supabase/RN.
 *
 * Run: npx tsx scripts/test_auth_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAuthErrorTelemetryOptions,
  computeNextProfileRealtimeState,
  extractReferralCodeFromPath,
  getAuthStorageKeysToClear,
  hasRelevantProfileRealtimeChange,
  hasRequiredRegistrationFields,
  isEmailChangeConfirmedByRealtime,
  shouldSkipSignInEvent,
  type ProfileRealtimeFields,
} from "../context/authLogic";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

// ── hasRequiredRegistrationFields ──────────────────────────────────────────

function testRequiredRegistrationFields() {
  console.log("\n[auth] hasRequiredRegistrationFields");

  assert(hasRequiredRegistrationFields({ email: "a@b.it", password: "pw", full_name: "Mario Rossi" }), "email+password+full_name → ok");
  assert(hasRequiredRegistrationFields({ email: "a@b.it", password: "pw", name: "Mario Rossi" }), "email+password+name (fallback) → ok");
  pass("full_name o name (uno dei due) soddisfano il requisito, come nell'originale");

  assert(!hasRequiredRegistrationFields({ password: "pw", full_name: "Mario" }), "email mancante → false");
  assert(!hasRequiredRegistrationFields({ email: "a@b.it", full_name: "Mario" }), "password mancante → false");
  assert(!hasRequiredRegistrationFields({ email: "a@b.it", password: "pw" }), "né full_name né name → false");
  assert(!hasRequiredRegistrationFields({ email: "a@b.it", password: "pw", full_name: null }), "full_name null e name assente → false");
  pass("ogni campo obbligatorio mancante blocca la registrazione");
}

// ── getAuthStorageKeysToClear ───────────────────────────────────────────────

function testAuthStorageKeysToClear() {
  console.log("\n[auth] getAuthStorageKeysToClear");

  const keys = ["sb-abcxyz-auth-token", "auth_user", "some-app-setting", "@pending_referral_code", "sb-abcxyz-project-ref-thing"];

  const cleared = getAuthStorageKeysToClear(keys, "abcxyz");
  assert(cleared.includes("sb-abcxyz-auth-token"), "chiave contenente 'supabase'... in realtà verifichiamo il project ref sotto");
  assert(cleared.includes("auth_user"), "'auth_user' sempre incluso");
  assert(!cleared.includes("some-app-setting"), "chiavi non correlate all'auth restano intoccate");
  assert(!cleared.includes("@pending_referral_code"), "il referral code pendente NON viene cancellato al logout (non è una chiave auth)");
  pass("filtra solo le chiavi Supabase/project-ref/auth_user");

  const keysWithSupabaseWord = ["supabase.auth.token", "other"];
  const clearedNoRef = getAuthStorageKeysToClear(keysWithSupabaseWord, null);
  assert(clearedNoRef.includes("supabase.auth.token"), "chiave con 'supabase' nel nome viene pulita anche senza project ref");
  assert(!clearedNoRef.includes("other"), "chiavi generiche non toccate quando project ref è null");
  pass("funziona anche quando il project ref non è disponibile (nessun crash, nessuna sovra-cancellazione)");
}

// ── extractReferralCodeFromPath ─────────────────────────────────────────────

function testExtractReferralCode() {
  console.log("\n[auth] extractReferralCodeFromPath");

  assert(extractReferralCodeFromPath("referral/ABC123") === "ABC123", "path diretto → codice estratto");
  assert(extractReferralCodeFromPath("/referral/XYZ") === "XYZ", "path con slash iniziale → codice estratto");
  assert(extractReferralCodeFromPath(null) === null, "path null → nessun codice");
  assert(extractReferralCodeFromPath(undefined) === null, "path undefined → nessun codice");
  assert(extractReferralCodeFromPath("/onboarding/welcome") === null, "path senza 'referral/' → nessun codice");
  assert(extractReferralCodeFromPath("referral/") === null, "'referral/' senza codice dopo → null, non stringa vuota tronca");
  pass("estrazione codice referral coerente con l'handling storico dei deep link");
}

// ── shouldSkipSignInEvent ────────────────────────────────────────────────────

function testShouldSkipSignInEvent() {
  console.log("\n[auth] shouldSkipSignInEvent");

  const now = 1_000_000;
  assert(shouldSkipSignInEvent({ userId: "u1", at: now - 2000 }, "u1", now) === true, "stesso utente, login manuale <5s fa → skip (evita doppio processing)");
  assert(shouldSkipSignInEvent({ userId: "u1", at: now - 6000 }, "u1", now) === false, "stesso utente, ma login manuale >5s fa → non skip");
  assert(shouldSkipSignInEvent({ userId: "u1", at: now - 1000 }, "u2", now) === false, "utente diverso da quello loggato manualmente → non skip");
  assert(shouldSkipSignInEvent(null, "u1", now) === false, "nessun login manuale recente → non skip");
  assert(shouldSkipSignInEvent({ userId: "u1", at: now - 1000 }, undefined, now) === false, "sessione senza user id → non skip (nessun crash)");
  pass("debounce SIGNED_IN dopo login manuale coerente con la finestra storica di 5s");
}

// ── Realtime ban/email sync: computeNextProfileRealtimeState + hasRelevantProfileRealtimeChange ──

function baseFields(overrides: Partial<ProfileRealtimeFields> = {}): ProfileRealtimeFields {
  return {
    is_banned: false,
    ban_reason: null,
    ban_report_id: null,
    email: "user@example.it",
    email_confirmed: true,
    ...overrides,
  };
}

function testComputeNextProfileRealtimeState() {
  console.log("\n[auth] computeNextProfileRealtimeState");

  const prev = baseFields();
  const banned = computeNextProfileRealtimeState(prev, { is_banned: true, ban_reason: "spam", ban_report_id: "rep-1" });
  assert(banned.is_banned === true && banned.ban_reason === "spam" && banned.ban_report_id === "rep-1", "ban applicato dal payload");
  assert(banned.email === prev.email, "email invariata se il payload non la include");
  pass("stato ban calcolato correttamente dal payload Realtime");

  const emailChanged = computeNextProfileRealtimeState(prev, { email: "new@example.it" });
  assert(emailChanged.email === "new@example.it", "email aggiornata quando il payload la fornisce");

  const emailEmptyInPayload = computeNextProfileRealtimeState(prev, { email: "" });
  assert(emailEmptyInPayload.email === prev.email, "email vuota nel payload → mantiene l'email precedente (fallback ||, non sovrascrive con stringa vuota)");
  pass("email aggiornata solo se il payload ne fornisce una non vuota, altrimenti fallback su quella precedente");
}

function testHasRelevantProfileRealtimeChange() {
  console.log("\n[auth] hasRelevantProfileRealtimeChange");

  const prev = baseFields();
  assert(hasRelevantProfileRealtimeChange(prev, baseFields()) === false, "stato identico → nessun cambiamento rilevante (evita re-render inutili)");
  assert(hasRelevantProfileRealtimeChange(prev, baseFields({ is_banned: true })) === true, "cambio ban → rilevante");
  assert(hasRelevantProfileRealtimeChange(prev, baseFields({ ban_reason: "nuovo motivo" })) === true, "cambio motivo ban → rilevante");
  assert(hasRelevantProfileRealtimeChange(prev, baseFields({ email: "diverso@example.it" })) === true, "cambio email → rilevante");
  assert(hasRelevantProfileRealtimeChange(prev, baseFields({ email_confirmed: false })) === true, "cambio conferma email → rilevante");
  pass("ogni campo ban/email è controllato individualmente per decidere se applicare l'update");
}

// ── isEmailChangeConfirmedByRealtime ─────────────────────────────────────────

function testIsEmailChangeConfirmedByRealtime() {
  console.log("\n[auth] isEmailChangeConfirmedByRealtime");

  assert(isEmailChangeConfirmedByRealtime("New@Example.it", "new@example.it") === true, "match case-insensitive/trim → confermato");
  assert(isEmailChangeConfirmedByRealtime(" new@example.it ", "new@example.it") === true, "spazi attorno all'email pendente → confermato comunque");
  assert(isEmailChangeConfirmedByRealtime("new@example.it", "other@example.it") === false, "email diversa dal payload → non confermato");
  assert(isEmailChangeConfirmedByRealtime(null, "new@example.it") === false, "nessun cambio email in sospeso → non confermato");
  assert(isEmailChangeConfirmedByRealtime("new@example.it", null) === false, "payload senza email (non stringa) → non confermato, nessun crash");
  assert(isEmailChangeConfirmedByRealtime("new@example.it", 42) === false, "payload email non-stringa (tipo inatteso) → non confermato, nessun crash");
  pass("conferma cambio email robusta a case/spazi e a payload inattesi");
}

// ── buildAuthErrorTelemetryOptions ──────────────────────────────────────────

function testBuildAuthErrorTelemetryOptions() {
  console.log("\n[auth] buildAuthErrorTelemetryOptions");

  const expectedOpts = buildAuthErrorTelemetryOptions(true);
  assert(expectedOpts.priority === "low" && expectedOpts.classification === "expected_user" && expectedOpts.expected === true, "errore atteso → priority low, classification expected_user");

  const unexpectedOpts = buildAuthErrorTelemetryOptions(false);
  assert(unexpectedOpts.priority === "high" && unexpectedOpts.classification === "error_technical" && unexpectedOpts.expected === false, "errore non atteso → priority high, classification error_technical (mai silenziato)");
  pass("opzioni di telemetria coerenti con login/register (stessa logica, niente duplicazione divergente)");
}

// ── Wiring: AuthContext.tsx deve usare la logica condivisa, non reintrodurla inline ──

function testStructuralWiring() {
  console.log("\n[wiring] context/AuthContext.tsx riusa authLogic.ts");

  const source = readSource("context/AuthContext.tsx");

  for (const fn of [
    "hasRequiredRegistrationFields",
    "getAuthStorageKeysToClear",
    "extractReferralCodeFromPath",
    "shouldSkipSignInEvent",
    "computeNextProfileRealtimeState",
    "hasRelevantProfileRealtimeChange",
    "isEmailChangeConfirmedByRealtime",
    "buildAuthErrorTelemetryOptions",
  ]) {
    assert(source.includes(fn), `AuthContext.tsx deve usare ${fn} da authLogic.ts`);
  }
  pass("tutte le funzioni pure estratte sono effettivamente cablate in AuthContext.tsx");

  assert(
    !/user\.is_banned !== !!payload\.new\.is_banned/.test(source),
    "REGRESSIONE: il confronto ban inline non deve essere reintrodotto duplicato (unica fonte di verità: hasRelevantProfileRealtimeChange)"
  );
  pass("nessuna duplicazione della logica di confronto ban/email reintrodotta inline");
}

// ── Runner ────────────────────────────────────────────────────────────────

function run() {
  console.log("Auth context logic contract tests");
  console.log("─".repeat(60));

  testRequiredRegistrationFields();
  testAuthStorageKeysToClear();
  testExtractReferralCode();
  testShouldSkipSignInEvent();
  testComputeNextProfileRealtimeState();
  testHasRelevantProfileRealtimeChange();
  testIsEmailChangeConfirmedByRealtime();
  testBuildAuthErrorTelemetryOptions();
  testStructuralWiring();

  console.log("\n" + "─".repeat(60));
  console.log("All auth contract checks passed ✓");
}

run();
