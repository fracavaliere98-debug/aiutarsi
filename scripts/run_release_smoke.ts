import { spawnSync } from "node:child_process";

type Step = {
  section: "static" | "tooling" | "regression" | "staging smoke";
  label: string;
  command: string;
  args: string[];
  runWhen?: () => boolean;
  blocking?: () => boolean;
};

const args = new Set(process.argv.slice(2));
const skipStaging = args.has("--skip-staging");
const strict = args.has("--strict") || process.env.CI === "1" || process.env.CI === "true";

function runStep(step: Step) {
  if (step.runWhen && !step.runWhen()) {
    console.log(`[skip] ${step.section}: ${step.label}`);
    return true;
  }

  console.log(`\n[${step.section}] ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: false,
  });

  const ok = result.status === 0;
  if (!ok && step.blocking?.() === false) {
    console.warn(`[warn] ${step.label} failed but is non-blocking in this mode`);
    return true;
  }

  return ok;
}

const steps: Step[] = [
  {
    section: "static",
    label: "worktree clean",
    command: "git",
    args: ["diff", "--quiet"],
    blocking: () => strict,
  },
  {
    section: "static",
    label: "env contract",
    command: "npx",
    args: ["-y", "tsx", "scripts/validate_env_contract.ts", ...(skipStaging ? [] : ["--staging"])],
  },
  { section: "static", label: "lint", command: "npm", args: ["run", "lint"] },
  { section: "static", label: "typecheck", command: "npx", args: ["tsc", "--noEmit", "--pretty", "false"] },
  { section: "tooling", label: "expo doctor", command: "npx", args: ["-y", "expo-doctor"] },
  { section: "regression", label: "regression suite", command: "npm", args: ["run", "test:regression"] },
  {
    section: "staging smoke",
    label: "chat",
    command: "npm",
    args: ["run", "smoke:chat:staging"],
    runWhen: () => !skipStaging,
  },
  {
    section: "staging smoke",
    label: "activities",
    command: "npm",
    args: ["run", "smoke:activities:staging"],
    runWhen: () => !skipStaging,
  },
  {
    section: "staging smoke",
    label: "notifications",
    command: "npm",
    args: ["run", "smoke:notifications:staging"],
    runWhen: () => !skipStaging,
  },
  {
    section: "staging smoke",
    label: "stories",
    command: "npm",
    args: ["run", "smoke:stories:staging"],
    runWhen: () => !skipStaging,
  },
  {
    section: "staging smoke",
    label: "gamification",
    command: "npm",
    args: ["run", "smoke:gamification:staging"],
    runWhen: () => !skipStaging,
  },
  {
    section: "staging smoke",
    label: "smart match",
    command: "npm",
    args: ["run", "smoke:smart-match:staging"],
    runWhen: () => !skipStaging,
  },
];

for (const step of steps) {
  const ok = runStep(step);
  if (!ok) {
    console.error(`\nFAIL release smoke stopped at: ${step.section} / ${step.label}`);
    process.exit(1);
  }
}

console.log("\nPASS release smoke completed");
