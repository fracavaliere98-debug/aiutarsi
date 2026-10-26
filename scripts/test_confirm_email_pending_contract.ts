/**
 * Schermata "Controlla la tua email" (2026-10-26): il link di conferma riapre l'app su /confirm-email senza email
 * e senza ruolo, quindi la schermata mostrava "indirizzo email non disponibile" e "Reinvia email" / "Ho gia
 * confermato" non funzionavano. L'email arrivata dalla registrazione/login viene tenuta da parte e riletta.
 * Controlli statici (no DB).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const screen = readFileSync(join(process.cwd(), "app", "(auth)", "confirm-email.tsx"), "utf8");

assert(/PENDING_CONFIRMATION_KEY/.test(screen), "Pending confirmation email must be stored under a shared key");
assert(/setItem\(PENDING_CONFIRMATION_KEY/.test(screen), "Email and role from the route params must be saved");
assert(/getItem\(PENDING_CONFIRMATION_KEY/.test(screen), "Email must be read back when the route has no params");
assert(/const email = paramEmail \|\| pending\.email/.test(screen), "Email falls back to the saved one");
assert(/const role = paramRole \|\| pending\.role/.test(screen), "Role falls back to the saved one");
assert(/removeItem\(PENDING_CONFIRMATION_KEY/.test(screen), "Saved email is removed once the user is signed in");

for (const f of ["login.tsx", join("register", "volunteer.tsx"), join("register", "npo.tsx"), join("register", "corporate.tsx")]) {
  const src = readFileSync(join(process.cwd(), "app", "(auth)", f), "utf8");
  assert(/pathname: "\/confirm-email"[\s\S]{0,200}email:/.test(src), `${f} must pass the email to /confirm-email`);
}

// Guardia di navigazione: l'onboarding parte sempre da "intro" (Gemma), per tutti i ruoli e da ogni rotta.
const rootLayout = readFileSync(join(process.cwd(), "app", "_layout.tsx"), "utf8");
assert(!/\/onboarding\/interests/.test(rootLayout), "Root guard must not route straight to /onboarding/interests (skips the Gemma intro)");
assert(/navigate\("\/onboarding\/intro"\)/.test(rootLayout), "Incomplete-profile guard must route to /onboarding/intro");

console.log("confirm-email-pending-contract: ok");
