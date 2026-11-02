/**
 * Contract test (02/11/2026): l'avviso "attivita' con pochi iscritti" della home dell'ente porta all'invito,
 * non al report (decisione di Francesco). Una attivita': scheda con "Invita i tuoi volontari" gia' aperto.
 * Piu' attivita': elenco con l'invito per ognuna; entro 48 ore anche i follower (D08).
 * Run: npx tsx scripts/test_low_coverage_invite_contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LAST_MINUTE_HOURS, inviteFollowersRoute, inviteVolunteersHref, isLastMinute } from "../components/npo/lowCoverageLogic";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const now = new Date("2026-11-02T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
assert(LAST_MINUTE_HOURS === 48, "Stessa finestra del Salvataggio Last Minute (48 ore)");
assert(isLastMinute(inHours(5), now) && isLastMinute(inHours(47), now), "Entro 48 ore: last minute");
assert(!isLastMinute(inHours(49), now) && !isLastMinute(inHours(-1), now) && !isLastMinute(undefined, now), "Oltre 48 ore, gia' iniziata o senza data: no");
assert(inviteVolunteersHref("abc") === "/activity/abc?invite=volunteers", "Link alla scheda con l'invito aperto");
assert(inviteFollowersRoute("abc").params.tab === "FOLLOWERS" && inviteFollowersRoute("abc").params.activityMatch === "abc", "Follower: tab Follower con l'attivita'");

const home = read("app", "(npo)", "(tabs)", "index.tsx");
const banner = home.slice(home.indexOf("{lowCoverageCount > 0 && ("), home.indexOf('testID="npo-dashboard-low-coverage"'));
assert(banner.length > 0 && !/\/\(npo\)\/report/.test(banner), "L'avviso pochi iscritti non porta piu' al report (le card statistiche si')");
assert(/inviteVolunteersHref\(lowCoverageActivities\[0\]\.id\)/.test(home) && /<LowCoverageActivitiesModal/.test(home), "Una attivita': invito diretto; piu' attivita': elenco");
assert(/Tocca per invitare i tuoi volontari\./.test(home), "Il testo dell'avviso dice cosa succede");

const detail = read("app", "activity", "[id].tsx");
assert(/invite === 'volunteers' && canInviteSuggested && !autoOpenedInvite\.current/.test(detail), "La scheda apre l'invito solo per l'ente proprietario e una volta sola");

const modal = read("components", "npo", "LowCoverageActivitiesModal.tsx");
assert(/ScrollView style=\{\{ maxHeight: \d+ \}\}/.test(modal), "ScrollView nel popup con maxHeight numerico");
assert(/\{lastMinute && \(/.test(modal), "L'invito ai follower compare solo entro 48 ore");
assert(!/#[0-9a-fA-F]{3,6}/.test(modal), "Niente colori scritti a mano: token del tema");

console.log("low-coverage-invite-contract: ok");
