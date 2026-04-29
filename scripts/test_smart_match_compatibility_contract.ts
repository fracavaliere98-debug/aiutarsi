import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const allowedFiles = new Set([
  "types/index.ts",
  "services/ActivityService.ts",
  "hooks/smart-match/queries.ts",
  "utils/smartMatchCompatibility.ts",
  "scripts/test_smart_match_compatibility_contract.ts",
]);

const output = execFileSync("rg", ["-l", "matchPercentage", "app", "components", "hooks", "services", "utils", "types", "scripts"], {
  encoding: "utf8",
});

const files = output
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((file) => !allowedFiles.has(file));

if (files.length > 0) {
  console.error("matchPercentage compatibility boundary violated");
  for (const file of files) console.error(`- ${file}`);
  process.exit(1);
}

const typeFile = readFileSync(join("types", "index.ts"), "utf8");
if (!typeFile.includes("@deprecated Compatibility snapshot only")) {
  throw new Error("AppActivity.matchPercentage must remain explicitly deprecated");
}

console.log("PASS smart match compatibility boundary is enforced");
