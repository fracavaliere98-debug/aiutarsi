/**
 * Logica pura (nessun hook, nessun componente) estratta da ActivityForm.tsx e dai suoi wrapper
 * (create-activity.tsx, edit-activity/[id].tsx) proprio per poterla testare senza rendering.
 *
 * Ogni funzione qui replica 1:1 un pezzo di comportamento che prima viveva inline nei componenti:
 * comportamento invariato, solo estratto per essere testabile da uno script backend
 * (vedi scripts/test_activity_form_contract.ts).
 */
import type { ActivityFormValues } from "./ActivityForm";

export type ActivityFormMode = "create" | "edit";

export type RequiredFieldsSubset = Pick<ActivityFormValues, "title" | "address" | "description" | "endTime" | "date">;

/** Tutti i campi obbligatori del form sono valorizzati. */
export function hasAllRequiredFields(values: RequiredFieldsSubset): boolean {
    return !!(values.title && values.address && values.description && values.endTime && values.date);
}

/** L'orario di fine non è strettamente successivo a quello di inizio (stesso giorno). */
export function isEndBeforeOrEqualStart(date: string, startTime: string, endTime: string): boolean {
    return new Date(`${date}T${endTime}:00`) <= new Date(`${date}T${startTime}:00`);
}

/**
 * Stato iniziale di "indirizzo confermato dai suggerimenti": vero solo quando il form si popola
 * con un indirizzo già noto (edit, duplicazione, bozza AI riuscita). Se l'indirizzo arriva vuoto
 * (creazione da zero, o fallback generico della bozza AI) parte non confermato.
 */
export function getInitialCoordsConfirmed(address: string): boolean {
    return !!address;
}

/**
 * La conferma indirizzo blocca l'invio solo in creazione (comportamento storico): in modifica
 * l'attività esiste già con coordinate valide e non è mai stata soggetta a questo controllo.
 */
export function shouldBlockSubmitForUnconfirmedAddress(mode: ActivityFormMode, coordsConfirmed: boolean): boolean {
    return mode === "create" && !coordsConfirmed;
}

export type ActivityFormValidationResult = { ok: true } | { ok: false; message: string };

/**
 * Replica esatta (stesso ordine, stessi messaggi) delle tre validazioni sincrone di handleSubmit
 * in ActivityForm.tsx, prima che i valori vengano passati a onSubmit.
 */
export function validateActivityFormSubmit(
    mode: ActivityFormMode,
    values: ActivityFormValues,
    coordsConfirmed: boolean
): ActivityFormValidationResult {
    if (!hasAllRequiredFields(values)) {
        return { ok: false, message: "Compila tutti i campi obbligatori, inclusa la data e l'orario di fine." };
    }
    if (shouldBlockSubmitForUnconfirmedAddress(mode, coordsConfirmed)) {
        return { ok: false, message: "Seleziona un indirizzo dalla lista dei suggerimenti." };
    }
    if (isEndBeforeOrEqualStart(values.date, values.startTime, values.endTime)) {
        return { ok: false, message: "L'orario di fine deve essere successivo all'orario di inizio." };
    }
    return { ok: true };
}

export type AutoCurateParams = {
    autoCurateOnLoad: boolean;
    title: string;
    isCuratingDraft: boolean;
    hasAutoCuratedDraft: boolean;
};

/**
 * Replica del guard dell'effetto di auto-rifinitura AI: parte una sola volta, solo quando il
 * caller ha chiesto autoCurateOnLoad (tipicamente arrivando da "Rilancia con AI"), il titolo è
 * valorizzato, e non è già in corso o già stata eseguita.
 */
export function shouldAutoCurateDraft({ autoCurateOnLoad, title, isCuratingDraft, hasAutoCuratedDraft }: AutoCurateParams): boolean {
    return autoCurateOnLoad && !!title.trim() && !isCuratingDraft && !hasAutoCuratedDraft;
}

export type UrgentActivityLike = {
    id?: string;
    npoId: string;
    isUrgent: boolean;
    status: string;
};

const ACTIVE_URGENT_STATUSES = new Set(["APERTA", "IN_CORSO"]);

/**
 * Conta le attività urgenti attive di un ente (usato sia da create per il conteggio totale, sia
 * da edit per il conteggio "altre" attività urgenti, escludendo quella corrente via excludeActivityId).
 */
export function countActiveUrgentActivities(
    activities: UrgentActivityLike[],
    npoId: string | undefined,
    excludeActivityId?: string
): number {
    return activities.filter(
        (a) =>
            a.npoId === npoId &&
            a.isUrgent &&
            ACTIVE_URGENT_STATUSES.has(a.status) &&
            (excludeActivityId === undefined || a.id !== excludeActivityId)
    ).length;
}

/**
 * Costruisce un Date da "YYYY-MM-DD" + "HH:mm", o null se non parsabile (replica il check isNaN
 * di create-activity.tsx). Nota: se ENTRAMBI date e time sono stringa vuota, il motore JS di V8
 * interpreta in modo lenient la stringa risultante "T:00" come una data valida (quirk noto di
 * `Date.parse`) — questa funzione non protegge da quel caso specifico, così come non lo faceva il
 * codice originale. In pratica non è raggiungibile: chi chiama questa funzione lo fa solo dopo che
 * `hasAllRequiredFields` ha già garantito che `date` non sia vuoto.
 */
export function parseDateTimeOrNull(date: string, time: string): Date | null {
    const parsed = new Date(`${date}T${time}:00`);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/** Un orario di inizio è nel passato rispetto a "now" (default: adesso). */
export function isStartInPast(start: Date, now: Date = new Date()): boolean {
    return start < now;
}

/**
 * Replica il guard di edit-activity/[id].tsx: un'attività che era già nel passato può essere
 * modificata liberamente; un'attività futura non può essere spostata nel passato.
 */
export function wasFutureActivityMovedToPast(originalDateTime: string, newStartISO: string, now: Date = new Date()): boolean {
    const wasInFuture = new Date(originalDateTime) > now;
    return wasInFuture && new Date(newStartISO) < now;
}
