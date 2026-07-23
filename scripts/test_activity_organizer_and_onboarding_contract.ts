/**
 * Regression/contract test per 3 modifiche del 2026-07-24:
 *
 *  1. Fix "profilo ente in caricamento continuo": cliccando sul nome dell'organizzatore nel
 *     dettaglio attività, un volontario veniva mandato su app/npo-profile/[id].tsx dove il
 *     fetch (fetchUserById -> AuthService.getProfileById) poteva restare bloccato senza mai
 *     risolversi. Causa radice confermata: nessun bug di RLS/query (verificato con query
 *     dirette su staging, sia a livello SQL con SET ROLE authenticated sia via PostgREST reale
 *     con net.http_get — entrambi rispondono correttamente) — il punto di blocco è nel client
 *     supabase-js stesso: le chiamate `.from(...).select(...)` attendono internamente la
 *     sessione/lock di rinnovo token, che su React Native può restare "impegnato" a tempo
 *     indefinito se un refresh parte e non si completa/rilascia mai (app in background a metà
 *     refresh, rete persa). Il codice aveva già riconosciuto questa classe di bug altrove
 *     (_getAccessTokenForRest avvolge già getSession() in un timeout; profileRest.* per il
 *     salvataggio profilo usa lo stesso pattern) ma NON per i fetch profilo via query builder.
 *     Fix vero, alla fonte: getProfileById/getUsers/getCurrentUser in AuthService.ts avvolgono
 *     ora la query (e getCurrentUser anche getSession()) in withTimeout, così qualunque
 *     chiamante — non solo questa schermata — è protetto. In più: select esplicito che esclude
 *     la colonna `embedding` (pgvector, ~1536 dimensioni, mai usata dal client, scaricata
 *     inutilmente su ogni fetch profilo) e uno stato di errore/retry in npo-profile/[id].tsx
 *     (difesa aggiuntiva lato UI, non l'unica).
 *  2. Icona "aggiungi a calendario" nell'header del dettaglio attività, accanto a condividi,
 *     visibile solo per un volontario iscritto (isEnrolled) — riusa handleAddToCalendar/
 *     addEventToDeviceCalendar già esistenti (in precedenza raggiungibili solo toccando la
 *     riga data/ora, non nell'header).
 *  3. Nuovo step onboarding volontario "invite-friend" dopo "welcome": suggerisce di
 *     condividere il codice amico prima di entrare nell'app, replica di app/(volunteer)/
 *     referral.tsx. Il flusso NPO resta invariato (nessuno step aggiuntivo dopo "welcome").
 *
 * Sono controlli statici sul codice sorgente (no Metro, no rendering React Native, no DB),
 * stesso approccio di scripts/test_settings_structure_contract.ts.
 *
 * Run: npx tsx scripts/test_activity_organizer_and_onboarding_contract.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function fileExists(relativePath: string): boolean {
  return existsSync(join(REPO_ROOT, relativePath));
}

// ── 1. AuthService: niente più `embedding` nei select profilo, ovunque ─────

function testProfileSelectsExcludeEmbedding() {
  console.log("\n[AuthService] i select su profiles non scaricano più `embedding`");

  const source = readSource("services/AuthService.ts");

  assert(
    source.includes("PROFILE_COLUMNS_NO_EMBEDDING"),
    "AuthService.ts deve definire una costante di colonne esplicite che esclude `embedding`"
  );

  const constMatch = source.match(/const PROFILE_COLUMNS_NO_EMBEDDING = `([\s\S]*?)`;/);
  assert(constMatch, "PROFILE_COLUMNS_NO_EMBEDDING deve essere una template string di colonne");
  assert(
    !constMatch![1].includes("embedding"),
    "REGRESSIONE: PROFILE_COLUMNS_NO_EMBEDDING non deve includere la colonna embedding"
  );
  assert(constMatch![1].includes("id") && constMatch![1].includes("full_name"), "PROFILE_COLUMNS_NO_EMBEDDING deve includere le colonne base (id, full_name, ...)");
  pass("PROFILE_COLUMNS_NO_EMBEDDING esiste ed esclude embedding");

  const usageCount = (source.match(/PROFILE_COLUMNS_NO_EMBEDDING/g) || []).length;
  // 1 dichiarazione + almeno 4 usi (login, getUsers, getProfileById, getCurrentUser)
  assert(usageCount >= 5, `PROFILE_COLUMNS_NO_EMBEDDING deve essere riusata in almeno 4 punti (login/getUsers/getProfileById/getCurrentUser), trovati ${usageCount - 1} usi`);
  pass("PROFILE_COLUMNS_NO_EMBEDDING è riusata in tutti i fetch profilo principali");

  assert(
    !/\.from\('profiles'\)\s*\.select\('\*'\)/.test(source),
    "REGRESSIONE: nessun select('*') grezzo su profiles deve restare in AuthService.ts (deve usare PROFILE_COLUMNS_NO_EMBEDDING)"
  );
  pass("nessun select('*') grezzo residuo su profiles in AuthService.ts");
}

// ── 1b. AuthService: il fix vero è ALLA FONTE — la query stessa ha un timeout ──

function testProfileFetchesAreWrappedInTimeoutAtTheSource() {
  console.log("\n[AuthService] getProfileById/getUsers/getCurrentUser sono protette da withTimeout, non solo la UI");

  const source = readSource("services/AuthService.ts");

  assert(
    source.includes("import { withTimeout } from '../utils/withTimeout'") || source.includes('import { withTimeout } from "../utils/withTimeout"'),
    "AuthService.ts deve importare l'utility condivisa withTimeout"
  );

  const getProfileByIdBlock = source.slice(source.indexOf("async getProfileById"), source.indexOf("async getBlockedUsers"));
  assert(
    /this\._withTimeout\(\s*supabase\s*\.from\('profiles'\)/.test(getProfileByIdBlock),
    "REGRESSIONE: getProfileById deve avvolgere la query supabase in this._withTimeout — senza, un hang del client (lock di rinnovo sessione bloccato) resta senza mai risolversi, indipendentemente da qualunque timeout messo solo lato UI"
  );
  pass("getProfileById avvolge la query in this._withTimeout alla fonte");

  const getUsersBlock = source.slice(source.indexOf("async getUsers"), source.indexOf("async getAllUsers"));
  assert(
    /this\._withTimeout\(query,/.test(getUsersBlock),
    "REGRESSIONE: getUsers deve avvolgere la query in this._withTimeout"
  );
  pass("getUsers avvolge la query in this._withTimeout alla fonte");

  const getCurrentUserBlock = source.slice(source.indexOf("async getCurrentUser"), source.indexOf("async ensureReferralCodeExists"));
  assert(
    /this\._withTimeout\(supabase\.auth\.getSession\(\)/.test(getCurrentUserBlock),
    "REGRESSIONE: getCurrentUser deve avvolgere auth.getSession() in this._withTimeout (gira ad ogni avvio app: senza, un hang qui blocca l'intero avvio)"
  );
  assert(
    /this\._withTimeout\(\s*supabase\s*\.from\('profiles'\)/.test(getCurrentUserBlock),
    "REGRESSIONE: getCurrentUser deve avvolgere anche la query del profilo in this._withTimeout"
  );
  pass("getCurrentUser avvolge sia getSession() sia la query profilo in this._withTimeout");

  assert(
    /catch \(e\) \{\s*console\.error\("getCurrentUser: auth\.getSession/.test(getCurrentUserBlock),
    "getCurrentUser deve intercettare il timeout di getSession() e restituire null in modo sicuro (diversi chiamanti in AuthContext.tsx non hanno un try/catch attorno a getCurrentUser())"
  );
  pass("un timeout su getSession() in getCurrentUser fallisce in modo sicuro (return null), non propaga un'eccezione ai chiamanti");
}

// ── 2. npo-profile/[id].tsx: timeout + retry lato UI, seconda linea di difesa ──

function testNpoProfileFetchHasTimeoutAndRetry() {
  console.log("\n[npo-profile] difesa aggiuntiva lato UI: timeout esplicito e stato di retry");

  const source = readSource("app/npo-profile/[id].tsx");

  assert(source.includes("fetchFailed"), "npo-profile/[id].tsx deve tracciare uno stato fetchFailed distinto da 'non trovato'");
  assert(source.includes("retryToken"), "npo-profile/[id].tsx deve avere un meccanismo di retry (retryToken)");
  assert(
    /Promise\.race\(\[\s*fetchUserById\(npoId\)/.test(source),
    "REGRESSIONE: il fetch di fetchUserById deve essere avvolto in Promise.race con un timeout esplicito, come seconda linea di difesa oltre al fix alla fonte in AuthService"
  );
  assert(source.includes('"Riprova"'), "la UI di errore deve offrire un bottone Riprova quando fetchFailed è true");
  pass("il fetch NPO ha timeout esplicito + stato di errore recuperabile con retry (difesa in profondità, oltre al fix in AuthService)");
}

// ── 3. Icona calendario nell'header del dettaglio attività ─────────────────

function testActivityHeaderHasCalendarButton() {
  console.log("\n[activity/[id]] icona calendario nell'header, accanto a condividi, solo per iscritti");

  const source = readSource("app/activity/[id].tsx");

  const headerStart = source.indexOf("Sticky Top Header");
  assert(headerStart !== -1, "app/activity/[id].tsx deve avere l'header sticky in alto");
  const headerBlock = source.slice(headerStart, headerStart + 1500);

  assert(
    /isEnrolled && user\?\.role === 'VOLUNTEER'/.test(headerBlock),
    "il pulsante calendario nell'header deve essere condizionato a isEnrolled && role VOLUNTEER"
  );
  assert(headerBlock.includes("handleAddToCalendar"), "il pulsante calendario nell'header deve usare handleAddToCalendar");
  assert(headerBlock.indexOf("handleAddToCalendar") < headerBlock.indexOf("handleShare"), "REGRESSIONE: il pulsante calendario deve comparire prima/accanto al pulsante condividi nell'header, non altrove");
  pass("l'header mostra l'icona calendario accanto a condividi, solo per volontari iscritti");

  assert(fileExists("utils/calendar.ts"), "utils/calendar.ts (addEventToDeviceCalendar, expo-calendar) deve esistere");
  const calendarUtil = readSource("utils/calendar.ts");
  assert(calendarUtil.includes("expo-calendar"), "addEventToDeviceCalendar deve usare expo-calendar (funziona sia su iOS/EventKit sia su Android/Google Calendar)");
  pass("addEventToDeviceCalendar si appoggia a expo-calendar, cross-platform iOS/Android");
}

// ── 4. Onboarding volontario: nuovo step invite-friend dopo welcome ────────

function testVolunteerOnboardingHasInviteFriendStep() {
  console.log("\n[Onboarding volontario] step 'invite-friend' dopo 'welcome'");

  assert(fileExists("app/onboarding/invite-friend.tsx"), "app/onboarding/invite-friend.tsx deve esistere");

  const inviteScreen = readSource("app/onboarding/invite-friend.tsx");
  assert(inviteScreen.includes("updateUserProfile({ profile_completed: true })"), "invite-friend.tsx deve finalizzare l'onboarding (profile_completed: true)");
  assert(inviteScreen.includes('"/(volunteer)/(tabs)/community"'), "invite-friend.tsx deve navigare verso la home volontario dopo il completamento");
  assert(inviteScreen.includes("referral_code") || inviteScreen.includes("referralCode"), "invite-friend.tsx deve mostrare il codice amico dell'utente");
  assert(inviteScreen.includes("Share.share") || inviteScreen.includes("handleShare"), "invite-friend.tsx deve permettere di condividere il codice");
  pass("app/onboarding/invite-friend.tsx esiste e finalizza l'onboarding condividendo il codice amico");

  const layout = readSource("app/onboarding/_layout.tsx");
  assert(
    /volunteerSteps = \[[^\]]*"invite-friend"[^\]]*\]/.test(layout),
    "onboarding/_layout.tsx deve includere 'invite-friend' in volunteerSteps"
  );
  assert(layout.includes('<Stack.Screen name="invite-friend" />'), "onboarding/_layout.tsx deve registrare lo Stack.Screen invite-friend");
  pass("invite-friend è registrato come step del flusso onboarding volontario");

  const npoStepsMatch = layout.match(/npoSteps = \[([\s\S]*?)\];/);
  assert(npoStepsMatch, "onboarding/_layout.tsx deve definire npoSteps");
  assert(!npoStepsMatch![1].includes("invite-friend"), "REGRESSIONE: invite-friend è una feature solo volontario, non deve comparire in npoSteps");
  pass("invite-friend non è presente nel flusso NPO (feature solo volontario)");

  const welcomeScreen = readSource("app/onboarding/welcome.tsx");
  assert(
    /user\?\.role === "NPO"[\s\S]*?updateUserProfile\(\{ profile_completed: true \}\)/.test(welcomeScreen),
    "welcome.tsx deve continuare a finalizzare l'onboarding direttamente per un NPO (nessuno step aggiuntivo)"
  );
  assert(
    welcomeScreen.includes('router.push("/onboarding/invite-friend"'),
    "welcome.tsx deve instradare il volontario verso /onboarding/invite-friend invece di finalizzare subito l'onboarding"
  );
  pass("welcome.tsx: NPO finalizza subito, volontario passa da invite-friend");

  const rootLayout = readSource("app/_layout.tsx");
  assert(
    rootLayout.includes('!segmentKey.includes("invite-friend")'),
    "la guardia di routing centrale (app/_layout.tsx) deve escludere invite-friend dalla fuga forzata dall'onboarding, come già fa per welcome"
  );
  pass("la guardia di routing centrale esclude invite-friend, evitando una doppia navigazione in corsa");
}

// ── Runner ───────────────────────────────────────────────────────────────

function run() {
  console.log("Activity organizer fix + calendar icon + onboarding invite contract tests (2026-07-24)");
  console.log("─".repeat(60));

  testProfileSelectsExcludeEmbedding();
  testProfileFetchesAreWrappedInTimeoutAtTheSource();
  testNpoProfileFetchHasTimeoutAndRetry();
  testActivityHeaderHasCalendarButton();
  testVolunteerOnboardingHasInviteFriendStep();

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sono passati ✓");
}

run();
