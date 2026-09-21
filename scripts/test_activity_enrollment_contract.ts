import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const profileRest = readRepoFile("utils", "profileRest.ts");
const activityService = readRepoFile("services", "ActivityService.ts");
const activityMutations = readRepoFile("hooks", "activities", "mutations.ts");

const participantUpserts = profileRest.match(/\/rest\/v1\/activity_participants\?on_conflict=activity_id,user_id/g) ?? [];
assert(
  participantUpserts.length >= 1,
  "Activity enrollment writes must target the composite participant key explicitly"
);

assert(
  /void\s*\(\s*async\s*\(\)\s*=>/.test(activityService),
  "Activity chat sync fallback must stay outside the enrollment critical path"
);

assert(
  !/await\s+\(\s*async\s*\(\)\s*=>/.test(activityService),
  "Activity enrollment must not await best-effort chat group sync"
);

assert(
  /onSuccess:\s*\(_, variables\)\s*=>\s*\{\s*void invalidateActivityQueries/.test(activityMutations),
  "Activity enrollment mutation must not block success UI on query invalidation"
);

// Modello a due rami (decisione 21/09/2026): iscrizione ad attività immediata (nessuna approvazione)
// e candidatura all'ente con approvazione. Il vecchio ramo "candidatura ad attività con
// approvazione" è stato rimosso e non deve tornare.
const profileRestSrc = readRepoFile("utils", "profileRest.ts");
const volunteersScreen = readRepoFile("app", "(npo)", "(tabs)", "volunteers.tsx");
assert(
  !/submitActivityApplication|updateActivityApplicationStatus|useApplyToActivityMutation|useApproveActivityApplicationMutation|useRejectActivityApplicationMutation/.test(
    activityService + activityMutations + profileRestSrc + volunteersScreen
  ),
  "Il ramo 'candidatura ad attività con approvazione' è stato rimosso: l'iscrizione ad attività è immediata (REGISTERED), l'approvazione esiste solo per la candidatura all'ente"
);
assert(
  !/isActivity/.test(volunteersScreen),
  "La tab Candidature dell'ente gestisce solo candidature all'ente (niente ramo isActivity)"
);

console.log("PASS activity enrollment contract keeps signup idempotent and non-blocking");
