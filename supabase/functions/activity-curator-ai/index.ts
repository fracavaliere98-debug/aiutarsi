import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1";

interface ActivityDraft {
    title: string;
    description: string;
    category?: string;
}

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
const genAI = new GoogleGenerativeAI(geminiApiKey);

Deno.serve(async (req) => {
    try {
        const { activity }: { activity: ActivityDraft } = await req.json();

        if (!activity || !activity.title) {
            return new Response(JSON.stringify({ error: 'Titolo attività mancante' }), { status: 400 });
        }

        console.log(`[Curator] Optimizing activity: ${activity.title}`);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const curatedData = JSON.parse(responseText.replace(/```json|```/g, "").trim());

        return new Response(JSON.stringify({ success: true, ...curatedData }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[Curator Error]', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
