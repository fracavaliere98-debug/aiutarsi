import { readdirSync, readFileSync } from "node:fs";

type Check = {
  label: string;
  pass: boolean;
  detail?: string;
};

function assertEnv(name: string): Check {
  return {
    label: `env:${name}`,
    pass: Boolean(process.env[name]),
    detail: process.env[name] ? undefined : `missing required env: ${name}`,
  };
}

function fileDoesNotContain(path: string, pattern: string): Check {
  const content = readFileSync(path, "utf8");
  return {
    label: `${path} avoids ${pattern}`,
    pass: !content.includes(pattern),
    detail: content.includes(pattern) ? `${path} still contains '${pattern}'` : undefined,
  };
}

function missingEnv(names: string[]) {
  return names.filter((name) => !process.env[name]);
}

function workflowFiles() {
  return readdirSync(".github/workflows")
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .map((file) => `.github/workflows/${file}`);
}

function run() {
  const args = new Set(process.argv.slice(2));
  const requireStaging = args.has("--staging");
  const requireRuntime = args.has("--runtime");
  const requireProductionRuntime = args.has("--production-runtime");
  const stagingEnv = ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY"];

  const checks: Check[] = workflowFiles().flatMap((file) => [
    fileDoesNotContain(file, "echo \"EXPO_PUBLIC_SUPABASE_URL="),
    fileDoesNotContain(file, "echo \"EXPO_PUBLIC_SUPABASE_ANON_KEY="),
    fileDoesNotContain(file, "cat > .env"),
  ]);

  if (requireRuntime) {
    checks.push(assertEnv("EXPO_PUBLIC_SUPABASE_URL"), assertEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"));
  }

  if (requireProductionRuntime) {
    checks.push(
      assertEnv("EXPO_PUBLIC_SUPABASE_URL"),
      assertEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
      assertEnv("EXPO_PUBLIC_SENTRY_DSN")
    );
  }

  if (requireStaging) {
    const missingStaging = missingEnv(stagingEnv);
    if (missingStaging.length > 0) {
      console.error("missing required env for staging smoke");
      console.error(`required: ${stagingEnv.join(", ")}`);
      console.error(`missing: ${missingStaging.join(", ")}`);
      process.exit(1);
    }
    checks.push(...stagingEnv.map(assertEnv));
  }

  const failed = checks.filter((check) => !check.pass);
  if (failed.length > 0) {
    console.error("env contract validation failed");
    for (const check of failed) {
      console.error(`- ${check.label}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log("PASS env contract validation completed");
}

run();
