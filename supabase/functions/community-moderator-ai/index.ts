import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.22.0";

interface CommunityPost {
    id: string;
    caption: string;
    image_url?: string;
    author_id: string;
}

interface ChatMessagePayload {
    message: string;
    user_id?: string;
    conversation_id?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const genAI = new GoogleGenerativeAI(geminiApiKey);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function buildCommunityPrompt() {
    return `Sei un moderatore AI per l'app "AiutarSi", una piattaforma di volontariato.
Analizza il seguente post della community e determina se viola le regole della community.
Cerca specificamente:
1. Nudita o contenuti sessualmente espliciti.
2. Linguaggio d'odio, discriminazione o bullismo.
3. Spam, truffe, schemi Ponzi o pubblicita non autorizzata.
4. Violenza gratuita o immagini disturbanti.

Restituisci solo un JSON nel formato:
{"safe": boolean, "reason": string, "category": "sexual" | "hate" | "spam" | "violence" | "none"}`;
}

function buildChatPrompt(message: string) {
    return `Sei un moderatore AI per la chat di "AiutarSi", una piattaforma di volontariato.
Analizza il seguente messaggio privato o di gruppo e determina se viola le regole della piattaforma.
Blocca solo i casi davvero problematici:
1. Minacce, violenza o istigazione all'autolesionismo.
2. Hate speech, discriminazione grave, molestie o insulti pesanti.
3. Spam, scam, phishing, promozione finanziaria aggressiva o contatti fraudolenti.
4. Contenuti sessualmente espliciti.

Non bloccare messaggi neutrali, coordinamento logistico, saluti, richieste di aiuto legittime o linguaggio colloquiale innocuo.

Restituisci solo un JSON nel formato:
{"safe": boolean, "reason": string, "category": "sexual" | "hate" | "spam" | "violence" | "harassment" | "none"}

Messaggio da analizzare:
${message}`;
}

async function parseModelJson(result: Awaited<ReturnType<ReturnType<typeof genAI.getGenerativeModel>["generateContent"]>>) {
    const responseText = result.response.text();
    try {
        return JSON.parse(responseText.replace(/```json|```/g, "").trim());
    } catch (parseError) {
        console.error('[Moderator Error] Invalid model JSON', parseError, responseText);
        return {
            safe: true,
            reason: 'Model output non-JSON; moderation bypassed.',
            category: 'none',
        };
    }
}

function buildBypassAnalysis(reason: string) {
    return {
        safe: true,
        reason,
        category: 'none',
    };
}

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
        let payload: { record?: CommunityPost; chat?: ChatMessagePayload } | null = null;
        try {
            payload = await req.json();
        } catch (parseError) {
            console.error('[Moderator Error] Invalid request JSON', parseError);
            return jsonResponse({
                success: true,
                analysis: {
                    safe: true,
                    reason: 'Invalid request payload; moderation bypassed.',
                    category: 'none',
                },
            });
        }

        const { record, chat } = payload || {};

        if (!record && !chat) {
            return jsonResponse({
                success: true,
                analysis: {
                    safe: true,
                    reason: 'No moderation target provided; moderation bypassed.',
                    category: 'none',
                },
            });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        if (chat?.message?.trim()) {
            console.log(`[Moderator] Analyzing chat message for user ${chat.user_id || 'unknown'}`);
            let analysis;
            try {
                const result = await model.generateContent(buildChatPrompt(chat.message));
                analysis = await parseModelJson(result);
            } catch (error) {
                console.error('[Moderator Error] Chat moderation provider unavailable', error);
                analysis = buildBypassAnalysis('Chat moderation temporarily unavailable.');
            }

            if (!analysis.safe) {
                console.warn(`[Moderator] Chat message flagged (${analysis.category}): ${analysis.reason}`);
            }

            return jsonResponse({ success: true, analysis });
        }

        if (!record) {
            return jsonResponse({
                success: true,
                analysis: {
                    safe: true,
                    reason: 'No record provided; moderation bypassed.',
                    category: 'none',
                },
            });
        }

        console.log(`[Moderator] Analyzing post ${record.id} by user ${record.author_id}`);
        const prompt = buildCommunityPrompt();

        let analysis;
        try {
            let result;
            if (record.image_url) {
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

            analysis = await parseModelJson(result);
        } catch (error) {
            console.error('[Moderator Error] Community moderation provider unavailable', error);
            analysis = buildBypassAnalysis('Community moderation temporarily unavailable.');
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

        return jsonResponse({ success: true, analysis });
    } catch (err) {
        console.error('[Moderator Error]', err);
        return jsonResponse({ error: err.message }, 500);
    }
});
