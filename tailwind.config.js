/** @type {import('tailwindcss').Config} */
const { colors, palette } = require("./theme/tailwind-tokens");

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — sourced from theme/tailwind-tokens.js
        primary: {
          DEFAULT: colors.primary,
          light: palette.purple600,
          dark: palette.purple800,
        },
        accent: {
          DEFAULT: colors.accent,
          hover: palette.pink700,
          light: palette.pink400,
        },
        background: {
          DEFAULT: colors.background,
          light: colors.background,
          dark: "#16131f",
        },
        canvas: colors.canvas,
        surface: colors.surface,
        "surface-muted": colors.surfaceMuted,
        "surface-subtle": colors.surfaceSubtle,
        text: {
          DEFAULT: colors.text,
          strong: colors.textStrong,
          secondary: colors.textSecondary,
          muted: colors.textMuted,
          subtle: colors.textSubtle,
          inverse: colors.textInverse,
        },
        border: {
          DEFAULT: colors.border,
          muted: colors.borderMuted,
          strong: colors.borderStrong,
        },
        success: {
          DEFAULT: colors.success,
          strong: colors.successStrong,
          soft: colors.successSoft,
        },
        warning: {
          DEFAULT: colors.warning,
          strong: colors.warningStrong,
          soft: colors.warningSoft,
        },
        danger: {
          DEFAULT: colors.danger,
          strong: colors.dangerStrong,
          soft: colors.dangerSoft,
        },
        info: {
          DEFAULT: colors.info,
          strong: colors.infoStrong,
          soft: colors.infoSoft,
        },
        disabled: {
          DEFAULT: colors.disabled,
          text: colors.disabledText,
        },
        // Legacy aliases — kept for backward compatibility with existing className usage
        corporate: {
          DEFAULT: "#0066cc",
          light: "#3385d6",
          dark: "#004c99",
        },
        npo: {
          DEFAULT: colors.accent,
          light: palette.pink400,
          dark: palette.pink700,
        },
      },
      fontFamily: {
        sans: ["Inter_400Regular", "System"],
        bold: ["Inter_700Bold", "System"],
        medium: ["Inter_500Medium", "System"],
      },
    },
  },
  plugins: [],
};
