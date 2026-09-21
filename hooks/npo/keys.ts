const ANONYMOUS_NPO_KEY = "anonymous";

export const npoFollowerKeys = {
    all: ["npo-followers"] as const,
    list: (npoId?: string) => [...npoFollowerKeys.all, npoId ?? ANONYMOUS_NPO_KEY] as const,
};
