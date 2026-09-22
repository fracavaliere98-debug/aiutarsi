/**
 * Regression test per un crash reale su device, riprodotto due volte in
 * schermate scollegate tra loro (app/(volunteer)/(tabs)/calendar.tsx e
 * app/feedback/[id].tsx) il 2026-09-22:
 *
 *   ERROR [Error: Couldn't find a navigation context. Have you wrapped
 *   your app with 'NavigationContainer'? ...]
 *
 * Causa reale (letta nel codice installato, non ipotizzata): il messaggio
 * è fuorviante. `expo-router` vendorizza react-navigation internamente
 * (node_modules/expo-router/build/react-navigation/...) e il suo
 * `NavigationStateContext.js` dà al valore di default del context dei
 * getter (`getKey`, `setKey`, `getState`, ...) che LANCIANO questo errore
 * se letti fuori da un vero Navigator — comportamento intenzionale, per
 * segnalare un uso scorretto dei hook di react-navigation.
 *
 * Il vero colpevole è `react-native-css-interop` (dipendenza transitiva di
 * nativewind, versione 0.2.7): la sua utility di debug
 * `printUpgradeWarning` -> `stringify` (dist/runtime/native/render-component.js)
 * costruisce un messaggio di warning per la console facendo
 * `Object.entries(value)` in modo ricorsivo e SENZA try/catch. Quando uno
 * dei valori raggiungibili dalle props del componente contiene (o è) uno di
 * questi oggetti context con getter "a trappola", `Object.entries` li
 * innesca e l'eccezione non viene gestita da nessuno: crash dell'intera
 * schermata invece di un semplice warning in console. Bug upstream
 * confermato e non risolto in nativewind 4.2.7 (l'ultima stabile a questa
 * data) e ancora aperto nelle preview di v5:
 * https://github.com/nativewind/nativewind/issues/1536
 * https://github.com/nativewind/nativewind/issues/1711
 * I maintainer collegano il trigger a utility class come shadow-*,
 * opacity-*, e le scorciatoie colore/opacità (bg-x/NN, text-x/NN); nel
 * nostro codice sono usate ovunque (~350 occorrenze in app/ e components/),
 * quindi sistemare ogni call site non è praticabile: la fix corretta è alla
 * fonte del bug, non nei nostri componenti.
 *
 * Fix: patch via patch-package (patches/react-native-css-interop+0.2.7.patch)
 * che rende `stringify` a prova di eccezione (try/catch attorno a
 * Object.entries e ad ogni singola proprietà, con fallback
 * "[Unserializable]" invece di propagare). Nessuna classe NativeWind
 * dell'app è stata toccata: zero cambi visivi, solo il logging di debug
 * diventa crash-safe. package.json ha ora `"postinstall": "patch-package"`
 * e patch-package è in devDependencies.
 *
 * Questo test è statico: verifica che il file patchato in node_modules
 * contenga davvero la fix (altrimenti un reinstall che non applica la
 * patch — es. `npm ci` prima di aver aggiornato il lockfile — passerebbe
 * silenziosamente inosservato) e che l'infrastruttura patch-package sia
 * correttamente configurata in package.json.
 *
 * Run: npx tsx scripts/test_css_interop_stringify_patch_contract.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

console.log("react-native-css-interop stringify crash-safety patch contract (2026-09-22)");
console.log("────────────────────────────────────────────────────────────\n");

const pkg = JSON.parse(read("package.json"));
assert(
  pkg.scripts?.postinstall === "patch-package",
  'package.json deve avere "postinstall": "patch-package", altrimenti la patch non si applica dopo npm install'
);
pass('package.json: postinstall = "patch-package"');

assert(
  typeof pkg.devDependencies?.["patch-package"] === "string",
  "patch-package deve essere in devDependencies"
);
pass("patch-package è in devDependencies");

const patchPath = join(REPO_ROOT, "patches", "react-native-css-interop+0.2.7.patch");
assert(existsSync(patchPath), "deve esistere patches/react-native-css-interop+0.2.7.patch");
const patchContent = readFileSync(patchPath, "utf8");
assert(
  /render-component\.js/.test(patchContent) && /Unserializable/.test(patchContent),
  "il file di patch deve toccare render-component.js e introdurre il fallback [Unserializable]"
);
pass("patches/react-native-css-interop+0.2.7.patch esiste ed è quella giusta");

// Verifica anche che la patch sia REALMENTE applicata nel node_modules
// installato ora — non solo presente su disco come file .patch inerte.
const installedPath = join(
  REPO_ROOT,
  "node_modules",
  "react-native-css-interop",
  "dist",
  "runtime",
  "native",
  "render-component.js"
);
if (existsSync(installedPath)) {
  const installed = readFileSync(installedPath, "utf8");
  assert(
    /try\s*\{\s*entries = Object\.entries\(value\);/.test(installed) &&
      /"\[Unserializable\]"/.test(installed),
    "node_modules/react-native-css-interop/.../render-component.js non ha la patch applicata: " +
      "esegui `npm install` (non `npm ci`, finché il lockfile non è aggiornato) per applicarla via postinstall"
  );
  pass("la patch è effettivamente applicata nel node_modules installato ora");

  // Regressione reale osservata il 2026-09-22: la prima revisione della patch
  // (solo try/catch, senza limite di profondità/nodi) trasformava il crash in
  // un freeze — props reachable da un componente (es. `children`, elementi
  // React con `_owner`/`_source`) possono incatenarsi fino a risalire l'intero
  // fiber tree; senza un budget, il walk continuava all'infinito (o quasi)
  // invece di abortire subito sulla prima eccezione. La revisione 2 aggiunge
  // un limite di profondità E un budget di nodi visitati, oltre al try/catch.
  assert(
    /MAX_DEPTH/.test(installed) && /MAX_NODES|nodeBudget/.test(installed),
    "la patch deve limitare anche profondità e numero di nodi visitati (non solo intercettare le eccezioni), " +
      "altrimenti un oggetto enorme/circolare raggiungibile dalle props può bloccare l'app invece di farla crashare"
  );
  pass("la patch limita profondità e nodi visitati, non solo le eccezioni (fix del freeze del 2026-09-22)");
} else {
  console.log("  (node_modules/react-native-css-interop non presente in questo ambiente: salto la verifica a runtime)");
}

console.log("\n────────────────────────────────────────────────────────────");
console.log("Patch contract: PASS ✓");
