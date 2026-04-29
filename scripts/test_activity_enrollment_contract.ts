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
  participantUpserts.length >= 2,
  "Activity enrollment/application writes must target the composite participant key explicitly"
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

console.log("PASS activity enrollment contract keeps signup idempotent and non-blocking");
