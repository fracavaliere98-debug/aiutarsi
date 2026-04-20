import { spawnSync } from "node:child_process";

const suite = [
  { label: "notifications-routing", path: "scripts/test_notification_routing.ts" },
  { label: "stories-contract", path: "scripts/test_stories_contract.ts" },
  { label: "story-views-contract", path: "scripts/test_story_views_contract.ts" },
  { label: "gamification-contract", path: "scripts/test_gamification_contract.ts" },
  { label: "gamification-report", path: "scripts/test_volunteer_report.ts" },
];

for (const test of suite) {
  console.log(`\n[regression] ${test.label}`);

  const result = spawnSync("npx", ["-y", "tsx", test.path], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPASS regression suite completed");
