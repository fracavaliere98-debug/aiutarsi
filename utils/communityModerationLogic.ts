/**
 * Logica pura (nessuna chiamata di rete) estratta da communityModeration.ts per poterla testare
 * senza Supabase/XHR. Governa due decisioni safety-critical:
 *  1. come interpretare la risposta dell'edge function community-moderator-ai (mapModerationResponse)
 *  2. cosa succede quando la moderazione NON è raggiungibile (buildFailOpenResult) — la policy
 *     attuale è "fail open" (contenuto passa) per non bloccare gli utenti quando il servizio AI
 *     è giù, comportamento invariato rispetto all'originale, solo reso esplicito e testabile.
 *
 * Run: npx tsx scripts/test_community_moderation_contract.ts
 */

export type ModerationResult = {
    safe: boolean;
    reason?: string;
    category?: string;
};

export const MODERATION_UNAVAILABLE_REASON = "Moderazione temporaneamente non disponibile.";

/**
 * Interpreta il payload grezzo restituito dall'edge function community-moderator-ai.
 * `safe` è `true` per default: solo un `analysis.safe === false` esplicito blocca il contenuto
 * (fail open anche su risposta malformata/analysis assente, non solo su errore di rete).
 */
export function mapModerationResponse(data: unknown): ModerationResult {
    const analysis = (data as { analysis?: { safe?: boolean; reason?: string; category?: string } } | null | undefined)?.analysis;
    return {
        safe: analysis?.safe !== false,
        reason: analysis?.reason,
        category: analysis?.category,
    };
}

/** Risultato da restituire quando la moderazione non è raggiungibile (errore, timeout, rete). */
export function buildFailOpenResult(): ModerationResult {
    return {
        safe: true,
        reason: MODERATION_UNAVAILABLE_REASON,
        category: "none",
    };
}
