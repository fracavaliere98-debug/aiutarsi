import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.22.0";

interface CommunityPost {
    id: string;
    caption: string;
    image_url?: string;
    author_id: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const genAI = new GoogleGenerativeAI(geminiApiKey);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

Deno.serve(async (req) => {
    try {
        let payload: { record?: CommunityPost } | null = null;
        try {
            payload = await req.json();
        } catch (parseError) {
            console.error('[Moderator Error] Invalid request JSON', parseError);
            return new Response(JSON.stringify({
                success: true,
                analysis: {
                    safe: true,
                    reason: 'Invalid request payload; moderation bypassed.',
                    category: 'none',
                },
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { record } = payload || {};

        if (!record) {
            return new Response(JSON.stringify({
                success: true,
                analysis: {
                    safe: true,
                    reason: 'No record provided; moderation bypassed.',
                    category: 'none',
                },
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`[Moderator] Analyzing post ${record.id} by user ${record.author_id}`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Prompt più severo e specifico per UGC
        const prompt = `Sei un moderatore AI per l'app "AiutarSi", una piattaforma di volontariato. 
    Analizza il seguente post (testo e/o immagine) e determina se viola le regole della community.
    Cerca specificamente:
    1. Nudità o contenuti sessualmente espliciti.
    2. Linguaggio d'odio, discriminazione o bullismo.
    3. Spam di Criptovalute, schemi Ponzi o pubblicità non autorizzata.
    4. Violenza gratuita o immagini disturbanti.

    Restituisci Solo un JSON nel formato: {"safe": boolean, "reason": string, "category": "sexual" | "hate" | "spam" | "violence" | "none"}`;

        let result;
        if (record.image_url) {
            // Fetch image and analyze with Vision
            const imageResp = await fetch(record.image_url);
            if (!imageResp.ok) {
                throw new Error(`Unable to fetch image for moderation: ${imageResp.status}`);
            }
            const imageData = await imageResp.arrayBuffer();

            result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: arrayBufferToBase64(imageData),
                        mimeType: "image/jpeg",
                    },
                },
                `Caption: ${record.caption || "Nessuna didascalia"}`
            ]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTesto da analizzare: ${record.caption}`);
        }

        const responseText = result.response.text();
        let analysis;
        try {
            analysis = JSON.parse(responseText.replace(/```json|```/g, "").trim());
        } catch (parseError) {
            console.error('[Moderator Error] Invalid model JSON', parseError, responseText);
            analysis = {
                safe: true,
                reason: 'Model output non-JSON; moderation bypassed.',
                category: 'none',
            };
        }

        if (!analysis.safe) {
            console.warn(`[Moderator] Post ${record.id} rejected: ${analysis.reason}`);

            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // We assume there's a column or a report system. 
            // For now, let's mark it in a pseudo-table or log it.
            await supabase
                .from('community_reports')
                .insert({
                    post_id: record.id,
                    reporter_id: '00000000-0000-0000-0000-000000000000', // AI System ID
                    reason: `AI Auto-moderation: ${analysis.reason}`,
                    status: 'pending'
                });

            // Potentially hide the post
            // await supabase.from('community_posts').delete().eq('id', record.id);
        }

        return new Response(JSON.stringify({ success: true, analysis }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[Moderator Error]', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
