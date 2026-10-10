import type { Config } from "tailwindcss";

/**
 * Bloomberg-terminal design language.
 * Black canvas (#0A0A0A), amber command accent (#FF8C00), green/red P&L semantics,
 * and a dense monospace-leaning type scale tuned for multi-monitor trading desks.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#0A0A0A",
          panel: "#0F0F10",
          "panel-2": "#141416",
          "panel-3": "#1A1A1D",
          border: "#26262B",
          "border-soft": "#1C1C20",
          grid: "#1F1F23",
          amber: "#FF8C00",
          "amber-dim": "#B36300",
          "amber-soft": "#3a2503",
          gold: "#FFB400",
          up: "#2ECC71",
          "up-dim": "#1B7D45",
          down: "#FF3B3B",
          "down-dim": "#A11E1E",
          flat: "#8A8A93",
          blue: "#3B9DFF",
          cyan: "#22D3EE",
          violet: "#A78BFA",
          magenta: "#EC4899",
          text: "#E6E6E6",
          "text-dim": "#9A9AA3",
          "text-mute": "#5E5E66",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "13px" }],
        "3xs": ["9px", { lineHeight: "11px" }],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px #FF8C00, 0 0 18px rgba(255,140,0,0.25)",
      },
      keyframes: {
        flashUp: { "0%": { backgroundColor: "rgba(46,204,113,0.35)" }, "100%": { backgroundColor: "transparent" } },
        flashDown: { "0%": { backgroundColor: "rgba(255,59,59,0.35)" }, "100%": { backgroundColor: "transparent" } },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0.15" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
      },
      animation: {
        flashUp: "flashUp 0.6s ease-out",
        flashDown: "flashDown 0.6s ease-out",
        blink: "blink 1.4s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
