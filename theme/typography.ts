import type { TextStyle } from "react-native";

type TypographyStyle = Pick<TextStyle, "fontSize" | "lineHeight" | "fontWeight" | "letterSpacing">;

export const fontSize = {
  micro: 8,
  tiny: 9,
  overline: 10,
  caption: 11,
  label: 12,
  bodySmall: 13,
  body: 14,
  bodyLarge: 15,
  input: 16,
  cardTitle: 17,
  sectionTitle: 18,
  title: 20,
  titleLarge: 22,
  screenTitle: 24,
  hero: 28,
  display: 32,
  iconText: 40,
} as const;

export const lineHeight = {
  micro: 10,
  tiny: 12,
  caption: 14,
  label: 16,
  bodySmall: 18,
  body: 20,
  bodyLarge: 22,
  input: 22,
  cardTitle: 22,
  sectionTitle: 24,
  title: 26,
  screenTitle: 30,
  hero: 34,
  display: 38,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

export const typography = {
  micro: {
    fontSize: fontSize.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.black,
  },
  overline: {
    fontSize: fontSize.overline,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.black,
    letterSpacing: 1,
  },
  caption: {
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  label: {
    fontSize: fontSize.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.extrabold,
  },
  bodySmall: {
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
  },
  body: {
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.medium,
  },
  bodyLarge: {
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    fontWeight: fontWeight.medium,
  },
  bodyStrong: {
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    fontWeight: fontWeight.extrabold,
  },
  cardTitle: {
    fontSize: fontSize.cardTitle,
    lineHeight: lineHeight.cardTitle,
    fontWeight: fontWeight.black,
  },
  sectionTitle: {
    fontSize: fontSize.sectionTitle,
    lineHeight: lineHeight.sectionTitle,
    fontWeight: fontWeight.black,
  },
  title: {
    fontSize: fontSize.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.black,
  },
  screenTitle: {
    fontSize: fontSize.screenTitle,
    lineHeight: lineHeight.screenTitle,
    fontWeight: fontWeight.black,
  },
  hero: {
    fontSize: fontSize.hero,
    lineHeight: lineHeight.hero,
    fontWeight: fontWeight.black,
  },
} as const satisfies Record<string, TypographyStyle>;

export type TypographyToken = keyof typeof typography;
