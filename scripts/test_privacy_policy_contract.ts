/**
 * A26 P8 (27/10/2026, esteso 02/11/2026): la privacy policy e i Termini in app devono descrivere quello che l'app fa davvero.
 * Controlla anche: SDK in package.json, permessi in app.json, colonne di profiles, Sentry solo id, coerenza policy/Termini.
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

// Sentry (decisione 02/11/2026): riceve solo l'id tecnico. Se il codice aggiunge email, nome o altri
// campi a Sentry.setUser, il test fallisce: o si toglie il campo, o si cambia la decisione e la policy.
const monitoring = read("utils", "monitoring.ts");
const setUserCalls = [...monitoring.matchAll(/Sentry\.setUser\(([^)]*)\)/g)].map((m) => m[1].trim());
for (const arg of setUserCalls) {
  if (arg === "null") continue;
  assert(/^\{\s*id:\s*user\.id\s*,?\s*\}$/.test(arg), `Sentry.setUser must send only the id (found: ${arg})`);
}
assert(/Sentry riceve[^.]*solo il tuo identificativo[^.]*non la tua email né il tuo nome/.test(policy),
  "The privacy policy must say that Sentry receives only the identifier, not email or name");
assert(!/sendDefaultPii:\s*true/.test(monitoring), "Sentry.init must keep sendDefaultPii: false");

// Dati inviati a Google: la policy non deve promettere piu' di quello che facciamo
const embedding = read("supabase", "functions", "generate-embedding", "index.ts");
if (/Bio: \$\{record\.bio/.test(embedding)) {
  assert(/presentazione, i tuoi interessi e le tue competenze/.test(policy), "Embedding sends bio, interests and skills: the policy must say so");
}

// SDK dell'app che mandano dati a terzi: se compare nel package.json deve essere nominato nella policy
const pkg = JSON.parse(read("package.json"));
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } as Record<string, string>;
const sdkProviders: [string, RegExp, string][] = [
  ["@sentry/react-native", /Sentry/, "Sentry"],
  ["expo-notifications", /Expo/, "Expo (notifiche)"],
  ["expo-updates", /Expo/, "Expo (aggiornamenti)"],
  ["react-native-maps", /mappe di Apple o di Google/, "mappe Apple/Google"],
  ["@react-native-firebase/app", /Firebase/, "Firebase"],
  ["react-native-google-mobile-ads", /pubblicit/, "pubblicita'"],
  ["expo-tracking-transparency", /pubblicit/, "tracciamento"],
  ["@amplitude/analytics-react-native", /Amplitude/, "Amplitude"],
  ["posthog-react-native", /PostHog/, "PostHog"],
  ["mixpanel-react-native", /Mixpanel/, "Mixpanel"],
];
for (const [dep, inPolicy, label] of sdkProviders) {
  if (deps[dep]) assert(inPolicy.test(policy), `package.json has ${dep}: the privacy policy must name ${label}`);
}

// Permessi dichiarati in app.json: ognuno va spiegato nella policy
const appJson = JSON.parse(read("app.json")).expo;
const infoPlist = Object.keys(appJson?.ios?.infoPlist ?? {});
const permissionToPolicy: [RegExp, RegExp, string][] = [
  [/^NSLocation/, /posizione/, "posizione"],
  [/^NSCameraUsage/, /fotocamera/, "fotocamera"],
  [/^NSPhotoLibrary/, /galleria/, "galleria"],
  [/^NSCalendars/, /calendario/, "calendario"],
  [/^NSUserNotifications/, /notifiche/, "notifiche"],
];
for (const [keyRe, policyRe, label] of permissionToPolicy) {
  if (infoPlist.some((k) => keyRe.test(k))) assert(policyRe.test(policy), `app.json declares the ${label} permission: the privacy policy must explain it`);
}

// Colonne di profiles: ogni colonna nuova costringe a decidere se la policy va aggiornata.
// Dopo aver controllato (e aggiornato app/privacy-policy.tsx se serve) aggiungi la colonna qui sotto.
const REVIEWED_PROFILE_COLUMNS = new Set([
  "allow_calls", "avatar_url", "ban_reason", "ban_report_id", "bio", "company_name", "created_at",
  "date_of_birth", "email", "email_confirmed", "embedding", "expo_push_token", "full_name", "gender",
  "id", "impact_points", "is_banned", "is_verified", "last_seen_at", "location_coords", "location_lat",
  "location_lng", "location_string", "npo_name", "phone", "profile_completed", "public_email", "role",
  "show_email", "show_volunteering_history", "updated_at", "volunteer_list_visible", "website",
]);
const typesSource = read("types", "supabase.ts");
const rowStart = typesSource.indexOf("profiles: {");
const rowBlock = typesSource.slice(typesSource.indexOf("Row: {", rowStart), typesSource.indexOf("Insert: {", rowStart));
const profileColumns = [...rowBlock.matchAll(/^\s{10}([a-z_]+)\??:/gm)].map((m) => m[1]);
assert(profileColumns.length > 20, "Could not parse the columns of profiles in types/supabase.ts");
const unreviewed = profileColumns.filter((c) => !REVIEWED_PROFILE_COLUMNS.has(c));
assert(unreviewed.length === 0,
  `New columns in profiles not reviewed for the privacy policy: ${unreviewed.join(", ")}. Check app/privacy-policy.tsx and components/legal/TermsContent.tsx, then add them to REVIEWED_PROFILE_COLUMNS`);

// Data della policy: formato valido e non nel futuro
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
function parseItalianDate(text: string, label: string): Date {
  const m = text.match(/(\d{1,2}) ([A-Za-z]+) (\d{4})/);
  assert(m, `${label}: date not found`);
  const month = MONTHS.indexOf(m[2].toLowerCase());
  assert(month >= 0, `${label}: unknown month ${m[2]}`);
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}
const policyDate = parseItalianDate(policy.match(/PRIVACY_POLICY_LAST_UPDATE = '([^']+)'/)?.[1] ?? "", "PRIVACY_POLICY_LAST_UPDATE");
assert(policyDate.getTime() <= Date.now() + 86_400_000, "PRIVACY_POLICY_LAST_UPDATE is in the future");

// Termini e Condizioni: stessi fatti della policy, nessun testo di lavoro visibile all'utente
const terms = read("components", "legal", "TermsContent.tsx");
for (const [needle, label] of [
  [/almeno 18 anni/, "eta' minima 18 anni"],
  [/Profilo pubblico/, "impostazione profilo pubblico"],
  [/«Marta B\.»/, "esempio del nome mascherato"],
  [/Seguire un ente non mostra il tuo profilo/, "il follow non sblocca il profilo"],
  [/Google \(Gemini\)/, "controlli automatici con Google (Gemini)"],
  [/30 giorni/, "cancellazione account dopo 30 giorni"],
  [/Informativa sulla Privacy/, "rinvio all'informativa privacy"],
  [/aiutarsi\.it@gmail\.com|CONTACT_EMAIL/, "contatto"],
  [/volontari, enti non profit e aziende partner/, "i Termini valgono per volontari, enti e aziende"],
  [/Se sei un ente o un'azienda/, "regole di visibilita' per enti e aziende"],
  [/7\. Regole per enti e aziende/, "sezione dedicata a enti e aziende"],
  [/TERMS_VERSION = "\d{4}-\d{2}-\d{2}"/, "versione dei Termini"],
] as const) {
  assert(needle.test(terms), `Terms must mention: ${label}`);
}
assert(!/repository|prima della pubblicazione|avvocato/i.test(terms), "Terms must not contain internal drafting notes");
const termsDate = parseItalianDate(terms.match(/TERMS_LAST_UPDATE = "([^"]+)"/)?.[1] ?? "", "TERMS_LAST_UPDATE");
assert(termsDate.getTime() <= Date.now() + 86_400_000, "TERMS_LAST_UPDATE is in the future");
// Coerenza di fatti con la policy
assert(/PRIVACY_CONTACT_EMAIL = 'aiutarsi\.it@gmail\.com'/.test(policy) && /CONTACT_EMAIL = "aiutarsi\.it@gmail\.com"/.test(terms), "Policy and Terms must use the same contact email");
assert(/dopo che agisci verso di lui/.test(policy) && /dopo che agisci verso di lui/.test(terms), "Policy and Terms must describe the same unlock rule for NPO");
// Campi aperti ammessi solo nelle sezioni 1 (titolare) e 18 (foro): task "Titolare del trattamento"
const openFields = [...terms.matchAll(/title: "(\d+)\.[^"]*",\s*paragraphs: \[([\s\S]*?)\n    \],/g)]
  .filter((m) => /\[DA COMPLETARE\]/.test(m[2])).map((m) => m[1]);
assert(openFields.every((n) => n === "1" || n === "18"), `[DA COMPLETARE] outside sections 1 and 18 of the Terms (found in: ${openFields.join(", ")})`);
if (openFields.length) console.warn(`privacy-policy-contract: WARNING ${openFields.length} sezioni dei Termini hanno ancora [DA COMPLETARE] (task Titolare del trattamento)`);

console.log("privacy-policy-contract: ok");
