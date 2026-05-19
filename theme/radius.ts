export const radius = {
  none: 0,
  "2xs": 3,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  "2xl": 18,
  "3xl": 20,
  "4xl": 22,
  card: 24,
  cardLarge: 28,
  panel: 32,
  sheet: 40,
  circle: 999,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
