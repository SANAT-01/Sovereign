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
      // Slow ambient drift for the colored orbs behind liquid-glass panels
      // — gives the glass something moving to refract, so the
      // translucency reads as "liquid" rather than a flat tint.
      keyframes: {
        drift: {
          "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { transform: "translate3d(48px, -36px, 0) scale(1.15)" },
        },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite alternate",
        "drift-slow": "drift 26s ease-in-out infinite alternate-reverse",
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
