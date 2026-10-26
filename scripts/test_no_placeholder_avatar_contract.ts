/**
 * 2026-10-26 — Un utente senza foto deve mostrare le iniziali (UserAvatar), mai la foto di uno sconosciuto.
 * NPOService metteva https://i.pravatar.cc/150?img=11 a chi non aveva avatar_url: in "Volontari Attivi"
 * l'ente vedeva un volto finto. Controllo statico su tutto il codice dell'app.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "services", "hooks", "context", "utils", "shared"];
const FORBIDDEN = /pravatar\.cc|randomuser\.me|thispersondoesnotexist/i;

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

const files: string[] = [];
for (const root of ROOTS) walk(join(process.cwd(), root), files);
const offenders = files.filter((f) => FORBIDDEN.test(readFileSync(f, "utf8")));
if (offenders.length > 0) {
  throw new Error(`Placeholder avatar of a real-looking person found in: ${offenders.join(", ")}`);
}
console.log(`no-placeholder-avatar-contract: ok (${files.length} file)`);
