import type { ViewStyle } from "react-native";

import { palette } from "./primitives";

type ShadowStyle = Pick<ViewStyle, "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation">;

const staticShadows = {
  none: {},
  hairline: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBar: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
} as const satisfies Record<string, Partial<ShadowStyle>>;

export const shadows = {
  ...staticShadows,
  card: (tint: string = palette.purple900): ShadowStyle => ({
    shadowColor: tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  }),
  softCard: (tint: string = palette.purple900): ShadowStyle => ({
    shadowColor: tint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  }),
  floating: (tint: string = palette.purple900): ShadowStyle => ({
    shadowColor: tint,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  }),
};

export type ShadowToken = keyof typeof shadows;
