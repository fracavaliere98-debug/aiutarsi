import fs from "fs";
import path from "path";

// Contract test (A25): le edge function "*-smoke" creano utenti e dati con la service role.
// Devono rifiutare (403) fuori da staging, prima di creare il client admin o leggere il body.
// Questo test fallisce se una nuova funzione *-smoke viene aggiunta senza il controllo.

import { STAGING_PROJECT_REF, isStagingEnvironment } from "../supabase/functions/_shared/stagingOnly";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// 1) Logica del controllo
assert(isStagingEnvironment(`https://${STAGING_PROJECT_REF}.supabase.co`), "staging deve passare");
assert(!isStagingEnvironment("https://ibyjkqowokxrlormkwzw.supabase.co"), "prod deve essere rifiutata");
assert(!isStagingEnvironment(""), "URL vuoto deve essere rifiutato");
assert(!isStagingEnvironment(undefined), "URL assente deve essere rifiutato");
assert(!isStagingEnvironment(null), "URL null deve essere rifiutato");
assert(!isStagingEnvironment("not a url"), "URL non valido deve essere rifiutato");
assert(!isStagingEnvironment(`https://${STAGING_PROJECT_REF}.supabase.co.evil.example`), "host con suffisso deve essere rifiutato");
assert(!isStagingEnvironment(`https://evil.example/${STAGING_PROJECT_REF}.supabase.co`), "ref nel path deve essere rifiutato");
assert(!isStagingEnvironment(`https://x.${STAGING_PROJECT_REF}.supabase.co`), "sottodominio deve essere rifiutato");
assert(!isStagingEnvironment("http://localhost:54321"), "ambiente locale non è staging");

// 2) Tutte le funzioni *-smoke del repo hanno il controllo, come prima cosa del handler
const functionsDir = path.join("supabase", "functions");
const smokeDirs = fs.readdirSync(functionsDir).filter((d) => /-smoke$/.test(d));
assert(smokeDirs.length >= 8, `Attese almeno 8 funzioni *-smoke, trovate ${smokeDirs.length}`);

for (const dir of smokeDirs) {
  const file = path.join(functionsDir, dir, "index.ts");
  const src = fs.readFileSync(file, "utf8");
  assert(
    /import \{ rejectIfNotStaging \} from "\.\.\/_shared\/stagingOnly\.ts";/.test(src),
    `${dir}: manca l'import di rejectIfNotStaging`
  );
  const serveAt = src.indexOf("Deno.serve(");
  assert(serveAt >= 0, `${dir}: Deno.serve non trovato`);
  const handler = src.slice(serveAt);
  const guardAt = handler.indexOf("rejectIfNotStaging(");
  assert(guardAt >= 0, `${dir}: il handler non chiama rejectIfNotStaging`);
  for (const sensitive of ["createClient(", "req.json(", "req.method", "Deno.env.get("]) {
    const at = handler.indexOf(sensitive);
    if (at >= 0) {
      // l'unica Deno.env.get ammessa prima del controllo è dentro rejectIfNotStaging (altro file)
      assert(guardAt < at, `${dir}: rejectIfNotStaging deve venire prima di ${sensitive}`);
    }
  }
  assert(/if \(blocked\) return blocked;/.test(handler), `${dir}: il risultato del controllo deve interrompere il handler`);
}

// 3) Il modulo condiviso risponde 403 e non contiene segreti
const shared = fs.readFileSync(path.join(functionsDir, "_shared", "stagingOnly.ts"), "utf8");
assert(/status:\s*403/.test(shared), "rejectIfNotStaging deve rispondere 403");
assert(!/service_role|SERVICE_ROLE|eyJ/.test(shared), "stagingOnly.ts non deve contenere segreti");

console.log(`smoke functions staging-only contract passed (${smokeDirs.length} funzioni: ${smokeDirs.join(", ")})`);
