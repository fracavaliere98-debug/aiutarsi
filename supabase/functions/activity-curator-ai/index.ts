import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

interface ActivityDraft {
    title: string;
    description: string;
    category?: string;
}

interface CuratedActivity {
    expandedDescription: string;
    suggestedSkills: string[];
    suggestedCategory: string;
}

// Tenute in sync a mano con constants/Skills.ts e constants/Interests.ts (questa edge function
// gira su Deno, non può importare i moduli RN dell'app). Prima del 2026-07-23 il prompt chiedeva
// competenze/categorie a testo libero non vincolate a nessuna lista reale (es. "Lavoro di
// squadra", "Cultura", "Emergenza") — non corrispondevano MAI a un id/label valido, quindi il
// filtro lato client (components/npo/ActivityForm.tsx, applyCuratedDraft) scartava sempre il
// suggerimento e faceva fallback silenzioso ai valori precedenti. Il fix vincola l'AI a
// scegliere solo tra le competenze/categorie che esistono davvero nell'app.
const SKILL_IDS = [
    "assistenza-persona", "primo-soccorso", "insegnamento", "manualita", "cura-animali",
    "cucina", "comunicazione-digitale", "informatica", "creativita", "ascolto-compagnia",
    "lingue", "sport",
];
const CATEGORY_LABELS = ["Ambiente", "Sociale", "Educazione", "Animali", "Arte & Cultura", "Salute"];

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function getHfToken(): Promise<string> {
    const envToken = Deno.env.get("HUGGINGFACE_API_KEY") ?? "";
    try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data } = await supabase
            .from("internal_secrets")
            .select("value")
            .eq("key", "HUGGINGFACE_API_KEY")
            .single();
        return data?.value || envToken;
    } catch {
        return envToken;
    }
}

function buildPrompt(activity: ActivityDraft): string {
    return `Sei un copywriter esperto per il settore non-profit italiano.
Dato il titolo e la descrizione di un'attività di volontariato, restituisci SOLO un JSON valido senza markdown nel formato:
{"expandedDescription": string, "suggestedSkills": string[], "suggestedCategory": string}

Regole:
- expandedDescription: rendi la descrizione coinvolgente e professionale (max 150 parole), mantieni il tono caldo e motivante.
- suggestedSkills: 2-4 valori scelti SOLO tra questi id, quelli più pertinenti all'attività (nessun altro testo, solo id da questo elenco): ${SKILL_IDS.join(", ")}.
- suggestedCategory: scegli SOLO una tra queste categorie (esattamente come scritta, nessuna variante): ${CATEGORY_LABELS.join(", ")}.

Titolo: ${activity.title}
Descrizione attuale: ${activity.description || "Nessuna"}
Categoria attuale: ${activity.category || "Sociale"}`;
}

function fallbackCuration(activity: ActivityDraft): CuratedActivity {
    return {
        expandedDescription: activity.description || activity.title,
        // Nessun segnale affidabile senza chiamata AI riuscita: meglio non suggerire nulla
        // (components/npo/ActivityForm.tsx mantiene la selezione precedente quando l'array è vuoto)
        // piuttosto che inventare competenze a caso che non corrispondono a nessun id reale.
        suggestedSkills: [],
        suggestedCategory: CATEGORY_LABELS.includes(activity.category || "") ? (activity.category as string) : "Sociale",
    };
}

Deno.serve(async (req) => {
    try {
        const { activity }: { activity: ActivityDraft } = await req.json();

        if (!activity?.title) {
            return new Response(JSON.stringify({ error: "Titolo attività mancante" }), { status: 400 });
        }

        console.log(`[Curator] Optimizing: ${activity.title}`);

        const hfToken = await getHfToken();
        if (!hfToken) {
            console.warn("[Curator] No HuggingFace token, returning fallback");
            return new Response(
                JSON.stringify({ success: true, ...fallbackCuration(activity) }),
                { headers: { "Content-Type": "application/json" } },
            );
        }

        const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${hfToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "meta-llama/Meta-Llama-3-8B-Instruct",
                messages: [{ role: "user", content: buildPrompt(activity) }],
                temperature: 0.7,
                max_tokens: 400,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HuggingFace API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content ?? "";

        let curatedData: CuratedActivity;
        try {
            curatedData = JSON.parse(raw.replace(/```json|```/g, "").trim());
        } catch {
            console.error("[Curator] Non-JSON response from AI, using fallback", raw);
            curatedData = fallbackCuration(activity);
        }

        // Il modello a volte non rispetta l'elenco chiuso richiesto nel prompt: filtriamo/validiamo
        // qui invece di fidarci ciecamente, così il client riceve sempre e solo id/categorie reali.
        curatedData.suggestedSkills = (curatedData.suggestedSkills || []).filter((id) => SKILL_IDS.includes(id));
        if (!CATEGORY_LABELS.includes(curatedData.suggestedCategory)) {
            curatedData.suggestedCategory = CATEGORY_LABELS.includes(activity.category || "")
                ? (activity.category as string)
                : "Sociale";
        }

        return new Response(
            JSON.stringify({ success: true, ...curatedData }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (err) {
        console.error("[Curator Error]", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});
