// Stesso criterio del vincolo del database (activity_participants_email_format / applications_email_format):
// una sola chiocciola, niente spazi, un punto nel dominio, al massimo 254 caratteri.
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmailInput(value: string | null | undefined): string {
    return (value ?? "").trim();
}

export function isValidEmail(value: string | null | undefined): boolean {
    const email = normalizeEmailInput(value);
    return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}
