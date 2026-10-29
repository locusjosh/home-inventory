import type { Config } from "tailwindcss";

/**
 * iOS-style semantic tokens. Colors resolve to CSS variables defined in
 * globals.css (light + html.dark). Type scale mirrors Apple HIG text styles.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "system-ui",
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          "system-ui",
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "large-title": ["34px", { lineHeight: "40px", letterSpacing: "-1.1px", fontWeight: "800" }],
        title1: ["28px", { lineHeight: "33px", letterSpacing: "-0.7px", fontWeight: "750" }],
        title2: ["22px", { lineHeight: "27px", letterSpacing: "-0.45px", fontWeight: "700" }],
        title3: ["20px", { lineHeight: "25px", letterSpacing: "-0.35px", fontWeight: "650" }],
        headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.43px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px", letterSpacing: "-0.41px" }],
        callout: ["16px", { lineHeight: "21px", letterSpacing: "-0.32px" }],
        subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.24px" }],
        footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0px" }],
        caption2: ["11px", { lineHeight: "13px", letterSpacing: "0.06px" }],
      },
      colors: {
        label: "var(--label)",
        "label-2": "var(--label-2)",
        "label-3": "var(--label-3)",
        separator: "var(--separator)",
        "bg-grouped": "var(--bg-grouped)",
        "bg-grouped-2": "var(--bg-grouped-2)",
        "bg-grouped-3": "var(--bg-grouped-3)",
        fill: "var(--fill)",
        "fill-2": "var(--fill-2)",
        "fill-3": "var(--fill-3)",
        "fill-4": "var(--fill-4)",
        tint: "var(--tint)",
        "tint-fill": "var(--tint-fill)",
        "tint-soft": "var(--tint-soft)",
        glass: "var(--glass)",
        "glass-strong": "var(--glass-strong)",
        "sys-red": "var(--red)",
        "sys-red-text": "var(--red-text)",
        "sys-orange": "var(--orange)",
        "sys-green": "var(--green)",
        bubble: "var(--bubble)",
        /* Legacy aliases (kept so any older markup still maps to iOS tokens) */
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
          3: "rgb(var(--surface-3) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        danger: "rgb(var(--danger) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
      },
      borderRadius: {
        ios: "12px",
        card: "20px",
        plate: "14px",
      },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
    },
  },
  plugins: [],
};
export default config;
