import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark teal glass theme (visual-style.md — final decision, after
        // a light-theme detour). Keep new colors here, not as one-off hex
        // values in className strings.
        surface: {
          DEFAULT: "#0b1210",
          card: "#0d3b36",
        },
        accent: {
          DEFAULT: "#2dd4a0",
          dim: "#1f9c78",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backdropBlur: {
        xs: "2px",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
