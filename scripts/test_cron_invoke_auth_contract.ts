/**
 * Regression/contract test per il bug "cron senza Authorization header" trovato e
 * corretto due volte il 2026-07-22/23:
 *
 *  1. supabase/migrations/20260722220000_process_account_deletions.sql
 *     — invoke_process_account_deletions() era una funzione NUOVA, ma andava scritta
 *       seguendo il pattern corretto fin dall'inizio.
 *  2. supabase/migrations/20260723090000_fix_notification_cron_auth_header.sql
 *     — le 4 funzioni invoke_process_notification_jobs / invoke_notification_review_backfill /
 *       invoke_notification_weekly_recaps / invoke_notification_retention_cleanup esistevano
 *       già (dal 2026-04-01) ma senza header Authorization: la edge function di destinazione
 *       ha verify_jwt=true, quindi ogni chiamata falliva con 401 UNAUTHORIZED_NO_AUTH_HEADER.
 *       Confermato rotto su prod dal 2026-04-01 al 2026-07-22 (net._http_response).
 *
 * Questo test legge il sorgente SQL delle due migration e verifica che ogni funzione
 * `public.invoke_*` che chiama `net.http_post` includa l'header Authorization costruito da
 * `public.internal_secrets` — il pattern corretto già usato da community-moderator-ai /
 * generate-embedding / notify-user — e MAI il GUC morto `app.settings.service_role_key`
 * (verificato NULL su entrambi i progetti Supabase, la causa del primo bug su
 * process-account-deletions-nightly).
 *
 * Run: npx tsx scripts/test_cron_invoke_auth_contract.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

const REPO_ROOT = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const DEAD_GUC_PATTERN = "current_setting('app.settings.service_role_key'";

function extractInvokeFunctionBlocks(sql: string): { name: string; body: string }[] {
  const blocks: { name: string; body: string }[] = [];
  const regex = /create or replace function public\.(invoke_\w+)\s*\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$;/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    blocks.push({ name: match[1], body: match[2] });
  }
  return blocks;
}

function testMigrationDefinesAuthenticatedInvokers(migrationPath: string, expectedFunctionNames: string[]) {
  console.log(`\n[${migrationPath}]`);

  const sql = readSource(migrationPath);
  const blocks = extractInvokeFunctionBlocks(sql);
  const foundNames = blocks.map((b) => b.name);
  for (const expected of expectedFunctionNames) {
    assert(foundNames.includes(expected), `${migrationPath} deve definire public.${expected}()`);
  }
  pass(`tutte le funzioni attese sono definite: ${expectedFunctionNames.join(", ")}`);

  // Il controllo sul GUC morto è scoped al CORPO delle funzioni (non all'intero file):
  // i commenti di intestazione della migration citano volutamente
  // app.settings.service_role_key per spiegare il bug storico, non vanno flaggati.
  for (const block of blocks) {
    assert(
      !block.body.includes(DEAD_GUC_PATTERN),
      `REGRESSIONE: public.${block.name}() usa di nuovo il GUC morto app.settings.service_role_key (verificato NULL su prod e staging)`
    );
  }
  pass("nessuna funzione usa il GUC morto app.settings.service_role_key");

  for (const block of blocks) {
    if (!block.body.includes("net.http_post")) continue; // funzione invoke_* che non chiama l'edge function direttamente
    assert(
      block.body.includes("'Authorization'"),
      `REGRESSIONE: public.${block.name}() chiama net.http_post senza header Authorization — stesso bug del 401 UNAUTHORIZED_NO_AUTH_HEADER`
    );
    assert(
      block.body.includes("internal_secrets") && block.body.includes("service_role_key"),
      `REGRESSIONE: public.${block.name}() non legge il secret da public.internal_secrets`
    );
    pass(`public.${block.name}() include l'header Authorization da internal_secrets.service_role_key`);
  }
}

function run() {
  console.log("Cron invoke_* Authorization header contract tests");
  console.log("─".repeat(60));

  testMigrationDefinesAuthenticatedInvokers(
    "supabase/migrations/20260722220000_process_account_deletions.sql",
    ["invoke_process_account_deletions"]
  );

  testMigrationDefinesAuthenticatedInvokers(
    "supabase/migrations/20260723090000_fix_notification_cron_auth_header.sql",
    [
      "invoke_process_notification_jobs",
      "invoke_notification_review_backfill",
      "invoke_notification_weekly_recaps",
      "invoke_notification_retention_cleanup",
    ]
  );

  console.log("\n" + "─".repeat(60));
  console.log("Tutti i controlli sull'Authorization header dei cron invoke_* sono passati ✓");
}

run();
