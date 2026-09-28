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

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`Gemini Error (${geminiResponse.status}): ${errorText}`);
            throw new Error(`Gemini API Error: ${geminiResponse.status} - ${errorText}`);
        }

        const result = await geminiResponse.json();
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
