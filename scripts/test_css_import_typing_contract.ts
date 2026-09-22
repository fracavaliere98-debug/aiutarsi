/**
 * Regression test per un bug reale trovato il 2026-09-22 in CI (mai in
 * locale): `npx tsc --noEmit` falliva SEMPRE in CI con
 * "TS2882: Cannot find module or type declarations for side-effect import
 * of '../global.css'" su app/_layout.tsx, ma passava sempre in locale.
 *
 * Causa: l'unica dichiarazione `declare module '*.css'` del progetto viveva
 * in node_modules/expo/types/global.d.ts, raggiunta solo tramite
 * expo-env.d.ts — che è un file GENERATO e in .gitignore (rigenerato da
 * `npx expo`/dal dev server, mai committato). In locale capitava già
 * rigenerato su disco da comandi precedenti, mascherando il problema; in CI
 * (checkout pulito + npm ci, nessun comando Expo CLI prima di tsc) non
 * esiste mai. Riprodotto rinominando expo-env.d.ts in locale: l'errore
 * compare identico. La catena di tipi di NativeWind (nativewind/types ->
 * react-native-css-interop/types) NON fornisce questa dichiarazione: fa solo
 * l'augmentation delle prop `className` sui componenti RN — non è un
 * sostituto.
 *
 * Fix: `declare module "*.css";` aggiunto a nativewind-env.d.ts (file
 * effettivamente tracciato in git, già incluso da tsconfig.json). Questo
 * test verifica che resti lì, staticamente — non dipende da uno stato di
 * node_modules o da file generati, quindi non può dare un falso verde per
 * lo stesso motivo per cui il bug originale è sfuggito finora.
 *
 * Run: npx tsx scripts/test_css_import_typing_contract.ts
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

console.log("CSS side-effect import typing contract (2026-09-22)");
console.log("────────────────────────────────────────────────────────────\n");

const nativewindEnv = read("nativewind-env.d.ts");
assert(
  /declare module ["']\*\.css["'];?/.test(nativewindEnv),
  "nativewind-env.d.ts deve dichiarare `declare module \"*.css\";` — senza questo, " +
    "`import \"../global.css\"` in app/_layout.tsx tipizza solo grazie a expo-env.d.ts, " +
    "che è generato e gitignored: presente in locale (falso verde), assente in CI (TS2882)."
);
pass("nativewind-env.d.ts dichiara *.css");

// La dichiarazione deve vivere in un file TRACCIATO in git, non in uno
// gitignored — altrimenti il test stesso darebbe un falso verde in locale
// per lo stesso identico motivo del bug originale.
const trackedFiles = execSync("git ls-files nativewind-env.d.ts", { cwd: REPO_ROOT }).toString().trim();
assert(trackedFiles === "nativewind-env.d.ts", "nativewind-env.d.ts deve essere tracciato in git (non gitignored)");
pass("nativewind-env.d.ts è tracciato in git (non dipende da un file generato)");

console.log("\n────────────────────────────────────────────────────────────");
console.log("CSS import typing contract: PASS ✓");
