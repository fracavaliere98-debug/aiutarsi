/**
 * Contract test (26/10/2026): campi obbligatori dell'onboarding.
 * L'utente deve capire QUALI campi mancano: asterisco rosso sull'etichetta, messaggio sotto ogni
 * campo mancante e un riepilogo con i nomi dei campi (non un generico "compila i campi obbligatori").
 * Run: npx tsx scripts/test_required_fields_contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMissingRequiredFields, missingFieldsMessage } from "../utils/requiredFields";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

// 1. Logica
const fields = [
  { key: "a", label: "Missione", value: "  " },
  { key: "b", label: "Indirizzo", value: "Via Roma 1" },
  { key: "c", label: "Telefono", value: "" },
  { key: "d", label: "Competenze", value: [] },
  { key: "e", label: "Coordinate", value: { lat: 1 } },
];
const missing = getMissingRequiredFields(fields);
assert(missing.map((f) => f.key).join(",") === "a,c,d", "Spazi, stringa vuota e lista vuota contano come mancanti, in ordine di schermata");
assert(missingFieldsMessage([{ label: "Telefono" }]) === "Manca un campo obbligatorio: Telefono.", "Messaggio al singolare");
assert(missingFieldsMessage(missing) === "Mancano 3 campi obbligatori: Missione, Telefono e Competenze.", "Messaggio al plurale con i nomi");
assert(missingFieldsMessage([]) === "", "Nessun messaggio se non manca niente");

// 2. Schermate
for (const screen of ["profile.tsx", "npo-details.tsx", "npo-referent.tsx"]) {
  const src = read("app", "onboarding", screen);
  assert(/<RequiredMark \/>/.test(src), `${screen}: le etichette dei campi obbligatori hanno l'asterisco rosso`);
  assert(/<RequiredFieldsNote \/>/.test(src), `${screen}: spiega cosa significa l'asterisco`);
  assert(/<FieldError message=/.test(src), `${screen}: messaggio sotto il campo mancante`);
  assert(/missingFieldsMessage\(/.test(src), `${screen}: il riepilogo nomina i campi che mancano`);
  assert(!/Compilate i campi obbligatori: missione/.test(src), `${screen}: niente piu' messaggio generico`);
  assert(!/buttonDisabled\]\}|&& styles\.buttonDisabled\]\}/.test(src) || /isLoading && styles\.buttonDisabled/.test(src), `${screen}: il pulsante non sembra disattivato quando mancano campi`);
}

console.log("required-fields-contract: ok");
