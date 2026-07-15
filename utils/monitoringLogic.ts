/**
 * Logica pura (nessun import RN/Expo/Sentry) estratta da monitoring.ts per poterla testare in
 * Node puro senza dover inizializzare la piattaforma. Decide come un errore viene classificato
 * per Sentry (severità, breadcrumb vs eccezione) e quali messaggi sono "attesi" (errori di
 * validazione utente) da non trattare come bug applicativi.
 *
 * Comportamento invariato rispetto a monitoring.ts: solo estratto per essere testabile
 * (vedi scripts/test_monitoring_contract.ts).
 */

export type TelemetryPriority = "critical" | "high" | "normal" | "low";
export type TelemetryClassification = "expected_user" | "warning_functional" | "error_technical" | "critical_crash";

export interface ClassificationInput {
    priority?: TelemetryPriority;
    classification?: TelemetryClassification;
    expected?: boolean;
}

export function toError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

export function normalizeErrorMessage(error: unknown): string {
    return toError(error).message.trim();
}

export function getPriorityLevel(priority: TelemetryPriority) {
    switch (priority) {
        case "critical":
            return "fatal";
        case "high":
            return "error";
        case "normal":
            return "error";
        case "low":
            return "warning";
        default:
            return "error";
    }
}

export function getClassification(options?: ClassificationInput): TelemetryClassification {
    if (options?.expected) return "expected_user";
    if (options?.classification) return options.classification;

    switch (options?.priority) {
        case "critical":
            return "critical_crash";
        case "high":
            return "error_technical";
        case "normal":
            return "warning_functional";
        case "low":
            return "expected_user";
        default:
            return "error_technical";
    }
}

export function getClassificationLevel(classification: TelemetryClassification) {
    switch (classification) {
        case "critical_crash":
            return getPriorityLevel("critical");
        case "error_technical":
            return getPriorityLevel("high");
        case "warning_functional":
            return getPriorityLevel("normal");
        case "expected_user":
            return getPriorityLevel("low");
        default:
            return getPriorityLevel("normal");
    }
}

export const EXPECTED_USER_ERROR_MATCHERS = [
    "credenziali errate",
    "formato email non valido",
    "indirizzo email non valido",
    "inserisci la password",
    "missing required fields",
    "user already registered",
    "questo indirizzo email è già registrato",
    "la password deve contenere almeno 8 caratteri",
    "password: 8+ caratteri, 1 maiuscola, 1 numero",
    "permesso galleria necessario",
    "permesso calendario negato",
    "calendario non disponibile",
    "seleziona almeno",
    "compila tutti i campi",
    "compilate i campi obbligatori",
    "nessun file selezionato",
    "non puoi auto-segnalarti",
    "hai già una richiesta di verifica in revisione",
    "hai già invitato questo volontario oggi",
    "non puoi creare un'attività nel passato",
    "non puoi creare un’attività nel passato",
    "l'orario di fine deve essere successivo",
    "l’orario di fine deve essere successivo",
    "data o orario non validi",
    "seleziona un indirizzo dalla lista",
    "solo i volontari possono inviare feedback",
    "seleziona un punteggio prima di inviare",
    "utente non disponibile",
    "una sessione attiva è già presente",
    "sessione non valida",
    "email rate limit exceeded",
    "password non coincidono",
    "le nuove password non coincidono",
    "nessuna modifica rilevata",
];

export function isExpectedUserInputError(error: unknown): boolean {
    const message = normalizeErrorMessage(error).toLowerCase();
    return EXPECTED_USER_ERROR_MATCHERS.some((matcher) => message.includes(matcher));
}
