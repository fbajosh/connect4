import type { GameMode, ThemeName } from "./app-types";

export const APP_TRANSLATIONS = {
  en: {
    app: {
      connect4: "Connect 4",
      trainer: "Trainer",
      title: "Connect 4 Trainer",
    },
    mode: {
      training: "Training",
      freeplay: "Freeplay",
    },
    controls: {
      reset: "Reset",
      undo: "Undo",
      redo: "Redo",
      settings: "Settings",
      statistics: "Statistics",
      about: "About",
      playerSettings: "Player Settings",
      difficulty: "Difficulty",
      playerColor: "Player Color",
      theme: "Theme",
      sound: "Sound",
      colorblindMode: "Colorblind Mode",
      devMode: "Dev Mode",
    },
    features: {
      trainingTools: "Training Tools",
      display: "Display",
      bestMove: "Best Move",
      moveScores: "Move Scores",
      performanceComparison: "Performance Comparison",
    },
    colors: {
      red: "Red",
      yellow: "Yellow",
      alternate: "Alternate",
    },
    themes: {
      light: "Light",
      dark: "Dark",
      midnight: "Astronomer",
      greece: "Greece",
      grease: "Grease",
      mogged: "Mogged",
    },
    stats: {
      title: "Statistics",
      headers: {
        metric: "Metric",
        today: "Today",
        lifetime: "Lifetime",
      },
      metrics: {
        wins: "Wins",
        losses: "Losses",
        ties: "Ties",
        winRate: "Win rate",
        averageWinLength: "Avg. win length",
        averageLossLength: "Avg. loss length",
        biggestWin: "Biggest win",
        biggestLoss: "Biggest loss",
        winsWithoutUndo: "Wins without undo",
        winsWithoutAssist: "Wins without assist",
        lossesUndone: "Losses undone",
        lostMultipleTimes: "Lost multiple times",
        resetCount: "Reset count",
        resetsWhileLosing: "Resets while losing",
        averageGameTime: "Avg. game time",
        fastestWin: "Fastest win",
      },
    },
    about: {
      title: "About Connect 4 Trainer",
      tabs: {
        about: "About",
        howto: "Instructions",
        credits: "Credits",
      },
      sections: {
        howToPlay: "How to Play",
        trainingTools: "Training Tools",
        attribution: "Attribution",
        links: "Links",
        broughtToYouBy: "Brought to you by:",
      },
      panels: {
        about: {
          welcomeHtml:
            'Welcome to the Connect 4 Trainer, brought to you by <a class="appmogged-link" href="https://appmogged.com" target="_blank" rel="noreferrer">Appmogged</a>.',
          overview:
            "Connect 4 Trainer is a browser-first training app for studying Connect 4 openings, evaluating moves, and practicing against a solver-driven opponent.",
          exactSolve:
            "Exact solve work runs on the end user's device in WebAssembly, and solved positions are cached in the browser with IndexedDB for reuse.",
        },
        howto: {
          rules: {
            first: "Two players alternate dropping discs into the seven columns of the board.",
            second: "Discs fall to the lowest open space in that column.",
            third: "The first player to connect four discs horizontally, vertically, or diagonally wins.",
            fourth: "If the board fills without a connect four, the game ends in a draw.",
          },
          tools: {
            bestMove:
              "<strong>Best Move</strong>: shows green hint discs in the strongest solver-backed columns for the current position.",
            moveScores:
              "<strong>Move Scores</strong>: shows the shifted solver score for each playable column above the board.",
            performanceComparison:
              "<strong>Performance Comparison</strong>: compares the running average quality of red and yellow moves over the current game.",
          },
        },
        credits: {
          attributionIntro: "This project builds on two upstream solver efforts:",
          pascal: "Pascal Pons' original Connect 4 solver work",
          benjamin: "Benjamin Rall's Rust/WASM solver implementation",
          greecePhoto:
            'Greece background: Photo by <a href="https://www.pexels.com/photo/clouds-over-ruins-13748597/" target="_blank" rel="noreferrer">Maksim Romashkin</a>',
          greasePhoto:
            'Grease background: Photo by <a href="https://www.pexels.com/photo/retro-style-restaurant-2927586/" target="_blank" rel="noreferrer">Darya Sannikova</a>',
        },
      },
    },
    status: {
      redWins: "Red wins",
      yellowWins: "Yellow wins",
      tie: "Tie",
      yourMove: "Your move",
      thinking: "Thinking...",
      playingColumn: "Playing Column {column}",
      redTurn: "Red's turn",
      yellowTurn: "Yellow's turn",
      lineIn: "{color} in {count}",
      lineColor: {
        red: "red",
        yellow: "yellow",
      },
    },
    accessibility: {
      menus: "Menus",
      connectGrid: "Connect 4 grid",
      historyControls: "History controls",
      settingsMenu: "Settings menu",
      trainingDisplayControls: "Training display controls",
      practiceDifficulty: "Practice difficulty",
      freeplayControls: "Freeplay controls",
      practiceColor: "Practice color",
      themePicker: "Theme picker",
      projectInformation: "Project information",
      closeAboutDialog: "Close about dialog",
    },
  },
} as const;

