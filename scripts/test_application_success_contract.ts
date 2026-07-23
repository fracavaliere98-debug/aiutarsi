import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readRepoFile(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

const successScreen = readRepoFile("app", "(volunteer)", "application-success.tsx");

// NPO-level applications (type !== "ACTIVITY") must point to "Le Mie Candidature",
// never to "Le Mie Attività" — that label/route is reserved for activity enrollments.
assert(
  /Puoi monitorare lo stato in\{"\\n"\}<Text className="font-bold">&quot;Le Mie Candidature&quot;<\/Text>/.test(successScreen),
  "NPO application confirmation hint must reference 'Le Mie Candidature', not 'Le Mie Attività'"
);

assert(
  !/Puoi monitorare lo stato in\{"\\n"\}<Text className="font-bold">&quot;Le Mie Attività&quot;<\/Text>/.test(successScreen),
  "NPO application confirmation hint must no longer reference 'Le Mie Attività'"
);

// The secondary CTA must branch on isActivity: activity enrollments keep going to the
// calendar tab, NPO-level applications must go to the volunteer's own profile (where
// ApplicationSection / 'Le mie candidature' is rendered), not the calendar.
assert(
  /isActivity\s*\?\s*"\/\(volunteer\)\/\(tabs\)\/calendar" as any\s*:\s*"\/\(volunteer\)\/\(tabs\)\/profile" as any/.test(
    successScreen.replace(/\s+/g, " ")
  ),
  "Secondary CTA must navigate to the calendar tab for activity enrollments and to the profile tab (Le mie candidature) for NPO applications"
);

assert(
  /\{isActivity \? "Vedi le mie attività" : "Vedi le mie candidature"\}/.test(successScreen),
  "Secondary CTA label must switch to 'Vedi le mie candidature' for NPO-level applications"
);

// The volunteer's own profile screen must still render ApplicationSection (Le mie
// candidature) so the navigation target above is actually correct.
const volunteerProfileView = readRepoFile("components", "VolunteerProfileView.tsx");
assert(
  /isOwnProfile\s*&&\s*<ApplicationSection/.test(volunteerProfileView),
  "VolunteerProfileView must render ApplicationSection ('Le mie candidature') on the volunteer's own profile"
);

console.log("PASS application success screen routes NPO-level applications to 'Le mie candidature'");
