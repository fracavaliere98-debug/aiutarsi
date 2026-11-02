/**
 * Contract test A47 (02/11/2026): la lista "tutte le attivita'" (useActivitiesListQuery) deve essere completa.
 * Molte schermate la filtrano per ente o per iscrizione: con il vecchio default di 50 risultati, ordinati per
 * compatibilita', le attivita' nuove di un ente finivano oltre il taglio e non comparivano.
 * Run: npx tsx scripts/test_activities_list_complete_contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
const ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const queries = read("hooks", "activities", "queries.ts");
assert(/export function useActivitiesListQuery[\s\S]{0,400}getActivities\(\{ userId, limit: ALL_ACTIVITIES_LIMIT \}\)/.test(queries),
  "useActivitiesListQuery deve chiedere la lista completa (ALL_ACTIVITIES_LIMIT), non il limite predefinito");

const service = read("services", "ActivityService.ts");
const limit = Number((service.match(/export const ALL_ACTIVITIES_LIMIT = (\d+);/) || [])[1]);
assert(limit >= 500, "ALL_ACTIVITIES_LIMIT deve coprire tutte le attivita' del pilota");
assert(/const HYDRATION_CHUNK_SIZE = (\d+);/.test(service) && Number(service.match(/const HYDRATION_CHUNK_SIZE = (\d+);/)![1]) <= 150,
  "Competenze e iscritti si caricano a blocchi (id nell'URL)");
assert(/idChunks\.map\(\(chunk\) => profileRest\.listActivitySkills\(chunk/.test(service) && /idChunks\.map\(\(chunk\) => profileRest\.listActivityParticipants\(chunk/.test(service),
  "Nessuna richiesta con tutti gli id insieme");

// La lista generale esclude le annullate: la schermata Attivita' dell'ente (scheda "Annullate") legge le
// proprie attivita' per npo_id, annullate comprese.
const ownQuery = read("hooks", "activities", "queries.ts");
assert(/NPO_OWN_ACTIVITY_STATUSES = \[[^\]]*"CANCELLATA"/.test(ownQuery), "useNpoOwnActivitiesQuery include le annullate");
assert(/useNpoOwnActivitiesQuery[\s\S]{0,400}npoId,\s*limit: ALL_ACTIVITIES_LIMIT/.test(ownQuery), "useNpoOwnActivitiesQuery legge per ente, senza taglio");
const projects = read("app", "(npo)", "(tabs)", "projects.tsx");
assert(/useNpoOwnActivitiesQuery\(user\?\.id\)/.test(projects) && !/useActivitiesDomain\(/.test(projects), "La schermata Attivita' dell'ente non usa la lista generale");

console.log("activities-list-complete-contract: ok");
