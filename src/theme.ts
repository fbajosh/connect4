import type { ThemeName } from "./app-types";

type ThemeTokens = Record<string, string>;

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
    "--trainer-fill": "#9fb86a",
    "--trainer-bezel": "#8ca25f",
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
    "--trainer-fill": "#4f5c35",
    "--trainer-bezel": "#475330",
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
    "--trainer-fill": "#8a4a54",
    "--trainer-bezel": "#7a414a",
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
    "--trainer-fill": "#9fb86a",
    "--trainer-bezel": "#8ca25f",
    "--win-ring": "#ec407a",
  },
};

export const THEME_ORDER: ThemeName[] = ["light", "dark", "midnight", "mogged"];

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

  return "Light";
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;

  for (const [token, value] of Object.entries(THEMES[theme])) {
    root.style.setProperty(token, value);
  }
}
