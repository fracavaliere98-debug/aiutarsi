import AsyncStorage from '@react-native-async-storage/async-storage';

type SmartMatchPreferences = {
    hiddenActivityIds: string[];
    savedActivityIds: string[];
    seenActivityIds: string[];
    likedActivityIds: string[];
    likedCategories: string[];
    likedNpoIds: string[];
    updatedAt: string | null;
};

const emptyPreferences = (): SmartMatchPreferences => ({
    hiddenActivityIds: [],
    savedActivityIds: [],
    seenActivityIds: [],
    likedActivityIds: [],
    likedCategories: [],
    likedNpoIds: [],
    updatedAt: null,
});

class SmartMatchPreferencesService {
    private getKey(userId: string) {
        return `@smart_match_prefs_${userId}`;
    }

    async getPreferences(userId: string): Promise<SmartMatchPreferences> {
        try {
            const raw = await AsyncStorage.getItem(this.getKey(userId));
            if (!raw) return emptyPreferences();

            const parsed = JSON.parse(raw);
            return {
                ...emptyPreferences(),
                ...parsed,
                hiddenActivityIds: Array.isArray(parsed?.hiddenActivityIds) ? parsed.hiddenActivityIds : [],
                savedActivityIds: Array.isArray(parsed?.savedActivityIds) ? parsed.savedActivityIds : [],
                seenActivityIds: Array.isArray(parsed?.seenActivityIds) ? parsed.seenActivityIds : [],
                likedActivityIds: Array.isArray(parsed?.likedActivityIds) ? parsed.likedActivityIds : [],
                likedCategories: Array.isArray(parsed?.likedCategories) ? parsed.likedCategories : [],
                likedNpoIds: Array.isArray(parsed?.likedNpoIds) ? parsed.likedNpoIds : [],
            };
        } catch {
            return emptyPreferences();
        }
    }

    private async savePreferences(userId: string, prefs: SmartMatchPreferences) {
        await AsyncStorage.setItem(
            this.getKey(userId),
            JSON.stringify({ ...prefs, updatedAt: new Date().toISOString() })
        );
    }

    async updatePreferences(
        userId: string,
        updater: (prefs: SmartMatchPreferences) => SmartMatchPreferences
    ) {
        const current = await this.getPreferences(userId);
        const next = updater(current);
        await this.savePreferences(userId, next);
        return next;
    }

    async toggleSaved(userId: string, activityId: string) {
        return this.updatePreferences(userId, (prefs) => {
            const saved = new Set(prefs.savedActivityIds);
            if (saved.has(activityId)) saved.delete(activityId);
            else saved.add(activityId);
            return { ...prefs, savedActivityIds: Array.from(saved) };
        });
    }

    async hideActivity(userId: string, activityId: string) {
        return this.updatePreferences(userId, (prefs) => ({
            ...prefs,
            hiddenActivityIds: Array.from(new Set([...prefs.hiddenActivityIds, activityId])),
            savedActivityIds: prefs.savedActivityIds.filter((id) => id !== activityId),
        }));
    }

    async markSeen(userId: string, activityId: string) {
        return this.updatePreferences(userId, (prefs) => ({
            ...prefs,
            seenActivityIds: Array.from(new Set([...prefs.seenActivityIds, activityId])),
        }));
    }

    async toggleLikedActivity(userId: string, activityId: string, category?: string, npoId?: string) {
        return this.updatePreferences(userId, (prefs) => {
            const likedActivityIds = new Set(prefs.likedActivityIds);
            const likedCategories = new Set(prefs.likedCategories);
            const likedNpoIds = new Set(prefs.likedNpoIds);

            if (likedActivityIds.has(activityId)) {
                likedActivityIds.delete(activityId);
                if (category) likedCategories.delete(category);
                if (npoId) likedNpoIds.delete(npoId);
            } else {
                likedActivityIds.add(activityId);
                if (category) likedCategories.add(category);
                if (npoId) likedNpoIds.add(npoId);
            }

            return {
                ...prefs,
                likedActivityIds: Array.from(likedActivityIds),
                likedCategories: Array.from(likedCategories),
                likedNpoIds: Array.from(likedNpoIds),
            };
        });
    }

    async resetHidden(userId: string) {
        return this.updatePreferences(userId, (prefs) => ({
            ...prefs,
            hiddenActivityIds: [],
        }));
    }
}

export const smartMatchPreferencesService = new SmartMatchPreferencesService();
