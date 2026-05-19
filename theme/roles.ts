import { palette } from "./primitives";

export const roleColors = {
  volunteer: {
    solid: palette.purple700,
    accent: palette.pink600,
    soft: palette.purple50,
    softer: palette.purple75,
    border: "#ddd6fe",
    text: palette.purple900,
    contrastText: palette.white,
  },
  npo: {
    solid: palette.pink600,
    accent: palette.purple700,
    soft: palette.pink50,
    softer: palette.pink75,
    border: "#fbcfe8",
    text: palette.purple900,
    contrastText: palette.white,
  },
  corporate: {
    solid: palette.blue500,
    accent: palette.blue400,
    soft: palette.blue50,
    softer: palette.blue75,
    border: "#bfdbfe",
    text: "#172554",
    contrastText: palette.white,
  },
  admin: {
    solid: palette.purple800,
    accent: palette.purple400,
    soft: palette.purple100,
    softer: palette.slate75,
    border: palette.slate200,
    text: palette.slate900,
    contrastText: palette.white,
  },
} as const;

export type AppRole = keyof typeof roleColors;
