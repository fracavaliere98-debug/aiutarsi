import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, User } from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-2.0-flash-lite';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5s base delay for free-tier rate limiting
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GeminiMatch {
    id: string;
    score: number;
    reason: string;
    activity?: Activity; // enriched after matching
}

interface CachedResult {
    matches: GeminiMatch[];
    timestamp: number;
}

// Thrown when the daily free-tier quota is fully exhausted (limit: 0).
// Retrying won't help — fail fast and surface a clear message in the UI.
export class GeminiQuotaDailyError extends Error {
    constructor() {
        super('Quota giornaliera Gemini esaurita. Riprova domani.');
        this.name = 'GeminiQuotaDailyError';
    }
}

// ─── Service ─────────────────────────────────────────────────────────────────
class GeminiMatchService {
    private genAI: GoogleGenerativeAI;

    constructor() {
        if (!GEMINI_API_KEY) {
            console.error('[GeminiMatch] EXPO_PUBLIC_GEMINI_API_KEY is not set in the environment variables.');
        }
        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'missing_key');
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Returns up to 5 AI-ranked activity matches for the given volunteer.
     * Results are cached for 30 minutes to respect the free-tier rate limit.
     */
    async getSmartMatches(
        volunteer: User,
        nearbyActivities: Activity[]
    ): Promise<GeminiMatch[]> {
        if (!nearbyActivities || nearbyActivities.length === 0) {
            return [];
        }

        // 1. Cache check
        const cacheKey = `gemini_match_${volunteer.id}`;
        const cached = await this._readCache(cacheKey);
        if (cached) {
            console.log('[GeminiMatch] Cache hit — returning cached matches');
            return cached;
        }

        // 2. Build prompt & call Gemini with retry
        const prompt = this._buildPrompt(volunteer, nearbyActivities);
        const rawMatches = await this._callGeminiWithRetry(prompt, 0);

        // 3. Enrich matches with activity objects
        const enriched = rawMatches
            .map((m) => ({
                ...m,
                activity: nearbyActivities.find((a) => a.id === m.id),
            }))
            .filter((m) => m.activity !== undefined);

        // 4. Cache result
        await this._writeCache(cacheKey, enriched);

        return enriched;
    }

    /** Invalidate cache for a specific user (e.g. on profile update) */
    async invalidateCache(userId: string): Promise<void> {
        await AsyncStorage.removeItem(`gemini_match_${userId}`);
    }

    // ── Prompt Engineering ──────────────────────────────────────────────────

    private _buildPrompt(volunteer: User, activities: Activity[]): string {
        const hasBio = !!(volunteer.bio && volunteer.bio.trim().length > 0);
        const hasSkills = volunteer.skills?.length > 0;
        const hasInterests = volunteer.interests?.length > 0;

        // Volunteer profile section
        const volunteerSection = `
## PROFILO VOLONTARIO
${hasBio ? `Bio: "${volunteer.bio}"` : '(Nessuna bio fornita)'}
${hasSkills ? `Competenze: ${volunteer.skills.join(', ')}` : '(Nessuna competenza specificata)'}
${hasInterests ? `Interessi: ${volunteer.interests.join(', ')}` : '(Nessun interesse specificato)'}
`.trim();

        // Fallback instruction when bio is empty
        const matchInstruction = hasBio
            ? `Analizza il profilo (bio, competenze, interessi) e seleziona le 5 attività più affini semanticamente.`
            : `La bio è assente. Basa il matching esclusivamente sulle competenze${hasInterests ? ' e gli interessi' : ''} del volontario.`;

        // Activities section — include only fields needed for matching
        const activitiesSection = activities
            .slice(0, 15)
            .map((a, i) => ({
                index: i + 1,
                id: a.id,
                titolo: a.title,
                descrizione: a.description,
                categoria: a.category,
                competenzeRichieste: a.skills ?? [],
                npo: a.npoName,
            }));

        return `
Sei un coordinatore esperto di volontariato con 15 anni di esperienza nell'abbinare volontari e associazioni non-profit.
La tua specialità è capire il SENSO profondo dei profili, non solo le parole chiave.
Ad esempio: se un volontario "ama stare all'aria aperta e la natura" e un'associazione cerca "persone per pulire le spiagge", 
        il match è altissimo, anche se non compaiono parole identiche.

${volunteerSection}

## ATTIVITÀ DISPONIBILI
${JSON.stringify(activitiesSection, null, 2)}

## COMPITO
${matchInstruction}
Considera: affinità semantica tra bio/interessi e descrizione, corrispondenza competenze, categoria dell'attività.

## OUTPUT
Rispondi ESCLUSIVAMENTE con un JSON array (senza markdown, senza testo extra):
[
  {"id": "<activity_id>", "score": <0-100>, "reason": "<motivazione breve in italiano, max 12 parole>"},
  ...
]
Ordina dal match più alto al più basso. Massimo 5 risultati.
`.trim();
    }

    // ── Gemini API Call with Retry ──────────────────────────────────────────

    private async _callGeminiWithRetry(
        prompt: string,
        attempt: number
    ): Promise<GeminiMatch[]> {
        try {
            console.log(`[GeminiMatch] API call attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
            const model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            return this._parseResponse(text);
        } catch (error: any) {
            const msg: string = error?.message ?? '';

            // Daily quota exhausted → limit: 0 in response. Retrying is useless.
            const isDailyQuotaGone =
                msg.includes('limit: 0') ||
                msg.includes('PerDay') ||
                msg.includes('GenerateRequestsPerDayPerProject');

            if (isDailyQuotaGone) {
                console.warn('[GeminiMatch] Daily quota exhausted — not retrying.');
                throw new GeminiQuotaDailyError();
            }

            // Per-minute rate limit → retry with exponential backoff
            const isPerMinuteLimit =
                error?.status === 429 ||
                msg.includes('429') ||
                msg.includes('quota') ||
                msg.toLowerCase().includes('rate');

            if (isPerMinuteLimit && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(
                    `[GeminiMatch] Rate limit hit. Waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`
                );
                await this._sleep(delay);
                return this._callGeminiWithRetry(prompt, attempt + 1);
            }

            console.error('[GeminiMatch] API call failed after retries:', error);
            throw error;
        }
    }

    // ── Response Parsing ────────────────────────────────────────────────────

    private _parseResponse(text: string): GeminiMatch[] {
        try {
            // Strip markdown code fences if present
            const cleaned = text
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed)) {
                console.error('[GeminiMatch] Response is not an array:', parsed);
                return [];
            }

            return parsed
                .filter(
                    (item: any) =>
                        typeof item.id === 'string' &&
                        typeof item.score === 'number' &&
                        typeof item.reason === 'string'
                )
                .slice(0, 5);
        } catch (e) {
            console.error('[GeminiMatch] Failed to parse Gemini response:', text, e);
            return [];
        }
    }

    // ── Cache Helpers ───────────────────────────────────────────────────────

    private async _readCache(key: string): Promise<GeminiMatch[] | null> {
        try {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) return null;
            const cached: CachedResult = JSON.parse(raw);
            const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;
            if (isExpired) {
                await AsyncStorage.removeItem(key);
                return null;
            }
            return cached.matches;
        } catch {
            return null;
        }
    }

    private async _writeCache(key: string, matches: GeminiMatch[]): Promise<void> {
        try {
            const payload: CachedResult = { matches, timestamp: Date.now() };
            await AsyncStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.warn('[GeminiMatch] Cache write failed:', e);
        }
    }

    // ── Utilities ───────────────────────────────────────────────────────────

    private _sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const geminiMatchService = new GeminiMatchService();
