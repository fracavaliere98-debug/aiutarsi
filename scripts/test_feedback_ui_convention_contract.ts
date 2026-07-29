import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

// ─────────────────────────────────────────────────────────────────────────
// 2026-07-24: convenzione feedback UI definita in docs/data-access-guidelines.md §5.
// showToast di default; Alert.alert riservato a conferme a scelta multipla o a un
// bottone con un vero onPress di continuazione; alert() nativo mai. Questo test
// copre i file corretti in questa sessione, non l'intero repo (l'audit dei restanti
// ~44 Alert.alert è un lavoro separato, elencato in docs/data-access-guidelines.md §7).
// ─────────────────────────────────────────────────────────────────────────

const filesThatMustNotUseNativeAlert = [
  ["app", "(volunteer)", "review-application.tsx"],
  ["app", "(npo)", "settings", "edit-profile.tsx"],
  ["app", "onboarding", "profile.tsx"],
  ["app", "(volunteer)", "settings", "security.tsx"],
];

for (const parts of filesThatMustNotUseNativeAlert) {
  const source = readRepoFile(...parts);
  const path = parts.join("/");
  // Match a bare alert( call that is not Alert.alert( or something.alert(
  const nativeAlertCalls = source.match(/[^.\w]alert\(/g) ?? [];
  assert(
    nativeAlertCalls.length === 0,
    `${path} non deve più usare alert() nativo (categoria 4, vietata) — usare showToast`
  );
}

// app/(volunteer)/settings/security.tsx: i 5 Alert.alert di validazione senza
// continuazione sono stati convertiti a showToast; il file non deve più importare
// Alert da react-native (nessun uso legittimo rimasto).
const volunteerSecurity = readRepoFile("app", "(volunteer)", "settings", "security.tsx");
assert(
  !/import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*["']react-native["']/.test(volunteerSecurity),
  "(volunteer)/settings/security.tsx non deve più importare Alert da react-native: tutti i suoi casi erano categoria 1 (showToast)"
);
assert(
  (volunteerSecurity.match(/showToast\(/g) ?? []).length >= 5,
  "(volunteer)/settings/security.tsx deve usare showToast per tutti gli esiti di validazione/errore"
);

// app/(npo)/settings/security.tsx resta il riferimento positivo: showToast per la
// validazione, Alert.alert SOLO per il caso con onPress reale (chiude la modalità
// di modifica email). Non deve regredire a Alert.alert generico per errori.
const npoSecurity = readRepoFile("app", "(npo)", "settings", "security.tsx");
assert(
  !/Alert\.alert\("Errore"/.test(npoSecurity),
  "(npo)/settings/security.tsx non deve reintrodurre Alert.alert('Errore', ...) generico: la validazione va con showToast (categoria 1)"
);
assert(
  /Alert\.alert\(\s*\n?\s*"Controlla la nuova email"/.test(npoSecurity),
  "(npo)/settings/security.tsx deve mantenere Alert.alert solo per il caso con onPress reale (chiude isEditingEmail) — categoria 3"
);

console.log("PASS feedback UI convention contract: showToast/Alert.alert/alert() applicati secondo le 4 categorie nei file auditati");
