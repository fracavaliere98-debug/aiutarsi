import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

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

type ModerationCategory = 'sexual' | 'hate' | 'spam' | 'violence' | 'harassment' | 'none';

interface ModerationResult {
    safe: boolean;
    reason: string;
    category: ModerationCategory;
    source: 'rules' | 'ai' | 'bypass';
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// --------------------------------------------------------------------------
// Term lists
// --------------------------------------------------------------------------

const BANNED_TERMS = [
    'cazzo', 'vaffanculo', 'fanculo', 'stronzo', 'stronza', 'coglione', 'cogliona',
    'minchia', 'affanculo', 'figlio di puttana', 'figlio di troia', 'bastardo', 'bastarda',
    'puttana', 'troia', 'zoccola', 'mignotta', 'baldracca',
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick',
    'nigger', 'faggot',
];

const HATE_TERMS = [
    'negro', 'negra', 'terrone', 'terronaccio', 'mongoloide', 'handicappato',
    'odio i', 'odio gli', 'odio le',
];

const VIOLENCE_TERMS = [
    'uccidi', 'ammazza', 'ammazzati', 'crepa', 'vattene a morire',
    'mi ammazzo', 'voglio morire', 'preferisco morire',
];

const SEXUAL_TERMS = [
    'nudo', 'nuda', 'sesso esplicito', 'porno', 'pornograf',
];

const SPAM_TERMS = [
    'clicca qui', 'click here', 'guadagna facile', 'earn money fast',
    'bitcoin', 'crypto', 'investimento sicuro', 'guaranteed profit',
    'whatsapp', 'telegram',
];

// Words that are not hard-banned but indicate the text needs AI review.
// These can appear in innocent contexts but are worth a second pass.
const SOFT_SIGNAL_TERMS = [
    'sei un', 'sei una', 'siete dei', 'siete delle',
    'non vi meritate', 'non ti meriti', 'vergognatevi', 'vergognati',
    'inutili', 'inutile', 'schifo', 'schifosi', 'schifose',
    'razzist', 'fascist', 'nazist',
    'die', 'kill', 'hate you', 'go away',
];

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const LONG_NUMBER_PATTERN = /\b\d{10,}\b/;
const REPEATED_CHAR_PATTERN = /(.)\1{6,}/;
const MANY_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]{5,}/u;
// Aggressive punctuation: multiple ! or ? in short text
const AGGRESSIVE_PUNCT_PATTERN = /[!?]{3,}/;

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s:/._!?-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function safe(reason: string, source: ModerationResult['source']): ModerationResult {
    return { safe: true, reason, category: 'none', source };
}

function blocked(reason: string, category: ModerationCategory): ModerationResult {
    return { safe: false, reason, category, source: 'rules' };
}

// --------------------------------------------------------------------------
// Layer 1: hard rules — conclusive, no API call needed
// --------------------------------------------------------------------------

function applyHardRules(rawText: string): ModerationResult | null {
    if (!rawText?.trim()) return null;
    const text = normalize(rawText);

    const findTerm = (terms: string[]) => terms.some((t) => text.includes(normalize(t)));

    if (findTerm(VIOLENCE_TERMS))
        return blocked('Contenuto violento o autolesionistico rilevato.', 'violence');
    if (findTerm(HATE_TERMS))
        return blocked('Linguaggio d\'odio o discriminatorio rilevato.', 'hate');
    if (findTerm(SEXUAL_TERMS))
        return blocked('Contenuto sessualmente esplicito rilevato.', 'sexual');
    if (findTerm(BANNED_TERMS))
        return blocked('Linguaggio offensivo o molesto rilevato.', 'harassment');
    if (findTerm(SPAM_TERMS))
        return blocked('Pattern spam o truffa rilevato.', 'spam');
    if (URL_PATTERN.test(rawText) || LONG_NUMBER_PATTERN.test(rawText) ||
        REPEATED_CHAR_PATTERN.test(rawText) || MANY_EMOJI_PATTERN.test(rawText))
        return blocked('Pattern spam automatico rilevato.', 'spam');

    return null;
}

// --------------------------------------------------------------------------
// Layer 2: ambiguity signals — determines whether AI review is needed
// --------------------------------------------------------------------------

function needsAiReview(rawText: string, hasImage: boolean): boolean {
    if (hasImage) return true; // images always need AI (we can't classify them with rules)

    const text = normalize(rawText);
    if (!text || text.length < 10) return false;

    const hasSoftSignal = SOFT_SIGNAL_TERMS.some((t) => text.includes(normalize(t)));
    const hasAggressivePunct = AGGRESSIVE_PUNCT_PATTERN.test(rawText);

    return hasSoftSignal || hasAggressivePunct;
}

// --------------------------------------------------------------------------
// Layer 3: AI review via HuggingFace (only when layers 1-2 are inconclusive)
// --------------------------------------------------------------------------

async function getHfToken(supabase: ReturnType<typeof createClient>): Promise<string> {
    const envToken = Deno.env.get('HUGGINGFACE_API_KEY') ?? '';
    try {
        const { data } = await supabase
            .from('internal_secrets')
            .select('value')
            .eq('key', 'HUGGINGFACE_API_KEY')
            .single();
        return data?.value || envToken;
    } catch {
        return envToken;
    }
}

