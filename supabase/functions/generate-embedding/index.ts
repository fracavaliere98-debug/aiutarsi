import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

// Migrata da HuggingFace (sentence-transformers/all-MiniLM-L6-v2, 384 dim) a Gemini il 28/9/2026.
// La colonna `embedding` (pgvector, sia su profiles che activities) resta vector(384): chiediamo a
// Gemini outputDimensionality=384 (troncamento MRL + rinormalizzazione) invece di cambiare schema.
// VERIFICATO su staging il 28/9/2026 con una chiamata reale (trigger DB su un profilo di test):
// primo tentativo con `outputDimensionality` annidato sotto una chiave `embedContentConfig` fallito
// (Gemini ha ignorato il parametro e restituito 3072 dim, la validazione sotto ha bloccato la
// scrittura correttamente) — il campo REST corretto è `outputDimensionality` in camelCase A LIVELLO
// RADICE del body (non annidato), come per gli altri parametri dell'API generativelanguage.googleapis.com.
// Confermato dopo il fix (deploy v33): risposta a 384 dim, embedding scritto correttamente sul
// profilo di test via il trigger DB reale (non solo una chiamata manuale). Il controllo
// `embedding.length !== 384` più sotto resta com'era apposta come rete di sicurezza per un
// eventuale futuro cambio di comportamento/nome modello lato Google.
const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 384;

// Il piano free di Gemini per gemini-embedding-001 ha un limite di 100 richieste/minuto
// (quotaId EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier, osservato in produzione
// durante il backfill del 29/9/2026 con scripts/backfill_embeddings.ts: 62/127 righe fallite con
// 429 pur restando sotto la media teorica). Rispettiamo il `retryDelay` che Gemini stesso
// restituisce nel body dell'errore 429 (RetryInfo), ma NON ci fidiamo ciecamente: riprovato lo
// stesso giorno con retry basato solo su quel valore, un fallimento reale è arrivato con
// `retryDelay: "0s"` e il retry immediato ha ripreso lo stesso 429 (la finestra di quota non si
// era ancora liberata). Per questo il valore riportato da Gemini è solo un minimo, mai preso alla
// lettera: applichiamo comunque un floor crescente per tentativo. Applicato qui, alla fonte della
// chiamata Gemini, cosi vale per ogni chiamante (trigger DB in tempo reale, backfill, usi futuri).
const GEMINI_MAX_RETRIES = 2;
const GEMINI_RETRY_DELAY_CAP_MS = 30_000;
const GEMINI_RETRY_DELAY_FLOOR_MS = [5_000, 15_000]; // floor per tentativo di retry (indice 0 = primo retry)

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(errorText: string): number | null {
    try {
        const parsed = JSON.parse(errorText);
        const details = parsed?.error?.details;
        if (!Array.isArray(details)) return null;
        const retryInfo = details.find((d: any) => typeof d?.["@type"] === "string" && d["@type"].includes("RetryInfo"));
        const raw = retryInfo?.retryDelay; // es. "42s" oppure "0.148s"
        if (typeof raw !== "string") return null;
        const seconds = parseFloat(raw.replace(/s$/, ""));
        if (!Number.isFinite(seconds) || seconds < 0) return null;
        return Math.min(seconds * 1000, GEMINI_RETRY_DELAY_CAP_MS);
    } catch {
        return null;
    }
}

// Gemini free tier ha DUE quote distinte sullo stesso errore 429 RESOURCE_EXHAUSTED: una al minuto
// (EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier, 100/min) e una al giorno
// (EmbedContentRequestsPerDayPerProjectPerModel-FreeTier, 1000/giorno) — osservata in produzione il
// 29/9/2026 durante il backfill, con Gemini che riporta comunque un `retryDelay` di ~59s anche
// quando è il tetto GIORNALIERO ad essere esaurito (fuorviante: aspettare un minuto non libera un
// quota giornaliero). Ritentare in quel caso non solo non risolve nulla entro la vita della
// function, ma spreca ulteriori richieste sul budget giornaliero già esaurito. Distinguiamo quindi
// il tipo di quota violata e ritentiamo SOLO per quella al minuto.
function getViolatedQuotaId(errorText: string): string | null {
    try {
        const parsed = JSON.parse(errorText);
        const details = parsed?.error?.details;
        if (!Array.isArray(details)) return null;
        const quotaFailure = details.find((d: any) => typeof d?.["@type"] === "string" && d["@type"].includes("QuotaFailure"));
        const violation = quotaFailure?.violations?.[0];
        return typeof violation?.quotaId === "string" ? violation.quotaId : null;
    } catch {
        return null;
    }
}

