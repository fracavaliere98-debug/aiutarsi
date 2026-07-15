/**
 * Logica pura (nessun hook, nessuna chiamata Supabase/AsyncStorage) estratta da AuthContext.tsx
 * per poterla testare senza side-effect. Comportamento invariato rispetto all'originale, solo
 * isolato per essere testabile da uno script backend (vedi scripts/test_auth_contract.ts).
 */

export function hasRequiredRegistrationFields(userData: {
    email?: string;
    password?: string;
    full_name?: string | null;
    name?: string;
}): boolean {
    return !!(userData.email && userData.password && (userData.full_name || userData.name));
}

/** Chiavi AsyncStorage da rimuovere al logout/reset: tutto ciò che riguarda la sessione Supabase. */
export function getAuthStorageKeysToClear(keys: string[], supabaseProjectRef: string | null | undefined): string[] {
    return keys.filter((key) => (
        key.includes('supabase')
        || (supabaseProjectRef ? key.includes(supabaseProjectRef) : false)
        || key === 'auth_user'
    ));
}

/** Estrae il codice referral da un deep link tipo aiutarsiapp://referral/CODE o https://aiutarsi.app/referral/CODE. */
export function extractReferralCodeFromPath(path: string | null | undefined): string | null {
    if (!path || !path.includes('referral/')) return null;
    const code = path.split('referral/')[1];
    return code || null;
}

export interface RecentManualLogin {
    userId: string;
    at: number;
}

/** Evita di ri-processare un evento SIGNED_IN generato dal login manuale appena eseguito (entro 5s). */
export function shouldSkipSignInEvent(
    recentManualLogin: RecentManualLogin | null,
    sessionUserId: string | undefined,
    now: number
): boolean {
    if (!recentManualLogin || !sessionUserId) return false;
    return recentManualLogin.userId === sessionUserId && now - recentManualLogin.at < 5000;
}

export interface ProfileRealtimeFields {
    is_banned: boolean | null | undefined;
    ban_reason: string | null | undefined;
    ban_report_id: string | null | undefined;
    email: string | null | undefined;
    email_confirmed: boolean | null | undefined;
}

export interface ProfileRealtimePayload {
    is_banned?: boolean | null;
    ban_reason?: string | null;
    ban_report_id?: string | null;
    email?: string | null;
    email_confirmed?: boolean | null;
}

/** Calcola il prossimo stato ban/email da applicare dato l'evento Realtime su `profiles`. */
export function computeNextProfileRealtimeState<P extends ProfileRealtimeFields>(
    prev: P,
    payloadNew: ProfileRealtimePayload
): P {
    return {
        ...prev,
        is_banned: !!payloadNew.is_banned,
        ban_reason: payloadNew.ban_reason,
        ban_report_id: payloadNew.ban_report_id,
        email: (payloadNew.email || prev.email) as P['email'],
        email_confirmed: payloadNew.email_confirmed,
    };
}

/** True se il nuovo stato differisce da quello corrente (evita un setState/render inutile). */
export function hasRelevantProfileRealtimeChange(
    prev: ProfileRealtimeFields,
    next: ProfileRealtimeFields
): boolean {
    return (
        prev.is_banned !== next.is_banned
        || prev.ban_reason !== next.ban_reason
        || prev.ban_report_id !== next.ban_report_id
        || prev.email !== next.email
        || prev.email_confirmed !== next.email_confirmed
    );
}

/** True se l'email nel payload Realtime coincide con l'email di cambio email in sospeso (case/spazi-insensitive). */
export function isEmailChangeConfirmedByRealtime(
    pendingEmail: string | null | undefined,
    payloadEmail: unknown
): boolean {
    const normalizedPending = pendingEmail?.trim().toLowerCase();
    const normalizedPayload = typeof payloadEmail === 'string' ? payloadEmail.trim().toLowerCase() : null;
    return !!normalizedPending && !!normalizedPayload && normalizedPayload === normalizedPending;
}

export type AuthErrorTelemetryOptions = {
    priority: "low" | "high";
    classification: "expected_user" | "error_technical";
    expected: boolean;
};

/** Opzioni di telemetria per errori auth (login/register): gli errori attesi restano a bassa priorità. */
export function buildAuthErrorTelemetryOptions(expected: boolean): AuthErrorTelemetryOptions {
    return {
        priority: expected ? "low" : "high",
        classification: expected ? "expected_user" : "error_technical",
        expected,
    };
}
