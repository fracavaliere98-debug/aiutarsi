import { useContext, useMemo } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useBottomScreenInset(extraSpacing = 8) {
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const insets = useSafeAreaInsets();

    return useMemo(() => {
        if (tabBarHeight > 0) {
            return tabBarHeight + extraSpacing;
        }

        return insets.bottom + extraSpacing;
    }, [extraSpacing, insets.bottom, tabBarHeight]);
}