async function callGeminiEmbed(geminiApiKey: string, textToEmbed: string) {
    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:embedContent`,
            {
                headers: {
                    "x-goog-api-key": geminiApiKey,
                    "Content-Type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    content: { parts: [{ text: textToEmbed }] },
                    outputDimensionality: EMBEDDING_DIMENSIONS,
                }),
            }
        );

        if (geminiResponse.ok) {
            return geminiResponse.json();
        }

        const errorText = await geminiResponse.text();
        const isLastAttempt = attempt === GEMINI_MAX_RETRIES;
        console.error(`Gemini Error (${geminiResponse.status}), tentativo ${attempt + 1}/${GEMINI_MAX_RETRIES + 1}: ${errorText}`);

        if (geminiResponse.status !== 429 || isLastAttempt) {
            throw new Error(`Gemini API Error: ${geminiResponse.status} - ${errorText}`);
        }

        const quotaId = getViolatedQuotaId(errorText);
        if (quotaId && quotaId.includes("PerDay")) {
            throw new Error(`Gemini API Error: ${geminiResponse.status} - quota giornaliera esaurita (${quotaId}), nessun retry - ${errorText}`);
        }

        const floorMs = GEMINI_RETRY_DELAY_FLOOR_MS[attempt] ?? GEMINI_RETRY_DELAY_CAP_MS;
        const reportedDelayMs = parseRetryDelayMs(errorText) ?? floorMs;
        const retryDelayMs = Math.max(reportedDelayMs, floorMs);
        console.log(`[Retry] 429 da Gemini (retryDelay riportato: ${reportedDelayMs}ms), attendo ${retryDelayMs}ms prima del tentativo ${attempt + 2}`);
        await sleep(retryDelayMs);
    }

    // Non raggiungibile: ogni iterazione del loop ritorna o lancia.
    throw new Error("Gemini API Error: retry loop exited unexpectedly");
}

Deno.serve(async (req) => {
    try {
        const payload = await req.json();
        const { table, record, type } = payload;

        console.log(`[Payload] Table: ${table}, Record ID: ${record.id}, Type: ${type}`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log(`[Config] URL: ${!!supabaseUrl}, KEY: ${!!serviceRoleKey}`);

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error(`Missing vars: URL=${!!supabaseUrl}, KEY=${!!serviceRoleKey}`);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Fetch Gemini API key from database (stesso pattern/secret delle altre edge function AI)
        const { data: secretData, error: secretError } = await supabase
            .from('internal_secrets')
            .select('value')
            .eq('key', 'GEMINI_API_KEY')
            .single();

        if (secretError) {
            console.error(`[Error] Secret fetch failed: ${secretError.message}`);
        }

        const geminiApiKey = secretData?.value || Deno.env.get("GEMINI_API_KEY");
        console.log(`[Step] Gemini API key found: ${!!geminiApiKey}`);

        if (!geminiApiKey) {
            throw new Error("Gemini API key not found in DB or Env");
        }

        let textToEmbed = "";
        console.log(`[Step] Processing table: ${table}...`);
        if (table === "activities") {
            const { data: actSkillsData } = await supabase
                .from('activity_skills')
                .select('skill')
                .eq('activity_id', record.id);

            const actSkills = (actSkillsData || []).map((s: any) => s.skill).join(", ");
            textToEmbed = `Titolo: ${record.title}. Categoria: ${record.category || "Generale"}. Descrizione: ${record.description || ""}. Competenze richieste: ${actSkills}`;
        } else if (table === "profiles") {
            const [skillsRes, interestsRes] = await Promise.all([
                supabase.from('user_skills').select('skill').eq('user_id', record.id),
                supabase.from('user_interests').select('interest').eq('user_id', record.id)
            ]);

            const skills = (skillsRes.data || []).map((s: any) => s.skill).join(", ");
            const interests = (interestsRes.data || []).map((i: any) => i.interest).join(", ");

            textToEmbed = `Bio: ${record.bio || ""}. Interessi: ${interests}. Competenze: ${skills}`;
        }

        textToEmbed = textToEmbed.trim();
        if (!textToEmbed) {
            console.log("No content to embed, skipping.");
            return new Response("No content to embed", { status: 200 });
        }

        console.log(`Generating embedding for: ${textToEmbed.substring(0, 50)}...`);

        const result = await callGeminiEmbed(geminiApiKey, textToEmbed);
        const embedding = result?.embedding?.values;

        console.log(`Embedding success. Length: ${Array.isArray(embedding) ? embedding.length : "n/a"}`);

        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(`Invalid embedding length: ${Array.isArray(embedding) ? embedding.length : typeof embedding}`);
        }

        const { error: updateError } = await supabase
            .from(table)
            .update({ embedding })
            .eq("id", record.id);

        if (updateError) throw updateError;

        console.log(`Successfully updated ${table} record ${record.id}`);

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Critical Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
