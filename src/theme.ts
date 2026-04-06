import type { ThemeName } from "./app-types";

type ThemeTokens = Record<string, string>;
const ASSET_BASE = import.meta.env.BASE_URL ?? "/";
const GREECE_BG = `url("${ASSET_BASE}greece-bg.webp")`;
const GREASE_BG = `url("${ASSET_BASE}grease-bg.webp")`;

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    "--accent-color": "#788bd0",
    "--app-bg": "#181818",
    "--backdrop": "rgba(0, 0, 0, 0.62)",
    "--board-blue": "#5067b3",
    "--board-blue-bezel": "#6276bb",
    "--board-surface": "#5067b3",
    "--control-active-bg": "#31437c",
    "--control-bg": "#262626",
    "--control-border": "#4d4d4d",
    "--dev-bg": "#0f0f0f",
    "--modal-bg": "rgba(15, 15, 15, 0.98)",
    "--page-bg-image": "none",
    "--page-bg-overlay": "rgba(0, 0, 0, 0)",
    "--panel-bg": "rgba(19, 19, 19, 0.98)",
    "--piece-red": "#c65656",
    "--piece-red-bezel": "#b24d4d",
    "--piece-yellow": "#f0e08b",
    "--piece-yellow-bezel": "#d8ca7d",
    "--score-bar-red": "#c65656",
    "--score-bar-yellow": "#f0e08b",
    "--text-muted": "rgba(255, 255, 255, 0.38)",
    "--text-primary": "#ffffff",
    "--text-secondary": "#e7e7e7",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Ubuntu Sans\", sans-serif",
    "--win-ring": "#ffffff",
  },
  dark: {
    "--accent-color": "#4c5987",
    "--app-bg": "#0c0c0c",
    "--backdrop": "rgba(0, 0, 0, 0.74)",
    "--board-blue": "#28345a",
    "--board-blue-bezel": "#313f68",
    "--board-surface": "#28345a",
    "--control-active-bg": "#18203e",
    "--control-bg": "#131313",
    "--control-border": "#373737",
    "--dev-bg": "#090909",
    "--modal-bg": "rgba(8, 8, 8, 0.98)",
    "--page-bg-image": "none",
    "--page-bg-overlay": "rgba(0, 0, 0, 0)",
    "--panel-bg": "rgba(10, 10, 10, 0.98)",
    "--piece-red": "#632b2b",
    "--piece-red-bezel": "#582626",
    "--piece-yellow": "#786f45",
    "--piece-yellow-bezel": "#6a623d",
    "--score-bar-red": "#632b2b",
    "--score-bar-yellow": "#786f45",
    "--text-muted": "rgba(214, 214, 214, 0.4)",
    "--text-primary": "#d8d8d8",
    "--text-secondary": "#bebebe",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Ubuntu Sans\", sans-serif",
    "--win-ring": "#f5f5f5",
  },
  midnight: {
    "--accent-color": "#bb4657",
    "--app-bg": "#120608",
    "--backdrop": "rgba(16, 0, 2, 0.8)",
    "--board-blue": "#7a1e2c",
    "--board-blue-bezel": "#8d2c3b",
    "--board-surface": "#7a1e2c",
    "--control-active-bg": "#4e1116",
    "--control-bg": "#20090d",
    "--control-border": "#5a252b",
    "--dev-bg": "#170508",
    "--modal-bg": "rgba(23, 5, 8, 0.98)",
    "--page-bg-image": "none",
    "--page-bg-overlay": "rgba(0, 0, 0, 0)",
    "--panel-bg": "rgba(28, 8, 11, 0.98)",
    "--piece-red": "#d76a78",
    "--piece-red-bezel": "#bf5b67",
    "--piece-yellow": "#c89a91",
    "--piece-yellow-bezel": "#b0847c",
    "--score-bar-red": "#d76a78",
    "--score-bar-yellow": "#c89a91",
    "--text-muted": "rgba(255, 224, 229, 0.45)",
    "--text-primary": "#ffe7eb",
    "--text-secondary": "#e7c7ce",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Ubuntu Sans\", sans-serif",
    "--win-ring": "#fff6f7",
  },
  mogged: {
    "--accent-color": "#ab47bc",
    "--app-bg": "#090909",
    "--backdrop": "rgba(0, 0, 0, 0.76)",
    "--board-blue": "#c9548f",
    "--board-blue-bezel": "rgba(255, 255, 255, 0.26)",
    "--board-surface": "linear-gradient(90deg, #ec407a 0%, #ab47bc 100%)",
    "--control-active-bg": "#2c1327",
    "--control-bg": "#111111",
    "--control-border": "#3b3b3b",
    "--dev-bg": "#0c0c0c",
    "--modal-bg": "rgba(9, 9, 9, 0.98)",
    "--page-bg-image": "none",
    "--page-bg-overlay": "rgba(0, 0, 0, 0)",
    "--panel-bg": "rgba(14, 14, 14, 0.94)",
    "--piece-red": "#f5f5f5",
    "--piece-red-bezel": "#1c1c1c",
    "--piece-yellow": "#f5f5f5",
    "--piece-yellow-bezel": "#d2d2d2",
    "--score-bar-red": "#f5f5f5",
    "--score-bar-yellow": "#f5f5f5",
    "--text-muted": "rgba(255, 255, 255, 0.38)",
    "--text-primary": "#ffffff",
    "--text-secondary": "#ebebeb",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Ubuntu Sans\", sans-serif",
    "--win-ring": "#ec407a",
  },
  greece: {
    "--accent-color": "#ab47bc",
    "--app-bg": "#141414",
    "--backdrop": "rgba(0, 0, 0, 0.72)",
    "--board-blue": "#6b3f2d",
    "--board-blue-bezel": "#8a5942",
    "--board-surface":
      "repeating-linear-gradient(90deg, rgba(66, 34, 20, 0.38) 0 4.5%, rgba(0, 0, 0, 0.08) 4.5% 7%, rgba(122, 74, 48, 0.2) 7% 11%, rgba(0, 0, 0, 0.05) 11% 13%), linear-gradient(180deg, #7a4b35 0%, #5f3527 100%)",
    "--control-active-bg": "#5b3a58",
    "--control-bg": "rgba(24, 24, 24, 0.76)",
    "--control-border": "rgba(255, 255, 255, 0.22)",
    "--dev-bg": "rgba(12, 12, 12, 0.92)",
    "--modal-bg": "rgba(11, 11, 11, 0.94)",
    "--page-bg-image": GREECE_BG,
    "--page-bg-blur": "6px",
    "--page-bg-overlay": "rgba(0, 0, 0, 0.2)",
    "--panel-bg": "rgba(16, 16, 16, 0.84)",
    "--piece-red": "#f3efe7",
    "--piece-red-bezel": "#dbd5cb",
    "--piece-yellow": "#8b7b6b",
    "--piece-yellow-bezel": "#756657",
    "--score-bar-red": "#f3efe7",
    "--score-bar-yellow": "#8b7b6b",
    "--text-muted": "rgba(255, 255, 255, 0.38)",
    "--text-primary": "#ffffff",
    "--text-secondary": "#ececec",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Caesar Dressing\", serif",
    "--win-ring": "#ffffff",
  },
  grease: {
    "--accent-color": "#ab47bc",
    "--app-bg": "#111111",
    "--backdrop": "rgba(0, 0, 0, 0.74)",
    "--board-blue": "#9a2f3a",
    "--board-blue-bezel": "#bc5658",
    "--board-surface":
      "linear-gradient(160deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.09) 11%, rgba(255, 255, 255, 0) 32%), linear-gradient(180deg, #b63f47 0%, #861f2b 100%)",
    "--control-active-bg": "#5f264b",
    "--control-bg": "rgba(18, 18, 18, 0.78)",
    "--control-border": "rgba(255, 255, 255, 0.2)",
    "--dev-bg": "rgba(10, 10, 10, 0.92)",
    "--modal-bg": "rgba(10, 10, 10, 0.95)",
    "--page-bg-image": GREASE_BG,
    "--page-bg-blur": "6px",
    "--page-bg-overlay": "rgba(0, 0, 0, 0.2)",
    "--panel-bg": "rgba(14, 14, 14, 0.84)",
    "--piece-red": "#f3f3f3",
    "--piece-red-bezel": "#d8d8d8",
    "--piece-yellow": "#969ba4",
    "--piece-yellow-bezel": "#7a8089",
    "--score-bar-red": "#f3f3f3",
    "--score-bar-yellow": "#969ba4",
    "--text-muted": "rgba(255, 255, 255, 0.38)",
    "--text-primary": "#ffffff",
    "--text-secondary": "#ececec",
    "--trainer-fill": "rgba(173, 255, 92, 0.7)",
    "--trainer-bezel": "rgba(227, 255, 173, 0.7)",
    "--ui-font": "\"Atomic Age\", system-ui",
    "--win-ring": "#ffffff",
  },
};

export const THEME_ORDER: ThemeName[] = ["light", "dark", "midnight", "greece", "grease", "mogged"];

export function themeLabel(theme: ThemeName): string {
  if (theme === "dark") {
    return "Dark";
  }

  if (theme === "midnight") {
    return "Astronomer";
  }

  if (theme === "mogged") {
    return "Mogged";
  }

  if (theme === "greece") {
    return "Greece";
  }

  if (theme === "grease") {
    return "Grease";
  }

  return "Light";
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;

  for (const [token, value] of Object.entries(THEMES[theme])) {
    root.style.setProperty(token, value);
  }
}
