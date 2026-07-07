import { palette } from "./primitives";

export const colors = {
  primary: palette.purple700,
  accent: palette.pink600,

  background: palette.white,
  canvas: palette.gray50,
  surface: palette.white,
  surfaceMuted: palette.slate75,
  surfaceSubtle: palette.slate100,
  controlSurface: palette.gray90,
  overlay: "rgba(0,0,0,0.5)",

  text: palette.slate850,
  textStrong: palette.slate850,
  textSecondary: palette.slate550,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  textInverse: palette.white,

  border: palette.slate200,
  borderMuted: palette.slate100,
  borderStrong: palette.slate300,
  controlShadow: "#d1d9e6",

  success: palette.green500,
  successStrong: palette.green600,
  successSoft: palette.green100,

  warning: palette.amber500,
  warningStrong: palette.amber600,
  warningSoft: palette.amber75,

  danger: palette.red500,
  dangerStrong: palette.red600,
  dangerSoft: palette.red50,

  info: palette.blue500,
  infoStrong: palette.blue600,
  infoSoft: palette.blue75,

  disabled: palette.slate300,
  disabledText: palette.slate400,
  primarySoft: palette.purple100,
  accentSoft: palette.pink100,
  inverseSoft: "rgba(255,255,255,0.18)",
  white: palette.white,
  black: palette.black,
} as const;

export type ColorToken = keyof typeof colors;
