import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppUser } from "../../types";
import { useGamificationStateQuery } from "./queries";
import { LevelUpData } from "./types";

export function useGamificationLevelUp(user?: AppUser | null) {
    const { data } = useGamificationStateQuery(user);
    const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);
    const prevLevelRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const checkLevelUp = async () => {
            if (!data || !user?.id) return;

            const currentLevel = data.level;
            const lastSeenLevelStr = await AsyncStorage.getItem(`last_seen_level_${user.id}`);
            const lastSeenLevel = lastSeenLevelStr ? parseInt(lastSeenLevelStr, 10) : 0;

            if (cancelled) return;

            if (prevLevelRef.current === null) {
                prevLevelRef.current = currentLevel;
                if (currentLevel > lastSeenLevel && lastSeenLevel > 0) {
                    setLevelUpData({ level: currentLevel });
                    await AsyncStorage.setItem(`last_seen_level_${user.id}`, currentLevel.toString());
                }
                return;
            }

            if (currentLevel !== prevLevelRef.current) {
                if (currentLevel > prevLevelRef.current && currentLevel > lastSeenLevel) {
                    setLevelUpData({ level: currentLevel });
                    await AsyncStorage.setItem(`last_seen_level_${user.id}`, currentLevel.toString());
                }
                prevLevelRef.current = currentLevel;
            }
        };

        void checkLevelUp();

        return () => {
            cancelled = true;
        };
    }, [data, user?.id]);

    const dismissLevelUp = useCallback(() => setLevelUpData(null), []);

    return {
        levelUpData,
        dismissLevelUp,
    };
}
