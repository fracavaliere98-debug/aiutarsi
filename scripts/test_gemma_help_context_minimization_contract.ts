import fs from "fs";

// Contract test (A24 / GDPR): nel Centro Assistenza (help_center) la edge function
// gemma-help-assistant manda il contesto utente a Gemini (provider LLM terzo). Decisione di
// Francesco: il nome proprio (volontari) o il nome ente (NPO) sì; bio e località testuale NO.
// Le coordinate restano solo lato server (getSuggestedActivities) e non devono entrare nel prompt.

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const path = "supabase/functions/gemma-help-assistant/index.ts";
const source = fs.readFileSync(path, "utf8");

function extractFunction(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} non trovata in ${path}`);
  const ends = [source.indexOf("\nfunction ", start + 10), source.indexOf("\nasync function ", start + 10)].filter((n) => n > start);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

// 1) Il ramo help_center con profilo deve usare buildUserContext.
assert(/:\s*\(profile\s*\?\s*buildUserContext\(profile\)/.test(source), "Il ramo help_center deve costruire il contesto con buildUserContext(profile)");

// 2) buildUserContext non deve leggere bio, località, contatti.
const ctxSrc = extractFunction("buildUserContext");
const codeOnly = ctxSrc.replace(/\/\/.*$/gm, "");
for (const field of ["bio", "location", "email", "phone", "address", "birth", "avatar"]) {
  assert(!new RegExp(`\\b${field}\\w*`, "i").test(codeOnly), `buildUserContext non deve usare "${field}"`);
}

// 3) Esecuzione reale (getFirstName serve a buildUserContext).
const runnable = (extractFunction("getFirstName") + "\n" + ctxSrc)
  .replace(/:\s*any\b/g, "")
  .replace(/\(rawName\?:\s*string\s*\|\s*null\)\s*:\s*string/, "(rawName)")
  .replace(/\(profile\)\s*:\s*string/, "(profile)");
const buildUserContext = new Function(`${runnable}; return buildUserContext;`)() as (p: unknown) => string;

const base = {
  profile_completed: true,
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
const forbidden = ["Segretissim", "Monza", "45.58", "9.27", "example.com", "+39"];

const volunteer = buildUserContext({ ...base, role: "VOLUNTEER", full_name: "Mario Rossi", npo_name: null });
assert(volunteer.includes("Nome: Mario"), "Il nome proprio del volontario deve restare nel contesto");
assert(!volunteer.includes("Rossi"), "Il cognome del volontario non deve entrare nel contesto");
for (const secret of forbidden) assert(!volunteer.includes(secret), `Contesto volontario con dati personali: "${secret}"`);

const npo = buildUserContext({ ...base, role: "NPO", full_name: "Referente Segretissimo", npo_name: "Ente Aiuto" });
assert(npo.includes("Nome: Ente Aiuto"), "Il nome ente deve restare nel contesto");
for (const secret of forbidden) assert(!npo.includes(secret), `Contesto NPO con dati personali: "${secret}"`);

assert(volunteer.includes("logistica") && volunteer.includes("sociale") && volunteer.includes("XP: 120"), "Competenze, interessi e XP devono restare");

// 4) Le coordinate servono solo alla ricerca lato server.
assert(/p_center_lat:\s*profile\?\.location_lat/.test(source), "Le coordinate devono restare per la ricerca attività lato server");

console.log("PASS Gemma help center context minimization contract validated");
