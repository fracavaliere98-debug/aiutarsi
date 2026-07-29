import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const reviewApplication = readRepoFile("app", "(volunteer)", "review-application.tsx");

// 1. Niente più "(Opzionale)" duplicato per il ramo candidatura ente: il label
// condizionale non deve più includere "(Opzionale)" al suo interno, dato che
// il componente lo aggiunge già una volta in modo fisso.
assert(
  /\{isActivity \? "Note per l'Ente" : "Presentati"\}/.test(reviewApplication),
  "Il label 'Presentati' per le candidature a ente non deve più includere '(Opzionale)' al suo interno (duplicato col suffisso fisso)"
);
assert(
  !/"Presentati \(Opzionale\)"/.test(reviewApplication),
  "Non deve ricomparire il vecchio label duplicato 'Presentati (Opzionale)'"
);

// 2. Lo stepper "Passo 1 di 2" è stato rimosso: non esiste un vero passo 2 nel
// flusso (dopo la conferma si va dritti alla schermata di ringraziamento).
assert(
  !/Passo 1 di 2/.test(reviewApplication),
  "Lo stepper 'Passo 1 di 2' (fuorviante, nessun passo 2 esiste nel flusso) deve restare rimosso"
);

// 3. Nessun log di debug con prefisso [DEBUG] rimasto in produzione.
assert(
  !/\[DEBUG\]/.test(reviewApplication),
  "Non devono restare console.log/warn/error con prefisso [DEBUG] in produzione"
);
// Il logging di errore reale deve comunque esistere, solo ripulito dal prefisso debug.
assert(
  /console\.error\("\[ReviewApplication\] handleConfirm failed", error\)/.test(reviewApplication),
  "Il logging dell'errore reale in handleConfirm deve restare, solo senza il prefisso [DEBUG]"
);

console.log("PASS review-application contract: label Opzionale corretta, stepper fuorviante rimosso, log di debug ripuliti");
