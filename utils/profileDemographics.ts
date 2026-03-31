export const GENDER_OPTIONS = [
    { value: "FEMALE", label: "Donna" },
    { value: "MALE", label: "Uomo" },
    { value: "OTHER", label: "Altro" },
    { value: "PREFER_NOT_TO_SAY", label: "Preferisco non dirlo" },
] as const;

export function normalizeBirthDateInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function birthDateToIso(value: string) {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const date = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getUTCFullYear() !== Number(yyyy) || date.getUTCMonth() + 1 !== Number(mm) || date.getUTCDate() !== Number(dd)) {
        return null;
    }
    return `${yyyy}-${mm}-${dd}`;
}

export function isoToBirthDateLabel(value?: string | null) {
    if (!value) return "";
    const [yyyy, mm, dd] = value.split("-");
    if (!yyyy || !mm || !dd) return "";
    return `${dd}/${mm}/${yyyy}`;
}

export function isAdult(isoDate: string, now = new Date()) {
    const birth = new Date(`${isoDate}T12:00:00`);
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age >= 18;
}

export function getAdultMaxDate(now = new Date()) {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - 18);
    return date;
}

type DemographicValidationParams = {
    gender: string;
    birthDateInput: string;
    existingGender?: string | null;
    existingDateOfBirth?: string | null;
    now?: Date;
};

export function validateVolunteerDemographics({
    gender,
    birthDateInput,
    existingGender,
    existingDateOfBirth,
    now,
}: DemographicValidationParams) {
    const resolvedGender = existingGender || gender;
    const resolvedBirthDate = existingDateOfBirth || birthDateToIso(birthDateInput);

    if (!resolvedGender) {
        return { ok: false as const, error: "Seleziona il sesso per completare il profilo." };
    }

    if (!resolvedBirthDate) {
        return { ok: false as const, error: "Inserisci una data di nascita valida." };
    }

    if (!isAdult(resolvedBirthDate, now)) {
        return { ok: false as const, error: "Per usare AiutarSì devi avere almeno 18 anni." };
    }

    return {
        ok: true as const,
        gender: resolvedGender,
        dateOfBirth: resolvedBirthDate,
    };
}
