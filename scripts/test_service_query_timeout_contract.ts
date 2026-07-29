import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function countOccurrences(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

// ─────────────────────────────────────────────────────────────────────────
// 2026-07-24 (continuazione): estensione del pattern withTimeout (già validato
// in AuthService per il bug "profilo ente in caricamento continuo") ai service
// che facevano query dirette a Supabase senza nessuna protezione da hang.
// Questo test verifica che il fix sia rimasto alla fonte (dentro i service),
// non un cerotto rimosso alla prima refactor.
// ─────────────────────────────────────────────────────────────────────────

const activityService = readRepoFile("services", "ActivityService.ts");
const chatService = readRepoFile("services", "ChatService.ts");
const npoService = readRepoFile("services", "NPOService.ts");
const profileService = readRepoFile("services", "ProfileService.ts");
const reportService = readRepoFile("services", "ReportService.ts");
const volunteerReportService = readRepoFile("services", "VolunteerReportService.ts");
const smartMatchPreferencesService = readRepoFile("services", "SmartMatchPreferencesService.ts");

// [ActivityService] le query bloccanti sul percorso critico (dettaglio attività,
// creazione/modifica/cancellazione, recensioni, ricerca per raggio) sono avvolte
// in this._withTimeout, non solo le due chiamate storiche.
const activityWithTimeoutCalls = countOccurrences(activityService, /this\._withTimeout\(/g);
assert(
  activityWithTimeoutCalls >= 15,
  `ActivityService deve avvolgere le query bloccanti principali in this._withTimeout (trovate ${activityWithTimeoutCalls}, attese >= 15)`
);
assert(
  /async getActivityById[\s\S]{0,200}this\._withTimeout\(/.test(activityService),
  "getActivityById (dettaglio attività, stessa area del bug profilo ente) deve usare this._withTimeout"
);
assert(
  /_withTimeout<T>\(promise: PromiseLike<T>/.test(activityService),
  "ActivityService._withTimeout deve accettare PromiseLike<T> (i query builder Supabase non sono Promise nativi)"
);

// [ChatService] il caso concreto trovato: approvare una candidatura ad attività
// chiama updateActivityApplicationStatus -> startGroupConversation, e se una
// query Supabase lì dentro resta bloccata, l'intera approvazione non risolve mai
// (anche se la scrittura REST principale era già andata a buon fine).
const chatWithTimeoutCalls = countOccurrences(chatService, /this\._withTimeout\(/g);
assert(
  chatWithTimeoutCalls >= 8,
  `ChatService deve avvolgere le query bloccanti (startGroupConversation, deleteMessage, block/unblock, getBlockedUserIds) in this._withTimeout (trovate ${chatWithTimeoutCalls}, attese >= 8)`
);
assert(
  /async startGroupConversation[\s\S]{0,3000}this\._withTimeout\([\s\S]{0,3000}sync_group_conversation_participants/.test(chatService),
  "startGroupConversation deve avvolgere tutte le sue query, inclusa la RPC finale di sync, in this._withTimeout"
);
assert(
  /_withTimeout<T>\(promise: PromiseLike<T>/.test(chatService),
  "ChatService._withTimeout deve accettare PromiseLike<T>"
);

// [NPOService] follow/unfollow/isFollowing/getFollowers ora protette; getNPOProfile
// (dead code duplicava esattamente il bug select('*')+nessun timeout già fixato in
// AuthService) è stato rimosso, non solo lasciato lì come trappola per il futuro.
assert(
  /import \{ withTimeout \} from '\.\.\/utils\/withTimeout'/.test(npoService),
  "NPOService deve importare il pattern condiviso utils/withTimeout"
);
assert(
  countOccurrences(npoService, /withTimeout\(/g) >= 4,
  "NPOService deve avvolgere followNPO/unfollowNPO/isFollowing/getFollowers in withTimeout"
);
assert(
  !/getNPOProfile/.test(npoService),
  "NPOService.getNPOProfile (dead code, mai chiamato, duplicava il bug select('*')+nessun timeout) deve restare rimosso"
);

// [ProfileService] richiesta/annullamento cancellazione account (azione utente
// diretta da bottone, doveva restare senza timeout mentre AuthService veniva già
// protetto altrove).
assert(
  /import \{ withTimeout \} from '\.\.\/utils\/withTimeout'/.test(profileService),
  "ProfileService deve importare utils/withTimeout"
);
assert(
  countOccurrences(profileService, /withTimeout\(/g) >= 2,
  "ProfileService deve avvolgere requestAccountDeletion e cancelAccountDeletion in withTimeout"
);

// [ReportService] / [VolunteerReportService] le query che alimentano i report
// NPO/volontario (schermata che poteva restare a caricare all'infinito) sono
// protette.
assert(
  /import \{ withTimeout \} from '\.\.\/utils\/withTimeout'/.test(reportService),
  "ReportService deve importare utils/withTimeout"
);
assert(
  countOccurrences(reportService, /withTimeout[<(]/g) >= 4,
  "ReportService.getNPOReportSummary deve avvolgere le sue 4 query (followers, posts, story metrics, reactions) in withTimeout"
);
assert(
  /import \{ withTimeout \} from '\.\.\/utils\/withTimeout'/.test(volunteerReportService),
  "VolunteerReportService deve importare utils/withTimeout"
);
assert(
  /withTimeout\(/.test(volunteerReportService),
  "VolunteerReportService.getVolunteerReportSummary deve avvolgere la query followers in withTimeout"
);

// [SmartMatchPreferencesService] verificato che è un FALSO POSITIVO rispetto al
// resto dell'audit: usa solo AsyncStorage, zero chiamate Supabase — non va
// toccato, altrimenti si aggiunge codice morto/inutile.
assert(
  !/from\s+'\.\.\/utils\/supabase'/.test(smartMatchPreferencesService) &&
  !/supabase\.(from|rpc|auth)/.test(smartMatchPreferencesService),
  "SmartMatchPreferencesService non deve usare Supabase: è puro AsyncStorage, non è affetto dal bug 'caricamento infinito'"
);

console.log("PASS service query timeout contract: withTimeout esteso ai service critici, dead code rimosso, falso positivo escluso");