type TranslationMap = typeof APP_TRANSLATIONS;
export type AppLocale = keyof TranslationMap;
export type AppStrings = TranslationMap[AppLocale];
export const DEFAULT_APP_LOCALE: AppLocale = "en";

export const STATS_METRIC_ORDER = [
  "wins",
  "losses",
  "ties",
  "winRate",
  "averageWinLength",
  "averageLossLength",
  "biggestWin",
  "biggestLoss",
  "winsWithoutUndo",
  "winsWithoutAssist",
  "lossesUndone",
  "lostMultipleTimes",
  "resetCount",
  "resetsWhileLosing",
  "averageGameTime",
  "fastestWin",
] as const;

export type StatsMetricKey = typeof STATS_METRIC_ORDER[number];

function resolveTranslationValue(source: unknown, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((current, segment) => (current && typeof current === "object" ? (current as Record<string, unknown>)[segment] : undefined), source);

  if (typeof value !== "string") {
    throw new Error(`Missing translation key: ${key}`);
  }

  return value;
}

function normalizeLocale(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  return candidate.trim().toLowerCase() || null;
}

export function resolveAppLocale(candidate: string | null | undefined): AppLocale {
  const normalized = normalizeLocale(candidate);
  if (!normalized) {
    return DEFAULT_APP_LOCALE;
  }

  if (normalized in APP_TRANSLATIONS) {
    return normalized as AppLocale;
  }

  const baseLanguage = normalized.split("-")[0];
  if (baseLanguage in APP_TRANSLATIONS) {
    return baseLanguage as AppLocale;
  }

  return DEFAULT_APP_LOCALE;
}

export const APP_LOCALE = resolveAppLocale(typeof navigator === "undefined" ? null : navigator.language);
export const APP_STRINGS: AppStrings = APP_TRANSLATIONS[APP_LOCALE];

export function modeLabel(mode: GameMode, strings: AppStrings = APP_STRINGS): string {
  return mode === "freeplay" ? strings.mode.freeplay : strings.mode.training;
}

export function titleForMode(mode: GameMode, strings: AppStrings = APP_STRINGS): string {
  return `${strings.app.title} - ${modeLabel(mode, strings)}`;
}

export function themeLabel(theme: ThemeName, strings: AppStrings = APP_STRINGS): string {
  return strings.themes[theme];
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined ? "" : String(value);
  });
}

export function applyStaticTranslations(root: ParentNode, strings: AppStrings = APP_STRINGS): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    element.textContent = resolveTranslationValue(strings, element.dataset.i18n ?? "");
  }

  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) {
    element.innerHTML = resolveTranslationValue(strings, element.dataset.i18nHtml ?? "");
  }

  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", resolveTranslationValue(strings, element.dataset.i18nAriaLabel ?? ""));
  }
}
