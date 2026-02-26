/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#462282",
          light: "#5e3a9a",
          dark: "#301560",
        },
        accent: {
          DEFAULT: "#cd057f",
          hover: "#a00465",
          light: "#e64ab0",
        },
        background: {
          light: "#FFFFFF",
          dark: "#16131f",
        },
        corporate: {
          DEFAULT: "#0066cc", // Professional Blue
          light: "#3385d6",
          dark: "#004c99",
        },
        npo: {
          DEFAULT: "#cd057f", // Accent color for NPO
          light: "#e64ab0",
          dark: "#a00465",
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
}
