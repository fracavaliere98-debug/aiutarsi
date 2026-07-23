import { buildStagingSupabaseHeaders, requireStagingSupabaseEnv } from "./lib/stagingSmokeEnv";
import { isMainModule } from "./lib/isMainModule";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Live smoke test per supabase/functions/process-account-deletions (2026-07-22).
 *
 * Chiama SEMPRE con dryRun:true — non cancella mai utenti. Verifica che la edge
 * function sia deployata, risponda 200 e ritorni la forma attesa (dueCount/ids
 * derivati da profiles.deletion_requested_at con la grace period di 30 giorni,
 * stessa promessa fatta all'utente in app/(volunteer)/settings/index.tsx e
 * app/(npo)/settings/index.tsx: "Avrai 30 giorni per annullare la richiesta").
 *
 * Non testa il percorso cron (pg_cron → invoke_process_account_deletions() →
 * net.http_post): quello richiede la service_role key, non disponibile in
 * questo script. Verificato manualmente via Supabase MCP al momento del fix
 * (vedi memoria di progetto) — se si vuole automatizzarlo, serve un secret
 * STAGING_SUPABASE_SERVICE_ROLE_KEY dedicato, oggi non presente in CI.
 */
export async function runStagingAccountDeletionSmoke() {
  const { supabaseUrl, anonKey } = requireStagingSupabaseEnv("account-deletion");

  const response = await fetch(`${supabaseUrl}/functions/v1/process-account-deletions`, {
    method: "POST",
    headers: buildStagingSupabaseHeaders(anonKey, true),
    body: JSON.stringify({ dryRun: true }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `process-account-deletions failed with ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload?.success === true, `process-account-deletions returned failure: ${JSON.stringify(payload)}`);
  assert(payload?.dryRun === true, `expected dryRun:true echoed back, got: ${JSON.stringify(payload)}`);
  assert(payload?.gracePeriodDays === 30, `expected default grace period of 30 days, got: ${JSON.stringify(payload)}`);
  assert(Array.isArray(payload?.ids), `expected 'ids' to be an array, got: ${JSON.stringify(payload)}`);
  assert(typeof payload?.dueCount === "number", `expected 'dueCount' to be a number, got: ${JSON.stringify(payload)}`);

  return payload;
}

if (isMainModule(import.meta.url)) {
  runStagingAccountDeletionSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
