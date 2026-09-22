/**
 * Contract test per la strumentazione dei timeout auth (2026-09-22).
 *
 * Contesto: l'utente ha segnalato una raffica di errori "auth.getSession timed out or failed"
 * e "profiles.getUsers timeout after 8000ms" osservati su device. Investigando, i due punti in
 * services/AuthService.ts che sollevano questi errori (getCurrentUser() sul timeout di
 * getSession(), getUsers() sul timeout della query profiles) finivano SOLO in console.error,
 * senza mai chiamare trackError()/Sentry — quindi nessun modo di sapere quanto spesso accade
 * realmente né di confrontare "prima vs dopo" un cambio (es. la migrazione Expo SDK 57 fatta
 * lo stesso giorno). Non è stato introdotto un fix del bug di fondo (il lock di rinnovo
 * sessione del client supabase-js può restare bloccato indefinitamente, comportamento noto e
 * già gestito con withTimeout) — solo visibilità, in modo che la prossima occorrenza produca
 * un evento Sentry reale invece di un log incollato a mano.
 *
 * Questo test è puramente statico (nessun mock di supabase/Sentry): verifica che entrambi i
 * punti continuino a chiamare trackError con un issueName/fingerprint stabile, così un futuro
 * refactor non rimuova silenziosamente la strumentazione.
 *
 * Run: npx tsx scripts/test_auth_timeout_telemetry_contract.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const authServicePath = path.join(__dirname, "..", "services", "AuthService.ts");
const source = fs.readFileSync(authServicePath, "utf-8");

function testImportsTrackError() {
  console.log("\n[auth-timeout-telemetry] import");
  assert(
    /import\s*\{[^}]*trackError[^}]*\}\s*from\s*['"]\.\.\/utils\/monitoring['"]/.test(source),
    "AuthService.ts deve importare trackError da utils/monitoring"
  );
  pass("trackError importato da utils/monitoring");
}

function testGetCurrentUserTimeoutIsTracked() {
  console.log("\n[auth-timeout-telemetry] getCurrentUser() — timeout su getSession()");

  const marker = 'console.error("getCurrentUser: auth.getSession timed out or failed", e);';
  const idx = source.indexOf(marker);
  assert(idx !== -1, "il log del timeout su getSession() in getCurrentUser() deve esistere ancora");

  // Prendiamo un blocco ragionevole di codice subito dopo il console.error, dove ci aspettiamo
  // la chiamata a trackError prima del return null.
  const block = source.slice(idx, idx + 1200);

  assert(block.includes("trackError("), "il timeout su getSession() deve chiamare trackError (altrimenti resta invisibile a Sentry)");
  assert(block.includes('"auth_get_session_timeout"'), "issueName/fingerprint 'auth_get_session_timeout' deve essere presente e stabile");
  assert(block.includes("return null;"), "getCurrentUser() deve continuare a fallire in modo sicuro (return null), non propagare");

  pass("getCurrentUser(): il timeout su getSession() chiama trackError con issueName stabile prima di restituire null");
}

function testGetUsersTimeoutIsTracked() {
  console.log("\n[auth-timeout-telemetry] getUsers() — eccezione/timeout sulla query profiles");

  const marker = 'console.error("Exception fetching users", e);';
  const idx = source.indexOf(marker);
  assert(idx !== -1, "il log dell'eccezione in getUsers() deve esistere ancora");

  const block = source.slice(idx, idx + 1200);

  assert(block.includes("trackError("), "l'eccezione in getUsers() (incluso il timeout) deve chiamare trackError");
  assert(
    block.includes('"profiles_get_users_timeout"') && block.includes('"profiles_get_users_exception"'),
    "deve distinguere timeout vs altre eccezioni con issueName diversi (usando _isTimeoutError)"
  );
  assert(block.includes("_isTimeoutError"), "la distinzione timeout/altro deve riusare l'helper esistente _isTimeoutError, non duplicarne la logica");
  assert(block.includes("return [];"), "getUsers() deve continuare a fallire in modo sicuro (return []), non propagare");

  pass("getUsers(): l'eccezione chiama trackError, distinguendo timeout da altre eccezioni via _isTimeoutError");
}

function run() {
  console.log("Auth timeout telemetry contract tests");
  console.log("─".repeat(60));

  testImportsTrackError();
  testGetCurrentUserTimeoutIsTracked();
  testGetUsersTimeoutIsTracked();

  console.log("\n" + "─".repeat(60));
  console.log("Auth timeout telemetry contract: PASS ✓");
}

run();
