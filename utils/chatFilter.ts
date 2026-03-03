/**
 * chatFilter.ts
 * Client-side chat message filter.
 * Checks for banned words and basic spam patterns before sending.
 * For extra security, messages are also validated server-side via Edge Function.
 */

// ── Banned words list (Italian + English) ──────────────────────────────────
const BANNED_WORDS: string[] = [
    // Insulti IT
    'cazzo', 'vaffanculo', 'fanculo', 'stronzo', 'stronza', 'coglione', 'cogliona',
    'minchia', 'affanculo', 'porco', 'porca', 'figlio di puttana', 'figlio di troia',
    'bastardo', 'bastarda', 'idiota', 'imbecille', 'deficiente', 'scemo', 'scema',
    'cretino', 'cretina', 'ritardato', 'ritardata', 'mongoloide', 'handicappato',
    'puttana', 'troia', 'zoccola', 'mignotta', 'baldracca', 'meretrice',
    'negro', 'negra', 'terrone', 'terronaccio', 'sudicio', 'sudicia',
    'uccidi', 'ammazza', 'ammazzati', 'crepa', 'vattene a morire',
    // Insulti EN
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick',
    'nigger', 'faggot', 'retard', 'moron', 'idiot',
    // Spam/Scam patterns
    'clicca qui', 'click here', 'guadagna facile', 'earn money fast',
    'bitcoin', 'crypto', 'investimento sicuro', 'guaranteed profit',
    // Hate speech
    'odio i', 'preferisco morire', 'mi ammazzo', 'voglio morire',
];

// ── Spam patterns (regex) ────────────────────────────────────────────────
const SPAM_PATTERNS: RegExp[] = [
    /(.)\1{6,}/,                              // Same char repeated 7+ times (aaaaaaa)
    /https?:\/\/[^\s]+/gi,                   // URLs (can be enabled/disabled)
    /\b\d{10,}\b/,                            // Long number strings (phone spam)
    /[\u{1F600}-\u{1F6FF}]{5,}/u,            // 5+ consecutive emoji
];

// Simple in-memory rate limiter (per session)
const MESSAGE_TIMESTAMPS: number[] = [];
const RATE_LIMIT_WINDOW_MS = 10_000;   // 10 seconds
const RATE_LIMIT_MAX_MESSAGES = 6;     // max 6 messages per window

export type FilterResult =
    | { blocked: false }
    | { blocked: true; reason: 'banned_word'; word: string }
    | { blocked: true; reason: 'spam_pattern'; detail: string }
    | { blocked: true; reason: 'rate_limit' };

/**
 * Normalize text for matching: lowercase, remove accents, collapse spaces
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // strip accents
        .replace(/[^a-z0-9\s]/g, ' ')       // remove punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Run all client-side filter checks on a message.
 * Returns { blocked: false } if the message is clean.
 */
export function filterMessage(text: string): FilterResult {
    if (!text || !text.trim()) return { blocked: false };

    const normalized = normalize(text);

    // 1. Rate limit check
    const now = Date.now();
    // Remove timestamps outside the window
    while (MESSAGE_TIMESTAMPS.length > 0 && now - MESSAGE_TIMESTAMPS[0] > RATE_LIMIT_WINDOW_MS) {
        MESSAGE_TIMESTAMPS.shift();
    }
    if (MESSAGE_TIMESTAMPS.length >= RATE_LIMIT_MAX_MESSAGES) {
        return { blocked: true, reason: 'rate_limit' };
    }

    // 2. Banned word check
    for (const word of BANNED_WORDS) {
        const normalizedWord = normalize(word);
        // Use word boundary matching where possible
        if (normalized.includes(normalizedWord)) {
            return { blocked: true, reason: 'banned_word', word };
        }
    }

    // 3. Spam pattern check
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(text)) {
            return { blocked: true, reason: 'spam_pattern', detail: pattern.toString() };
        }
    }

    return { blocked: false };
}

/**
 * Record a successful message send (for rate limiting).
 * Call this AFTER the message is actually sent.
 */
export function recordMessageSent(): void {
    MESSAGE_TIMESTAMPS.push(Date.now());
}

/**
 * Human-readable error message from a FilterResult.
 */
export function getFilterErrorMessage(result: FilterResult & { blocked: true }): string {
    switch (result.reason) {
        case 'banned_word':
            return '⛔ Messaggio non consentito: contiene parole inappropriate.';
        case 'spam_pattern':
            return '⚠️ Messaggio bloccato: rilevato contenuto spam.';
        case 'rate_limit':
            return '🕐 Stai scrivendo troppo velocemente. Aspetta qualche secondo.';
        default:
            return '⛔ Messaggio non inviato.';
    }
}
