/**
 * A26 P8 (27/10/2026): la privacy policy in app deve descrivere quello che l'app fa davvero.
 * Il test legge il codice e controlla che ogni fornitore esterno a cui mandiamo dati sia nominato
 * nell'informativa. Se aggiungi una funzione che manda testo utente a un nuovo servizio, questo test
 * fallisce finche' non aggiorni app/privacy-policy.tsx (e PRIVACY_POLICY_LAST_UPDATE).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

const policy = read("app", "privacy-policy.tsx");

// Contenuti minimi
for (const [needle, label] of [
  [/data di nascita/, "data di nascita"],
  [/almeno 18 anni/, "eta' minima 18 anni"],
  [/Profilo non pubblico/, "regola del profilo non pubblico"],
  [/«Marta B\.»/, "esempio del nome mascherato"],
  [/Seguire un ente non mostra il tuo profilo/, "il follow non sblocca il profilo"],
  [/dopo 20 giorni/, "notifiche cancellate dopo 20 giorni"],
  [/30 giorni/, "cancellazione account dopo 30 giorni"],
  [/Garante per la protezione dei dati personali/, "reclamo al Garante"],
  [/PRIVACY_CONTACT_EMAIL/, "contatto privacy"],
] as const) {
  assert(needle.test(policy), `Privacy policy must mention: ${label}`);
}
assert(!/\[DA COMPLETARE\]|versione sintetica/i.test(policy), "Privacy policy must not contain placeholders");

// Ogni fornitore trovato nel codice deve essere nominato
const functionsDir = join(process.cwd(), "supabase", "functions");
let functionsSource = "";
for (const name of readdirSync(functionsDir)) {
  const file = join(functionsDir, name, "index.ts");
  if (existsSync(file)) functionsSource += `\n${readFileSync(file, "utf8")}`;
}
const providers: [RegExp, RegExp, string][] = [
  [/generativelanguage\.googleapis\.com/, /Google \(Gemini\)/, "Google (Gemini)"],
  [/exp\.host/, /Expo/, "Expo"],
  [/https?:\/\/[^\s"'`]*huggingface/i, /Hugging ?Face/, "HuggingFace"],
  [/api\.openai\.com/, /OpenAI/, "OpenAI"],
  [/api\.anthropic\.com/, /Anthropic/, "Anthropic"],
];
for (const [inCode, inPolicy, label] of providers) {
  if (inCode.test(functionsSource)) {
    assert(inPolicy.test(policy), `Edge functions send data to ${label}: the privacy policy must name it`);
  }
}

// Sentry: se riceve l'email dell'utente la policy lo deve dire
const monitoring = read("utils", "monitoring.ts");
if (/Sentry\.setUser\(\{[\s\S]*?email:/.test(monitoring)) {
  assert(/Sentry riceve[^.]*email/.test(policy), "Sentry receives the user's email: the privacy policy must say so");
}

// Dati inviati a Google: la policy non deve promettere piu' di quello che facciamo
const embedding = read("supabase", "functions", "generate-embedding", "index.ts");
if (/Bio: \$\{record\.bio/.test(embedding)) {
  assert(/presentazione, i tuoi interessi e le tue competenze/.test(policy), "Embedding sends bio, interests and skills: the policy must say so");
}

console.log("privacy-policy-contract: ok");
