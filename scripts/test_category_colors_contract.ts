/**
 * Contract test: ogni categoria in constants/Interests.ts deve avere un colore esplicito in
 * CATEGORY_COLORS, e search.tsx non deve tornare ad avere una copia locale a mano dello switch
 * colore→categoria (era il caso prima di questo fix: getCategoryColors viveva come switch
 * duplicato in app/(volunteer)/(tabs)/search.tsx, unico consumer, senza nessun test che
 * impedisse a una nuova categoria di finire silenziosamente grigia — vedi CATEGORY_COLORS in
 * constants/Interests.ts per il dettaglio).
 *
 * Controlli statici sul codice sorgente (no Metro, no rendering React Native): constants/*.ts
 * importa icone da lucide-react-native, che a sua volta importa react-native — un `import`
 * runtime di questi file rompe sotto tsx/esbuild fuori da Metro. Stesso approccio di
 * scripts/test_skills_taxonomy_contract.ts.
 *
 * Run: npx tsx scripts/test_category_colors_contract.ts
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

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

function extractBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert(start !== -1, `marker "${startMarker}" non trovato`);
  const end = source.indexOf(endMarker, start);
  assert(end !== -1, `marker di fine "${endMarker}" non trovato dopo "${startMarker}"`);
  return source.slice(start, end);
}

const interestsSource = readSource("constants/Interests.ts");

function testEveryInterestHasAnExplicitColor() {
  console.log("\n[CATEGORY_COLORS] ogni categoria di INTERESTS ha un colore esplicito");

  const interestsBlock = extractBlock(interestsSource, "export const INTERESTS: InterestItem[] = [", "\n];");
  const interestIds = [...interestsBlock.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(interestIds.length > 0, "nessun id trovato in INTERESTS — regex/marker non combacia più con il file");

  const colorsBlock = extractBlock(
    interestsSource,
    "export const CATEGORY_COLORS: Record<string, CategoryColorPair> = {",
    "\n};"
  );
  const colorKeys = [...colorsBlock.matchAll(/^\s*([\w-]+):\s*\{\s*bg:/gm)].map((m) => m[1]);
  assert(colorKeys.length > 0, "nessuna chiave trovata in CATEGORY_COLORS — regex/marker non combacia più con il file");

  for (const id of interestIds) {
    assert(
      colorKeys.includes(id),
      `REGRESSIONE: la categoria con id "${id}" non ha una voce in CATEGORY_COLORS — finirebbe silenziosamente grigia (fallback)`
    );
  }
  pass(`tutte le ${interestIds.length} categorie (${interestIds.join(", ")}) hanno un colore assegnato`);

  for (const key of colorKeys) {
    assert(
      interestIds.includes(key),
      `CATEGORY_COLORS contiene la chiave "${key}" che non corrisponde a nessuna categoria in INTERESTS (voce orfana/refuso?)`
    );
  }
  pass("nessuna voce orfana in CATEGORY_COLORS");
}

function testGetCategoryColorsHasFallbackAndCaseInsensitiveLookup() {
  console.log("\n[getCategoryColors] fallback esplicito e ricerca case-insensitive");

  assert(
    interestsSource.includes("export const getCategoryColors"),
    "constants/Interests.ts deve esportare getCategoryColors()"
  );
  assert(
    interestsSource.includes("DEFAULT_CATEGORY_COLORS"),
    "getCategoryColors deve avere un fallback esplicito (DEFAULT_CATEGORY_COLORS), non un colore a caso per valori non riconosciuti"
  );
  assert(
    /\.toLowerCase\(\)/.test(interestsSource),
    "getCategoryColors deve normalizzare il valore in ingresso (case-insensitive: il valore salvato in activities.category può avere maiuscole diverse)"
  );
  pass("fallback esplicito e normalizzazione case-insensitive presenti");
}

function testSearchScreenHasNoLocalDuplicate() {
  console.log("\n[search.tsx] nessuna copia locale dello switch colore→categoria");

  const source = readSource("app/(volunteer)/(tabs)/search.tsx");

  assert(
    !/const getCategoryColors = \(/.test(source),
    "REGRESSIONE: app/(volunteer)/(tabs)/search.tsx definisce di nuovo una getCategoryColors locale — deve importarla da constants/Interests"
  );
  assert(
    /import\s*\{[^}]*getCategoryColors[^}]*\}\s*from\s*["'].*constants\/Interests["']/.test(source),
    "app/(volunteer)/(tabs)/search.tsx deve importare getCategoryColors da constants/Interests"
  );
  pass("search.tsx usa la funzione condivisa, nessuna copia locale");
}

function run() {
  console.log("Category colors contract tests");
  console.log("─".repeat(60));

  testEveryInterestHasAnExplicitColor();
  testGetCategoryColorsHasFallbackAndCaseInsensitiveLookup();
  testSearchScreenHasNoLocalDuplicate();

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sui colori delle categorie sono passati ✓");
}

run();
