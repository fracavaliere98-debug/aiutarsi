/**
 * Regression/contract tests for the "shell onboarding" and "form attività unico" design handoffs:
 *  - app/onboarding/npo-preview.tsx      (StandardLayout → OnboardingStepHeader + footer sticky)
 *  - components/npo/ActivityForm.tsx     (nuovo form condiviso create/edit)
 *  - app/(npo)/create-activity.tsx       (ridotto a wrapper)
 *  - app/(npo)/edit-activity/[id].tsx    (ridotto a wrapper)
 *
 * Questi test girano in Node puro (no Metro, no rendering React Native): verificano la logica di
 * business estratta in components/npo/activityFormLogic.ts, e — dove la logica non è estraibile
 * (props/JSX wiring) — controllano il codice sorgente per i pattern che garantiscono i 3
 * comportamenti da preservare rispetto all'app originale (vedi conversazione):
 *   1. auto-rifinitura AI su "Rilancia con AI" (ai_draft=true)
 *   2. conferma indirizzo obbligatoria solo in creazione, mai in modifica
 *   3. link "Elimina" disabilitato durante il salvataggio in modifica
 *
 * Run: npx tsx scripts/test_activity_form_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countActiveUrgentActivities,
  getInitialCoordsConfirmed,
  hasAllRequiredFields,
  isEndBeforeOrEqualStart,
  isStartInPast,
  parseDateTimeOrNull,
  shouldAutoCurateDraft,
  shouldBlockSubmitForUnconfirmedAddress,
  validateActivityFormSubmit,
  wasFutureActivityMovedToPast,
  type UrgentActivityLike,
} from "../components/npo/activityFormLogic";
import type { ActivityFormValues } from "../components/npo/ActivityForm";

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

function baseValues(overrides: Partial<ActivityFormValues> = {}): ActivityFormValues {
  return {
    title: "Distribuzione Pasti",
    category: "Sociale",
    address: "Via Roma 1, Milano",
    lat: 45.464,
    lng: 9.19,
    date: "2099-01-15",
    slots: "10",
    description: "Descrizione attività",
    startTime: "10:00",
    endTime: "12:00",
    isUrgent: false,
    skills: [],
    imageUrl: undefined,
    recurrence: "NONE",
    ...overrides,
  };
}

// ── Campi obbligatori ──────────────────────────────────────────────────────

function testRequiredFields() {
  console.log("\n[ActivityForm] hasAllRequiredFields");

  assert(hasAllRequiredFields(baseValues()), "tutti i campi compilati → true");
  pass("form completo passa");

  for (const field of ["title", "address", "description", "endTime", "date"] as const) {
    const values = baseValues({ [field]: "" });
    assert(!hasAllRequiredFields(values), `campo mancante "${field}" → false`);
  }
  pass("ogni singolo campo obbligatorio mancante blocca la validazione");

  // startTime, slots, category NON sono nel set obbligatorio storico — non devono bloccare.
  assert(hasAllRequiredFields(baseValues({ startTime: "" })), "startTime vuoto non è bloccante (comportamento storico)");
  pass("startTime vuoto non blocca (fedele al comportamento originale)");
}

// ── Orario fine <= inizio ──────────────────────────────────────────────────

function testEndBeforeStart() {
  console.log("\n[ActivityForm] isEndBeforeOrEqualStart");

  assert(!isEndBeforeOrEqualStart("2099-01-15", "10:00", "12:00"), "fine dopo inizio → non bloccato");
  assert(isEndBeforeOrEqualStart("2099-01-15", "10:00", "10:00"), "fine uguale a inizio → bloccato");
  assert(isEndBeforeOrEqualStart("2099-01-15", "12:00", "10:00"), "fine prima di inizio → bloccato");
  pass("confronto orari coerente con l'originale (< bloccato, > libero)");
}

// ── coordsConfirmed iniziale (bug corretto rispetto all'handoff originale) ──

function testInitialCoordsConfirmed() {
  console.log("\n[ActivityForm] getInitialCoordsConfirmed");

  assert(getInitialCoordsConfirmed("") === false, "indirizzo vuoto (creazione da zero) → non confermato");
  assert(getInitialCoordsConfirmed("Via Roma 1, Milano") === true, "indirizzo già presente (edit/duplicazione/AI riuscita) → confermato");
  pass("indirizzo vuoto/non vuoto determina lo stato iniziale, non la modalità");

  // Regressione specifica: l'handoff originale inizializzava coordsConfirmed a `mode === 'edit'`,
  // il che avrebbe bloccato la creazione da duplicazione/bozza AI (indirizzo già valido ma
  // mode==='create'). Verifichiamo che quello scenario NON sia più bloccato.
  const duplicatedAddress = "Piazza Duomo 1, Milano";
  const confirmedOnDuplicate = getInitialCoordsConfirmed(duplicatedAddress);
  assert(confirmedOnDuplicate === true, "duplicazione/bozza AI con indirizzo valido → confermato subito");
  assert(
    shouldBlockSubmitForUnconfirmedAddress("create", confirmedOnDuplicate) === false,
    "REGRESSIONE: duplicare un'attività non deve più bloccare 'Continua' in creazione"
  );
  pass("fix regressione: duplicazione/bozza AI in creazione non blocca più il submit");
}

// ── Gating conferma indirizzo per modalità ──────────────────────────────────

function testAddressConfirmationGating() {
  console.log("\n[ActivityForm] shouldBlockSubmitForUnconfirmedAddress");

  assert(shouldBlockSubmitForUnconfirmedAddress("create", false) === true, "creazione + non confermato → blocca");
  assert(shouldBlockSubmitForUnconfirmedAddress("create", true) === false, "creazione + confermato → non blocca");
  assert(shouldBlockSubmitForUnconfirmedAddress("edit", false) === false, "modifica + non confermato → NON blocca (comportamento storico)");
  assert(shouldBlockSubmitForUnconfirmedAddress("edit", true) === false, "modifica + confermato → non blocca");
  pass("il blocco su indirizzo non confermato esiste solo in creazione, mai in modifica");
}

// ── validateActivityFormSubmit: composizione e ordine dei controlli ────────

function testComposedValidation() {
  console.log("\n[ActivityForm] validateActivityFormSubmit");

  const okCreate = validateActivityFormSubmit("create", baseValues(), true);
  assert(okCreate.ok, "creazione con dati validi e indirizzo confermato → ok");
  pass("caso valido in creazione passa");

  const okEdit = validateActivityFormSubmit("edit", baseValues(), false);
  assert(okEdit.ok, "modifica con dati validi, indirizzo non confermato → ok comunque (storico)");
  pass("caso valido in modifica passa anche senza conferma indirizzo");

  const missingField = validateActivityFormSubmit("create", baseValues({ title: "" }), true);
  assert(!missingField.ok && missingField.message.includes("Compila tutti i campi"), "campo mancante → messaggio corretto");
  pass("messaggio campi obbligatori corretto");

  const unconfirmedAddress = validateActivityFormSubmit("create", baseValues(), false);
  assert(!unconfirmedAddress.ok && unconfirmedAddress.message.includes("Seleziona un indirizzo"), "indirizzo non confermato in creazione → messaggio corretto");
  pass("messaggio indirizzo non confermato corretto (solo creazione)");

  const badTimes = validateActivityFormSubmit("create", baseValues({ startTime: "12:00", endTime: "10:00" }), true);
  assert(!badTimes.ok && badTimes.message.includes("orario di fine"), "fine prima di inizio → messaggio corretto");
  pass("messaggio orari invertiti corretto");

  // Ordine: un form con campo mancante E orari invertiti deve segnalare prima il campo mancante.
  const bothInvalid = validateActivityFormSubmit("create", baseValues({ title: "", startTime: "12:00", endTime: "10:00" }), true);
  assert(!bothInvalid.ok && bothInvalid.message.includes("Compila tutti i campi"), "priorità: campi obbligatori prima degli orari");
  pass("ordine dei controlli invariato (campi obbligatori → indirizzo → orari)");
}

// ── Auto-rifinitura AI (bug #1: persa nell'handoff originale, ripristinata) ─

function testAutoCurateTrigger() {
  console.log("\n[ActivityForm] shouldAutoCurateDraft — auto-AI su 'Rilancia con AI'");

  assert(
    shouldAutoCurateDraft({ autoCurateOnLoad: true, title: "Distribuzione Pasti", isCuratingDraft: false, hasAutoCuratedDraft: false }) === true,
    "ai_draft=true, titolo pronto, prima volta → deve auto-rifinire"
  );
  pass("scatta quando tutte le condizioni sono soddisfatte");

  assert(
    shouldAutoCurateDraft({ autoCurateOnLoad: false, title: "Distribuzione Pasti", isCuratingDraft: false, hasAutoCuratedDraft: false }) === false,
    "flusso normale (duplicazione o creazione da zero) → NON deve auto-rifinire"
  );
  pass("non scatta fuori dal flusso 'Rilancia con AI' (duplicate/creazione libera)");

  assert(
    shouldAutoCurateDraft({ autoCurateOnLoad: true, title: "", isCuratingDraft: false, hasAutoCuratedDraft: false }) === false,
    "titolo ancora vuoto (bootstrap non arrivato) → NON deve auto-rifinire"
  );
  pass("aspetta che il titolo sia valorizzato prima di partire");

  assert(
    shouldAutoCurateDraft({ autoCurateOnLoad: true, title: "Distribuzione Pasti", isCuratingDraft: true, hasAutoCuratedDraft: false }) === false,
    "già in corso → non deve ripartire in parallelo"
  );
  pass("non duplica la chiamata se già in corso");

  assert(
    shouldAutoCurateDraft({ autoCurateOnLoad: true, title: "Distribuzione Pasti", isCuratingDraft: false, hasAutoCuratedDraft: true }) === false,
    "già eseguita una volta → non deve ripartire ad ogni render"
  );
  pass("scatta una sola volta per sessione del form (non ad ogni render)");
}

// ── Conteggio attività urgenti (create + edit, stessa funzione) ────────────

function testUrgentCount() {
  console.log("\n[ActivityForm] countActiveUrgentActivities");

  const activities: UrgentActivityLike[] = [
    { id: "a1", npoId: "npo-1", isUrgent: true, status: "APERTA" },
    { id: "a2", npoId: "npo-1", isUrgent: true, status: "IN_CORSO" },
    { id: "a3", npoId: "npo-1", isUrgent: true, status: "COMPLETATA" }, // non attiva → esclusa
    { id: "a4", npoId: "npo-1", isUrgent: false, status: "APERTA" }, // non urgente → esclusa
    { id: "a5", npoId: "npo-2", isUrgent: true, status: "APERTA" }, // altro ente → esclusa
  ];

  assert(countActiveUrgentActivities(activities, "npo-1") === 2, "conta solo urgenti attive (APERTA/IN_CORSO) dello stesso ente");
  pass("filtra correttamente per ente, urgenza e stato attivo");

  assert(countActiveUrgentActivities(activities, "npo-1", "a1") === 1, "esclude l'attività corrente (edit) dal conteggio");
  pass("esclude l'id corrente quando fornito (caso edit)");

  assert(countActiveUrgentActivities(activities, undefined) === 0, "npoId undefined (utente non ancora caricato) → 0, mai un crash");
  pass("nessun match quando npoId è undefined");

  // Soglia delle 3 urgenti va applicata dal chiamante (canEnableUrgent = count < 3); qui verifichiamo solo il conteggio.
  const threeUrgent: UrgentActivityLike[] = [
    { id: "b1", npoId: "npo-3", isUrgent: true, status: "APERTA" },
    { id: "b2", npoId: "npo-3", isUrgent: true, status: "APERTA" },
    { id: "b3", npoId: "npo-3", isUrgent: true, status: "IN_CORSO" },
  ];
  assert(countActiveUrgentActivities(threeUrgent, "npo-3") === 3, "conta esattamente 3 quando ce ne sono 3");
  assert(countActiveUrgentActivities(threeUrgent, "npo-3") < 3 === false, "a 3 urgenti attive, canEnableUrgent (count<3) deve risultare false");
  pass("il conteggio a soglia 3 blocca correttamente un'ulteriore attivazione urgente");
}

// ── Data/ora nel passato (create) ───────────────────────────────────────────

function testDateParsingAndPastCheck() {
  console.log("\n[ActivityForm] parseDateTimeOrNull / isStartInPast");

  assert(parseDateTimeOrNull("2099-01-15", "10:00") !== null, "data/ora valide → parse ok");
  // Nota: quando arriva qui, `date` è già garantito non vuoto da hasAllRequiredFields (validato prima
  // in ActivityForm); solo `startTime` non è tra i campi obbligatori storici e può restare vuoto se
  // l'utente cancella il default "10:00". È questo il caso limite realmente raggiungibile da testare.
  assert(parseDateTimeOrNull("2099-01-15", "") === null, "data valida ma startTime vuoto → null (blocca con messaggio 'non validi')");
  assert(parseDateTimeOrNull("data-non-valida", "10:00") === null, "stringa data non valida → null");
  pass("parseDateTimeOrNull distingue input validi da non validi (sugli scenari realmente raggiungibili)");

  const future = parseDateTimeOrNull("2099-01-15", "10:00")!;
  const past = parseDateTimeOrNull("2000-01-15", "10:00")!;
  assert(isStartInPast(future) === false, "data futura → non nel passato");
  assert(isStartInPast(past) === true, "data passata → nel passato, blocca la creazione");
  pass("isStartInPast coerente con il vincolo storico di create-activity");
}

// ── Spostamento attività futura nel passato (edit) ──────────────────────────

function testWasFutureActivityMovedToPast() {
  console.log("\n[ActivityForm] wasFutureActivityMovedToPast");

  const now = new Date("2050-06-15T00:00:00Z");
  const futureOriginal = "2050-07-01T10:00:00Z";
  const pastOriginal = "2049-01-01T10:00:00Z";

  assert(
    wasFutureActivityMovedToPast(futureOriginal, "2049-01-01T10:00:00Z", now) === true,
    "attività futura spostata nel passato → bloccato"
  );
  assert(
    wasFutureActivityMovedToPast(futureOriginal, "2050-08-01T10:00:00Z", now) === false,
    "attività futura spostata più avanti nel futuro → consentito"
  );
  assert(
    wasFutureActivityMovedToPast(pastOriginal, "2049-06-01T10:00:00Z", now) === false,
    "attività già passata: può essere modificata liberamente anche restando nel passato"
  );
  pass("un'attività già nel passato resta liberamente modificabile; una futura non può retrocedere");
}

// ── Wiring strutturale (dove la logica non è estraibile in funzioni pure) ──

function testStructuralWiring() {
  console.log("\n[wiring] pattern sorgente attesi dopo le modifiche di design");

  const onboardingShell = readSource("app/onboarding/npo-preview.tsx");
  assert(!onboardingShell.includes("StandardLayout"), "npo-preview.tsx non deve più importare/usare StandardLayout");
  assert(onboardingShell.includes("OnboardingStepHeader"), "npo-preview.tsx deve usare OnboardingStepHeader");
  assert(onboardingShell.includes("SafeAreaView"), "npo-preview.tsx deve usare SafeAreaView");
  assert(onboardingShell.includes("logout"), "npo-preview.tsx deve avere onClose={() => logout()} come gli altri step NPO");
  assert(onboardingShell.includes("router.push('/onboarding/welcome')"), "il target di navigazione 'Continua' non deve essere cambiato");
  assert(/position:\s*['"]absolute['"]/.test(onboardingShell), "il CTA 'Continua' deve essere nel footer sticky, non a fine ScrollView");
  pass("app/onboarding/npo-preview.tsx: shell e navigazione coerenti con l'handoff");

  const activityForm = readSource("components/npo/ActivityForm.tsx");
  assert(
    /onPress=\{onDelete\}\s+disabled=\{isSubmitting\}/.test(activityForm.replace(/\s+/g, " ")),
    "REGRESSIONE: il link 'Elimina' deve restare disabilitato durante il salvataggio (isSubmitting)"
  );
  assert(activityForm.includes("validateActivityFormSubmit"), "handleSubmit deve usare la validazione centralizzata testata sopra");
  assert(activityForm.includes("shouldAutoCurateDraft"), "l'effetto di auto-rifinitura deve usare il guard centralizzato testato sopra");
  pass("components/npo/ActivityForm.tsx: fix #2 (blocco solo in create) e #3 (delete disabilitato) presenti nel sorgente");

  const createWrapper = readSource("app/(npo)/create-activity.tsx");
  assert(
    createWrapper.includes('autoCurateOnLoad={params.ai_draft === "true"}'),
    "REGRESSIONE: create-activity.tsx deve richiedere l'auto-rifinitura AI quando arriva da ai_draft=true"
  );
  pass("app/(npo)/create-activity.tsx: fix #1 (autoCurateOnLoad) cablato correttamente");

  const editWrapper = readSource("app/(npo)/edit-activity/[id].tsx");
  assert(editWrapper.includes("onDelete={handleDelete}"), "edit-activity/[id].tsx deve passare onDelete ad ActivityForm");
  assert(editWrapper.includes("wasFutureActivityMovedToPast"), "edit-activity/[id].tsx deve riusare il guard data-passata testato sopra");
  pass("app/(npo)/edit-activity/[id].tsx: wiring onDelete e guard data invariati");
}

// ── Runner ────────────────────────────────────────────────────────────────

function run() {
  console.log("Activity form design-refactor contract tests");
  console.log("─".repeat(60));

  testRequiredFields();
  testEndBeforeStart();
  testInitialCoordsConfirmed();
  testAddressConfirmationGating();
  testComposedValidation();
  testAutoCurateTrigger();
  testUrgentCount();
  testDateParsingAndPastCheck();
  testWasFutureActivityMovedToPast();
  testStructuralWiring();

  console.log("\n" + "─".repeat(60));
  console.log("All activity-form contract checks passed ✓");
}

run();
