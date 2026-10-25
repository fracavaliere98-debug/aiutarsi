// Le edge function "*-smoke" creano utenti, attività e messaggi con la service role e poi li
// cancellano: sono harness di test e devono girare SOLO su staging (decisione A25, 24/10/2026).
// Su prod non vanno pubblicate; questo controllo è la rete di sicurezza se una di esse viene
// ripubblicata per errore (ad esempio per "riallineare" prod a staging).
// Il tsc dell'app include questo file perche' lo importa scripts/test_smoke_functions_staging_only_contract.ts,
// ma non conosce il global Deno (esiste solo nel runtime delle edge function): dichiarazione minima, solo tipi.
declare const Deno: { env: { get(name: string): string | undefined } };

export const STAGING_PROJECT_REF = "pavnfiladmnwbptwlwpr";

export function isStagingEnvironment(supabaseUrl: string | null | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    return new URL(supabaseUrl).hostname === `${STAGING_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

export function rejectIfNotStaging(headers: Record<string, string>): Response | null {
  if (isStagingEnvironment(Deno.env.get("SUPABASE_URL"))) return null;
  return new Response(
    JSON.stringify({ success: false, error: "Smoke function disabled outside staging" }),
    { status: 403, headers }
  );
}
