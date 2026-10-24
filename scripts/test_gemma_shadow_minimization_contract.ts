import fs from "fs";

// Contract test (A19 / GDPR): in shadow mode la edge function gemma-help-assistant manda il
// contesto utente a un provider LLM terzo (Gemini). Quel contesto NON deve contenere nome, bio,
// località né altri dati personali diretti. Verifica statica del sorgente + esecuzione reale di
// buildShadowUserContext con un profilo pieno di dati riconoscibili.

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const path = "supabase/functions/gemma-help-assistant/index.ts";
const source = fs.readFileSync(path, "utf8");

function extractFunction(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} non trovata in ${path}`);
  const next = source.indexOf("\nfunction ", start + 10);
  const asyncNext = source.indexOf("\nasync function ", start + 10);
  const ends = [next, asyncNext].filter((n) => n > start);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

// 1) Il ramo shadow deve usare buildShadowUserContext, mai buildUserContext.
const shadowBranch = source.match(/assistantMode === "shadow"\s*\?\s*\(([^)]*)\)\s*:/);
assert(shadowBranch, "Selezione del contesto per la modalità shadow non trovata");
assert(shadowBranch![1].includes("buildShadowUserContext"), "La modalità shadow deve usare buildShadowUserContext");
assert(!shadowBranch![1].includes("buildUserContext("), "La modalità shadow non deve usare buildUserContext (contiene nome, bio, località)");

// 2) buildShadowUserContext non deve leggere campi personali diretti.
const shadowSrc = extractFunction("buildShadowUserContext");
const forbidden = ["full_name", "npo_name", "bio", "location", "email", "phone", "address", "birth", "avatar", "getFirstName"];
for (const field of forbidden) {
  assert(!new RegExp(`\\b${field}\\w*`).test(shadowSrc.replace(/\/\/.*$/gm, "")), `buildShadowUserContext non deve usare "${field}"`);
}

// 3) Esecuzione reale con un profilo ricco di dati riconoscibili: nessuno deve comparire nell'output.
const runnable = shadowSrc.replace(/:\s*any\b/g, "").replace(/\)\s*:\s*string\s*\{/, ") {");
const buildShadowUserContext = new Function(`${runnable}; return buildShadowUserContext;`)() as (p: unknown) => string;

const profile = {
  role: "VOLUNTEER",
  profile_completed: true,
  full_name: "Mario Rossi Segretissimo",
  npo_name: "Ente Segretissimo",
  bio: "Bio Segretissima con dettagli personali",
  location_string: "Via Segretissima 1, Monza",
  location_lat: 45.58,
  location_lng: 9.27,
  email: "segretissimo@example.com",
  phone: "+39000000000",
  impact_points: 120,
  user_skills: [{ skill: "logistica" }],
  user_interests: [{ interest: "sociale" }],
  followed_entities: [{ npo_id: "npo-1" }],
};
const output = buildShadowUserContext(profile);
for (const secret of ["Mario", "Rossi", "Segretissim", "Monza", "45.58", "9.27", "example.com", "+39"]) {
  assert(!output.includes(secret), `Il contesto shadow contiene dati personali: "${secret}"`);
}
assert(output.includes("logistica") && output.includes("sociale") && output.includes("XP: 120"), "Il contesto shadow deve mantenere competenze, interessi e XP");

// 4) I log della funzione non devono stampare il profilo.
const logLines = source.split("\n").filter((line) => /console\.(log|warn|error|info)\(/.test(line));
for (const line of logLines) {
  assert(!/\bprofile\b|userContext|systemPrompt/.test(line), `Un log stampa dati del profilo o del prompt: ${line.trim()}`);
}

console.log("PASS Gemma shadow minimization contract validated");