function buildModerationPrompt(text: string, context: 'post' | 'chat'): string {
    const contextNote = context === 'chat'
        ? 'messaggio privato o di gruppo in una piattaforma di volontariato'
        : 'post della community in una piattaforma di volontariato';

    return `Sei un moderatore per "${contextNote}". Analizza il testo e rispondi SOLO con un JSON valido senza markdown:
{"safe": boolean, "reason": string, "category": "sexual"|"hate"|"spam"|"violence"|"harassment"|"none"}

Blocca solo: odio/discriminazione, minacce, spam/truffe, contenuti sessuali espliciti, molestie gravi.
NON bloccare: linguaggio colloquiale, critiche costruttive, frustrazione ordinaria, coordinamento logistico.

Testo: ${text}`;
}

async function callAiModeration(
    text: string,
    context: 'post' | 'chat',
    hfToken: string,
): Promise<ModerationResult> {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta-llama/Meta-Llama-3-8B-Instruct',
            messages: [{ role: 'user', content: buildModerationPrompt(text, context) }],
            temperature: 0.1,
            max_tokens: 120,
        }),
    });

    if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '';

    try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        return { ...parsed, source: 'ai' };
    } catch {
        console.error('[Moderator] AI returned non-JSON, defaulting to safe', raw);
        return safe('AI output non-JSON; defaulting to safe.', 'ai');
    }
}

// --------------------------------------------------------------------------
// Main moderation entry points
// --------------------------------------------------------------------------

async function moderateChatMessage(
    chat: ChatMessagePayload,
    supabase: ReturnType<typeof createClient>,
): Promise<ModerationResult> {
    const text = chat.message?.trim() ?? '';
    if (!text) return safe('Empty message.', 'bypass');

    // Layer 1
    const hardResult = applyHardRules(text);
    if (hardResult) return hardResult;

    // Layer 2 — no image in chat; only check soft signals
    if (!needsAiReview(text, false)) {
        return safe('Contenuto approvato dalle regole standard.', 'rules');
    }

    // Layer 3
    try {
        const hfToken = await getHfToken(supabase);
        if (!hfToken) return safe('AI non disponibile; approvato per default.', 'bypass');
        return await callAiModeration(text, 'chat', hfToken);
    } catch (err) {
        console.error('[Moderator] AI unavailable for chat, falling back to safe', err);
        return safe('AI non disponibile; approvato per default.', 'bypass');
    }
}

async function moderateCommunityPost(
    record: CommunityPost,
    supabase: ReturnType<typeof createClient>,
): Promise<ModerationResult> {
    const text = [record.caption ?? '', record.image_url ? '[immagine allegata]' : ''].join(' ').trim();
    const hasImage = Boolean(record.image_url);

    // Layer 1 — text only (we cannot keyword-check images)
    const hardResult = applyHardRules(record.caption ?? '');
    if (hardResult) return hardResult;

    // Layer 2
    if (!needsAiReview(record.caption ?? '', hasImage)) {
        return safe('Contenuto approvato dalle regole standard.', 'rules');
    }

    // Layer 3
    try {
        const hfToken = await getHfToken(supabase);
        if (!hfToken) return safe('AI non disponibile; approvato per default.', 'bypass');
        // For posts with images, include a note in the text — we cannot send the image
        // to HuggingFace text completion, so we ask the model to evaluate caption + context.
        const textForAi = hasImage
            ? `[Post con immagine allegata] Caption: ${record.caption ?? ''}`
            : record.caption ?? '';
        return await callAiModeration(textForAi, 'post', hfToken);
    } catch (err) {
        console.error('[Moderator] AI unavailable for post, falling back to safe', err);
        return safe('AI non disponibile; approvato per default.', 'bypass');
    }
}

async function handleRejectedPost(
    record: CommunityPost,
    analysis: ModerationResult,
    supabase: ReturnType<typeof createClient>,
): Promise<void> {
    console.warn(`[Moderator] Post ${record.id} rejected (${analysis.category}/${analysis.source}): ${analysis.reason}`);
    await supabase.from('community_reports').insert({
        post_id: record.id,
        reporter_id: '00000000-0000-0000-0000-000000000000',
        reason: `AI Auto-moderation [${analysis.source}]: ${analysis.reason}`,
        status: 'pending',
    });
}

// --------------------------------------------------------------------------
// Handler
// --------------------------------------------------------------------------

Deno.serve(async (req) => {
    try {
        let payload: { record?: CommunityPost; chat?: ChatMessagePayload } | null = null;
        try {
            payload = await req.json();
        } catch {
            return jsonResponse({ success: true, analysis: safe('Invalid request payload; bypassed.', 'bypass') });
        }

        const { record, chat } = payload ?? {};
        if (!record && !chat) {
            return jsonResponse({ success: true, analysis: safe('No moderation target; bypassed.', 'bypass') });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (chat?.message?.trim()) {
            console.log(`[Moderator] Chat message for user ${chat.user_id ?? 'unknown'}`);
            const analysis = await moderateChatMessage(chat, supabase);
            if (!analysis.safe) {
                console.warn(`[Moderator] Chat flagged (${analysis.category}/${analysis.source}): ${analysis.reason}`);
            }
            return jsonResponse({ success: true, analysis });
        }

        if (record) {
            console.log(`[Moderator] Post ${record.id} by ${record.author_id}`);
            const analysis = await moderateCommunityPost(record, supabase);
            if (!analysis.safe) await handleRejectedPost(record, analysis, supabase);
            return jsonResponse({ success: true, analysis });
        }

        return jsonResponse({ success: true, analysis: safe('No target matched; bypassed.', 'bypass') });
    } catch (err) {
        console.error('[Moderator Error]', err);
        return jsonResponse({ error: String(err) }, 500);
    }
});
