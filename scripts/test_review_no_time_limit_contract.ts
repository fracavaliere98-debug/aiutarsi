/**
 * Regression test per un bug reale osservato su device il 2026-09-22:
 * aprendo il dettaglio di un'attività dalla card "Valuta la tua esperienza"
 * (app/(volunteer)/(tabs)/index.tsx), la CTA in fondo mostrava "Iscritto"
 * invece del tasto Recensisci o del box "In attesa conferma".
 *
 * Causa originale: in app/activity/[id].tsx, `canLeaveReview` richiedeva
 * anche `daysSinceEnd <= 10` oltre a `isConfirmedPresent`. Per un'attività
 * COMPLETATA, con presenza confermata (auto o npo) ma mai recensita e con
 * più di 10 giorni dalla fine, né `canLeaveReview` né
 * `isWaitingPresenceConfirmation` (che richiede `!isConfirmedPresent`) erano
 * vere — la catena di ternari ricadeva quindi sul fallback generico
 * `isEnrolled` ("Iscritto"). Riprodotto su staging: activity_id
 * 4bbd26d3-... "Prova", confirmed_by='auto', days_since_end≈53,
 * own_review_id=null.
 *
 * Prima correzione (tentativo): introdotto un limite di 10 giorni replicato
 * anche nella card dashboard, con un terzo stato "finestra scaduta".
 * SCARTATA su indicazione esplicita dell'utente: "da volontario devo poter
 * recensire anche trascorsi 10 giorni, non c'è un limite per recensire, al
 * netto che la presenza sia stata confermata (da NPO o automaticamente)".
 *
 * Fix definitivo: rimosso il gate sui giorni da `canLeaveReview`. L'unico
 * requisito per recensire un'attività COMPLETATA non ancora recensita è
 * `isConfirmedPresent` (npo o auto, indifferentemente) — nessun limite
 * temporale. Con questo, `canLeaveReview` e `isWaitingPresenceConfirmation`
 * tornano ad essere complementari per ogni volontario iscritto a
 * un'attività completata non ancora recensita: il fallback "Iscritto" non
 * può più essere raggiunto in quel caso.
 *
 * Questo test è statico (grep sui file sorgente): verifica che il gate sui
 * giorni non torni surrettiziamente, e che i due stati restino
 * complementari nell'ordine dei branch JSX.
 *
 * Run: npx tsx scripts/test_review_no_time_limit_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

console.log("Review has no time limit contract (2026-09-22)");
console.log("────────────────────────────────────────────────────────────\n");

const detail = read("app", "activity", "[id].tsx");

const canLeaveReviewMatch = detail.match(/const canLeaveReview = [^;]+;/s);
assert(canLeaveReviewMatch, "app/activity/[id].tsx deve definire `canLeaveReview`");
assert(
  !/daysSinceEnd/.test(canLeaveReviewMatch![0]),
  "canLeaveReview NON deve più dipendere da daysSinceEnd: da volontario non c'è un limite di giorni per " +
    "recensire, solo la presenza confermata conta (indicazione esplicita dell'utente, 2026-09-22)."
);
assert(
  /isConfirmedPresent/.test(canLeaveReviewMatch![0]),
  "canLeaveReview deve continuare a richiedere isConfirmedPresent (npo o auto, indifferentemente)"
);
pass("canLeaveReview dipende da isConfirmedPresent e non da un limite di giorni");

assert(
  !/daysSinceEnd/.test(detail),
  "daysSinceEnd non deve più esistere in app/activity/[id].tsx: era usato solo per il limite di giorni " +
    "rimosso, la sua presenza indicherebbe che il vecchio gate (o un suo equivalente) è tornato"
);
pass("nessuna traccia residua di daysSinceEnd");

assert(
  !/reviewWindowExpired/.test(detail),
  "lo stato reviewWindowExpired (introdotto per il limite di giorni, poi scartato) non deve essere tornato"
);
pass("nessuna traccia residua dello stato reviewWindowExpired");

// canLeaveReview e isWaitingPresenceConfirmation devono restare
// complementari: stesso prefisso di condizioni, opposte su isConfirmedPresent.
const waitingMatch = detail.match(/const isWaitingPresenceConfirmation = [^;]+;/s);
assert(waitingMatch, "app/activity/[id].tsx deve definire `isWaitingPresenceConfirmation`");
assert(
  /!isConfirmedPresent/.test(waitingMatch![0]),
  "isWaitingPresenceConfirmation deve richiedere !isConfirmedPresent, complementare a canLeaveReview"
);
pass("canLeaveReview e isWaitingPresenceConfirmation restano complementari su isConfirmedPresent");

// Ordine dei branch JSX: entrambi devono precedere il fallback isEnrolled.
assert(
  /canLeaveReview\s*\?[\s\S]*?isWaitingPresenceConfirmation\s*\?[\s\S]*?\)\s*:\s*hasSubmittedReview\s*\?[\s\S]*?\)\s*:\s*activity\.status === 'CANCELLATA'[\s\S]*?\)\s*:\s*isEnrolled\s*\?/.test(detail),
  "l'ordine dei branch CTA (canLeaveReview, isWaitingPresenceConfirmation, hasSubmittedReview, CANCELLATA) " +
    "deve precedere il fallback isEnrolled — altrimenti un caso può ricadere di nuovo su 'Iscritto'"
);
pass("i branch di stato precedono il fallback isEnrolled nella CTA");

const dashboard = read("app", "(volunteer)", "(tabs)", "index.tsx");
assert(
  !/REVIEW_WINDOW_DAYS/.test(dashboard),
  "app/(volunteer)/(tabs)/index.tsx non deve più filtrare 'Valuta la tua esperienza' per giorni trascorsi"
);
pass('la card "Valuta la tua esperienza" non ha più un limite di giorni');

console.log("\n────────────────────────────────────────────────────────────");
console.log("Review has no time limit contract: PASS ✓");
