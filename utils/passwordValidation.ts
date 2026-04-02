export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
    return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

export function getPasswordRequirementsText(): string {
    return "La password deve contenere almeno 8 caratteri, una maiuscola e un numero.";
}

export function getPasswordRequirementsShortText(): string {
    return "Password: 8+ caratteri, 1 maiuscola, 1 numero.";
}
