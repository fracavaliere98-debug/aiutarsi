/**
 * Campi obbligatori dei moduli (onboarding volontario ed ente, 26/10/2026).
 * Logica pura, senza UI: dice quali campi mancano e prepara il messaggio di riepilogo.
 * Ogni campo mancante viene mostrato anche sotto il campo stesso (FieldError).
 */
export type RequiredField<K extends string = string> = {
    key: K;
    /** Nome del campo come lo legge l'utente, es. "Telefono". */
    label: string;
    value: unknown;
};

function isFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/** Campi vuoti, nello stesso ordine della schermata. */
export function getMissingRequiredFields<K extends string>(fields: RequiredField<K>[]): RequiredField<K>[] {
    return fields.filter((field) => !isFilled(field.value));
}

function joinLabels(labels: string[]): string {
    if (labels.length <= 1) return labels[0] ?? "";
    return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/** "Manca un campo obbligatorio: Telefono." / "Mancano 3 campi obbligatori: Missione, Indirizzo e Telefono." */
export function missingFieldsMessage(missing: Pick<RequiredField, "label">[]): string {
    const labels = missing.map((field) => field.label);
    if (labels.length === 0) return "";
    if (labels.length === 1) return `Manca un campo obbligatorio: ${labels[0]}.`;
    return `Mancano ${labels.length} campi obbligatori: ${joinLabels(labels)}.`;
}
