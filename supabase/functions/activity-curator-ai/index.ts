import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface ActivityDraft {
    title: string;
    description: string;
    category?: string;
}

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

Deno.serve(async (req) => {
    try {
        const { activity }: { activity: ActivityDraft } = await req.json();

        if (!activity || !activity.title) {
            return new Response(JSON.stringify({ error: 'Titolo attività mancante' }), { status: 400 });
        }

        console.log(`[Curator] Optimizing activity: ${activity.title}`);

        const prompt = `Sei un esperto di copywriting per il settore non-profit. 
    Dato il titolo e una breve descrizione di un'attività di volontariato, espandi la descrizione per renderla più coinvolgente e professionale (max 150 parole).
    Inoltre, suggerisci le 3-5 competenze (skill) più adatte e conferma o suggerisci la categoria corretta.
    
    Titolo: ${activity.title}
    Descrizione Attuale: ${activity.description || "Nessuna"}
    Categoria Attuale: ${activity.category || "Sociale"}
    
    Restituisci Solo un JSON nel formato: 
    {
      "expandedDescription": string, 
      "suggestedSkills": string[], 
      "suggestedCategory": string
    }`;

        // Direct fetch to API v1 instead of v1beta or SDK
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        response_mime_type: "application/json",
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error 500: ${errorText}`);
        }

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        const curatedData = JSON.parse(responseText.trim());

        return new Response(JSON.stringify({ success: true, ...curatedData }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[Curator Error]', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
