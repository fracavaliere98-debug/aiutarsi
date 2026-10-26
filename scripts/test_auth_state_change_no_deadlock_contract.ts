/**
 * Contract test: nessun deadlock nel lock di sessione di supabase-js (2026-10-26).
 *
 * Contesto: dopo ogni salvataggio del profilo l'app restava bloccata ~8s e comparivano
 * "profiles.getUsers timeout" / "Exception fetching users". Causa verificata (log di staging +
 * codice di @supabase/auth-js 2.95.3): updateUser() tiene il lock di sessione e aspetta le
 * callback di onAuthStateChange (USER_UPDATED). La callback in AuthContext faceva
 * `await authService.getCurrentUser(...)`, che usa query supabase-js, che a loro volta devono
 * leggere la sessione dallo stesso lock -> deadlock finché un timeout non sblocca tutto.
 *
 * Regola: le callback di onAuthStateChange non sono async e non fanno await; il lavoro
 * asincrono va spostato fuori dal lock (setTimeout 0).
 *
 * Secondo controllo (stesso giorno): ActivityService.getActivities allegava il token utente
 * solo se il filtro aveva userId; senza token profileRest usa la chiave anon, che da A26 non
 * legge `profiles` -> 401 ripetuti da utenti loggati.
 *
 * Test statico. Run: npx tsx scripts/test_auth_state_change_no_deadlock_contract.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const root = path.join(__dirname, "..");
const SEARCH_DIRS = ["app", "components", "context", "hooks", "services", "utils", "shared"];

function listFiles(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Restituisce il corpo della callback passata a onAuthStateChange( ... ), bilanciando le parentesi. */
function extractCallbacks(source: string): string[] {
  const bodies: string[] = [];
  const marker = "onAuthStateChange(";
  let from = 0;
  while (true) {
    const idx = source.indexOf(marker, from);
    if (idx === -1) break;
    let depth = 1;
    let i = idx + marker.length;
    for (; i < source.length && depth > 0; i++) {
      const c = source[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    bodies.push(source.slice(idx + marker.length, i - 1));
    from = i;
  }
  return bodies;
}

/** Rimuove i blocchi setTimeout(...) (dove l'await è ammesso, fuori dal lock). */
function stripSetTimeoutBlocks(body: string): string {
  let out = body;
  while (true) {
    const idx = out.indexOf("setTimeout(");
    if (idx === -1) return out;
    let depth = 1;
    let i = idx + "setTimeout(".length;
    for (; i < out.length && depth > 0; i++) {
      if (out[i] === "(") depth++;
      else if (out[i] === ")") depth--;
    }
    out = out.slice(0, idx) + out.slice(i);
  }
}

function testCallbacksDoNotAwait() {
  console.log("\n[auth-state-change] callback di onAuthStateChange senza await");
  const files = SEARCH_DIRS.flatMap(listFiles).filter((f) =>
    fs.readFileSync(path.join(root, f), "utf-8").includes("onAuthStateChange(")
  );
  assert(files.length > 0, "deve esistere almeno un onAuthStateChange (AuthContext)");
  assert(files.includes(path.join("context", "AuthContext.tsx")), "AuthContext.tsx deve registrare onAuthStateChange");

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf-8");
    for (const body of extractCallbacks(source)) {
      assert(
        !/^\s*async\b/.test(body),
        `${file}: la callback di onAuthStateChange non deve essere async (supabase-js la esegue dentro il lock di sessione)`
      );
      assert(
        !/\bawait\b/.test(stripSetTimeoutBlocks(body)),
        `${file}: nessun await dentro la callback di onAuthStateChange fuori da setTimeout (deadlock sul lock di sessione)`
      );
    }
    pass(`${file}: callback sincrona, lavoro asincrono fuori dal lock`);
  }
}

function testAuthContextDefersProfileReload() {
  console.log("\n[auth-state-change] AuthContext ricarica il profilo fuori dal lock");
  const source = fs.readFileSync(path.join(root, "context", "AuthContext.tsx"), "utf-8");
  const body = extractCallbacks(source)[0];
  assert(body.includes("setTimeout("), "il ricaricamento del profilo dopo SIGNED_IN/USER_UPDATED deve passare da setTimeout");
  assert(body.includes("authService.getCurrentUser(session)"), "il ricaricamento riusa la sessione dell'evento (nessun getSession extra)");
  assert(/seq !== authEventSeq/.test(body), "un risultato superato da un evento più recente (o SIGNED_OUT) deve essere scartato");
  pass("getCurrentUser(session) differito con setTimeout e protetto da numero di sequenza");
}

function testGetActivitiesTokenNotGatedOnUserId() {
  console.log("\n[activities-token] getActivities allega il token in base alla sessione");
  const source = fs.readFileSync(path.join(root, "services", "ActivityService.ts"), "utf-8");
  const start = source.indexOf("async getActivities(");
  assert(start !== -1, "ActivityService.getActivities deve esistere");
  const head = source.slice(start, start + 2500);
  const tokenIdx = head.indexOf("accessToken = await this._getAccessToken()");
  assert(tokenIdx !== -1, "getActivities deve leggere il token con _getAccessToken()");
  const beforeToken = head.slice(0, tokenIdx);
  assert(
    !/if\s*\(\s*filter\?\.userId\s*\)\s*\{\s*try\s*\{\s*$/.test(beforeToken.trimEnd() + " "),
    "il token non deve dipendere da filter.userId (senza token profileRest usa anon, che da A26 non legge profiles)"
  );
  assert(!/if\s*\(\s*filter\?\.userId\s*\)\s*\{[^}]*$/.test(beforeToken), "nessun gate su filter.userId prima del recupero del token");
  pass("token utente allegato a ogni chiamata con sessione, anon solo da sloggati");
}

testCallbacksDoNotAwait();
testAuthContextDefersProfileReload();
testGetActivitiesTokenNotGatedOnUserId();
console.log("\nauth-state-change-no-deadlock contract: OK");
