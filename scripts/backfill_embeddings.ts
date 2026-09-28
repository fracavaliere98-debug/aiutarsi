/**
 * Backfill degli embedding esistenti (profiles + activities) dopo la migration da HuggingFace a
 * Gemini del 28/9/2026 (vedi supabase/functions/generate-embedding/index.ts).
 *
 * Perché serve, anche per le righe che hanno già un embedding: sono stati generati con un modello
 * diverso (sentence-transformers/all-MiniLM-L6-v2 via HuggingFace) — anche restando a 384
 * dimensioni, lo spazio vettoriale di Gemini non è lo stesso, quindi mischiare vecchi e nuovi
 * vettori nella stessa ricerca di similarità (get_activities_with_match, match_activities,
 * get_matching_volunteers) produrrebbe punteggi inconsistenti. Per questo lo script riscrive
 * TUTTE le righe con contenuto da embeddare, non solo quelle con embedding NULL.
 *
 * Non modifica lo schema: chiama semplicemente la edge function generate-embedding riga per riga,
 * con una pausa tra le chiamate per restare sotto ai rate limit del piano free di Gemini.
 *
 * Richiede le stesse env var di scripts/bootstrap_internal_secrets.ts:
 *   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   npx tsx scripts/backfill_embeddings.ts --dry-run                 # conta le righe, nessuna chiamata
 *   npx tsx scripts/backfill_embeddings.ts --table=profiles --limit=3  # prova su poche righe
 *   npx tsx scripts/backfill_embeddings.ts                            # tutte le righe, entrambe le tabelle
 *
 * IMPORTANTE: verificare prima su staging (env EXPO_PUBLIC_SUPABASE_URL puntata a staging) che
 * generate-embedding risponda correttamente con GEMINI_API_KEY configurata, prima di lanciarlo
 * su prod. Non eseguire questo script finché quella verifica non è stata fatta.
 */

type TableName = "profiles" | "activities";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tableArg = args.find((a) => a.startsWith("--table="));
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const delayArg = args.find((a) => a.startsWith("--delay-ms="));

  const table = tableArg ? (tableArg.split("=")[1] as TableName) : undefined;
  if (table) assert(table === "profiles" || table === "activities", `--table deve essere "profiles" o "activities", ricevuto: ${table}`);

  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;
  const delayMs = delayArg ? parseInt(delayArg.split("=")[1], 10) : 2200; // ~27 richieste/min, sotto i 30 RPM del piano free di Gemini

  return { dryRun, table, limit, delayMs };
}

async function fetchRows(baseUrl: string, serviceRoleKey: string, table: TableName, limit?: number) {
  const limitParam = limit ? `&limit=${limit}` : "";
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*${limitParam}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Fetch righe ${table} fallito (${response.status}): ${text}`);
  }

  return JSON.parse(text) as ({ id: string } & Record<string, unknown>)[];
}

async function callGenerateEmbedding(
  baseUrl: string,
  serviceRoleKey: string,
  table: TableName,
  record: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/functions/v1/generate-embedding`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ table, record, type: "BACKFILL" }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return text;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillTable(
  baseUrl: string,
  serviceRoleKey: string,
  table: TableName,
  opts: { dryRun: boolean; limit?: number; delayMs: number },
) {
  console.log(`\n=== ${table} ===`);
  const rows = await fetchRows(baseUrl, serviceRoleKey, table, opts.limit);
  console.log(`Righe trovate: ${rows.length}`);

  if (opts.dryRun) {
    console.log("Dry run: nessuna chiamata effettuata.");
    return { total: rows.length, ok: 0, failed: 0, failures: [] as string[] };
  }

  let ok = 0;
  const failures: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      await callGenerateEmbedding(baseUrl, serviceRoleKey, table, row);
      ok += 1;
      console.log(`  [${index + 1}/${rows.length}] ${table}/${row.id} ok`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${row.id}: ${message}`);
      console.error(`  [${index + 1}/${rows.length}] ${table}/${row.id} FALLITO — ${message}`);
    }

    if (index < rows.length - 1) {
      await sleep(opts.delayMs);
    }
  }

  return { total: rows.length, ok, failed: failures.length, failures };
}

async function run() {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(baseUrl, "EXPO_PUBLIC_SUPABASE_URL is required");
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");

  const { dryRun, table, limit, delayMs } = parseArgs();

  console.log(`Target: ${baseUrl}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Delay tra le chiamate: ${delayMs}ms`);
  if (limit) console.log(`Limite righe per tabella: ${limit}`);

  const tablesToRun: TableName[] = table ? [table] : ["profiles", "activities"];

  const summary: Record<string, { total: number; ok: number; failed: number; failures: string[] }> = {};
  for (const t of tablesToRun) {
    summary[t] = await backfillTable(baseUrl!, serviceRoleKey!, t, { dryRun, limit, delayMs });
  }

  console.log("\n" + "─".repeat(60));
  console.log("Riepilogo backfill embedding");
  for (const [t, s] of Object.entries(summary)) {
    console.log(`  ${t}: ${s.ok}/${s.total} ok, ${s.failed} falliti`);
    for (const f of s.failures) console.log(`    - ${f}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
