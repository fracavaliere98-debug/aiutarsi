import { GamificationDerivedView, GamificationState } from "./types";

export const getXPForNextLevel = (level: number): number => {
    switch (level) {
        case 1: return 110;
        case 2: return 450;
        case 3: return 1000;
        case 4: return 2000;
        case 5: return 3500;
        case 6: return 5500;
        case 7: return 8000;
        case 8: return 11000;
        case 9: return 15000;
        default: return 15000 + (level - 9) * 5000;
    }
};

export const getXPForCurrentLevel = (level: number): number => {
    if (level === 1) return 0;
    return getXPForNextLevel(level - 1);
};

export const getLevelName = (level: number): string => {
    switch (level) {
        case 1: return "Novizio";
        case 2: return "Apprendista";
        case 3: return "Sociale";
        case 4: return "Attivo";
        case 5: return "Esperto";
        case 6: return "Mentore";
        case 7: return "Pilastro";
        case 8: return "Ambasciatore";
        case 9: return "Leader";
        default: return level >= 10 ? "Leggenda" : "Novizio";
    }
};

export function deriveGamificationView(state: GamificationState): GamificationDerivedView {
    const currentLevelXP = getXPForCurrentLevel(state.level);
    const nextLevelXP = getXPForNextLevel(state.level);
    const xpInLevel = Math.max(0, state.totalXP - currentLevelXP);
    const xpNeededForLevel = Math.max(0, nextLevelXP - currentLevelXP);
    const levelProgress = xpNeededForLevel === 0
        ? 100
        : Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));

    return {
        levelName: getLevelName(state.level),
        currentLevelXP,
        nextLevelXP,
        xpInLevel,
        xpNeededForLevel,
        levelProgress,
    };
}
