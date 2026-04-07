import type { GameMode, ThemeName } from "./app-types";

export const APP_TRANSLATIONS = {
  "en-US": {
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
      language: "Language",
    },
    languages: {
      "en-US": "English",
      "es-ES": "español",
      "pt-PT": "português",
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
      optimizerWorkerFailed: "optimizer worker failed.",
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
      languagePicker: "Language picker",
      projectInformation: "Project information",
      closeAboutDialog: "Close about dialog",
    },
  },
  "es-ES": {
    app: {
      connect4: "Connect 4",
      trainer: "Entrenador",
      title: "Entrenador de Connect 4",
    },
    mode: {
      training: "Entrenamiento",
      freeplay: "Juego libre",
    },
    controls: {
      reset: "Reiniciar",
      undo: "Deshacer",
      redo: "Rehacer",
      settings: "Ajustes",
      statistics: "Estadisticas",
      about: "Acerca de",
      playerSettings: "Ajustes del jugador",
      difficulty: "Dificultad",
      playerColor: "Color del jugador",
      theme: "Tema",
      sound: "Sonido",
      colorblindMode: "Modo daltonico",
      devMode: "Modo de desarrollo",
      language: "Idioma",
    },
    languages: {
      "en-US": "English",
      "es-ES": "español",
      "pt-PT": "português",
    },
    features: {
      trainingTools: "Herramientas de entrenamiento",
      display: "Visualizacion",
      bestMove: "Mejor jugada",
      moveScores: "Puntuaciones de jugadas",
      performanceComparison: "Comparacion de rendimiento",
    },
    colors: {
      red: "Rojo",
      yellow: "Amarillo",
      alternate: "Alterno",
    },
    themes: {
      light: "Claro",
      dark: "Oscuro",
      midnight: "Astronomo",
      greece: "Greece",
      grease: "Grease",
      mogged: "Mogged",
    },
    stats: {
      title: "Estadisticas",
      headers: {
        metric: "Metrica",
        today: "Hoy",
        lifetime: "Historico",
      },
      metrics: {
        wins: "Victorias",
        losses: "Derrotas",
        ties: "Empates",
        winRate: "Tasa de victorias",
        averageWinLength: "Prom. de jugadas al ganar",
        averageLossLength: "Prom. de jugadas al perder",
        biggestWin: "Mayor victoria",
        biggestLoss: "Mayor derrota",
        winsWithoutUndo: "Victorias sin deshacer",
        winsWithoutAssist: "Victorias sin ayuda",
        lossesUndone: "Derrotas deshechas",
        lostMultipleTimes: "Perdio varias veces",
        resetCount: "Numero de reinicios",
        resetsWhileLosing: "Reinicios mientras iba perdiendo",
        averageGameTime: "Tiempo medio de partida",
        fastestWin: "Victoria mas rapida",
      },
    },
    about: {
      title: "Acerca de Connect 4 Trainer",
      tabs: {
        about: "Acerca de",
        howto: "Instrucciones",
        credits: "Creditos",
      },
      sections: {
        howToPlay: "Como jugar",
        trainingTools: "Herramientas de entrenamiento",
        attribution: "Atribucion",
        links: "Enlaces",
        broughtToYouBy: "Presentado por:",
      },
      panels: {
        about: {
          welcomeHtml:
            'Bienvenido a Connect 4 Trainer, presentado por <a class="appmogged-link" href="https://appmogged.com" target="_blank" rel="noreferrer">Appmogged</a>.',
          overview:
            "Connect 4 Trainer es una aplicacion de entrenamiento para navegador pensada para estudiar aperturas de Connect 4, evaluar jugadas y practicar contra un oponente impulsado por un solucionador.",
          exactSolve:
            "El calculo exacto se ejecuta en el dispositivo del usuario mediante WebAssembly, y las posiciones resueltas se guardan en la caché del navegador con IndexedDB para reutilizarlas.",
        },
        howto: {
          rules: {
            first: "Dos jugadores alternan dejando caer fichas en las siete columnas del tablero.",
            second: "Las fichas caen al espacio libre mas bajo de esa columna.",
            third: "El primer jugador que conecte cuatro fichas en horizontal, vertical o diagonal gana.",
            fourth: "Si el tablero se llena sin un cuatro en linea, la partida termina en empate.",
          },
          tools: {
            bestMove:
              "<strong>Mejor jugada</strong>: muestra fichas verdes de ayuda en las columnas mas fuertes segun el solucionador para la posicion actual.",
            moveScores:
              "<strong>Puntuaciones de jugadas</strong>: muestra la puntuacion ajustada del solucionador para cada columna jugable encima del tablero.",
            performanceComparison:
              "<strong>Comparacion de rendimiento</strong>: compara la calidad media acumulada de las jugadas rojas y amarillas durante la partida actual.",
          },
        },
        credits: {
          attributionIntro: "Este proyecto se basa en dos trabajos previos de solucionadores:",
          pascal: "El trabajo original del solucionador de Connect 4 de Pascal Pons",
          benjamin: "La implementacion del solucionador en Rust/WASM de Benjamin Rall",
          greecePhoto:
            'Fondo de Greece: foto de <a href="https://www.pexels.com/photo/clouds-over-ruins-13748597/" target="_blank" rel="noreferrer">Maksim Romashkin</a>',
          greasePhoto:
            'Fondo de Grease: foto de <a href="https://www.pexels.com/photo/retro-style-restaurant-2927586/" target="_blank" rel="noreferrer">Darya Sannikova</a>',
        },
      },
    },
    status: {
      redWins: "Gana rojo",
      yellowWins: "Gana amarillo",
      tie: "Empate",
      yourMove: "Tu turno",
      thinking: "Pensando...",
      playingColumn: "Jugando columna {column}",
      redTurn: "Turno de rojo",
      yellowTurn: "Turno de amarillo",
      lineIn: "{color} en {count}",
      lineColor: {
        red: "rojo",
        yellow: "amarillo",
      },
      optimizerWorkerFailed: "fallo del worker del optimizador.",
    },
    accessibility: {
      menus: "Menus",
      connectGrid: "Tablero de Connect 4",
      historyControls: "Controles del historial",
      settingsMenu: "Menu de ajustes",
      trainingDisplayControls: "Controles de visualizacion de entrenamiento",
      practiceDifficulty: "Dificultad de practica",
      freeplayControls: "Controles de juego libre",
      practiceColor: "Color de practica",
      themePicker: "Selector de tema",
      languagePicker: "Selector de idioma",
      projectInformation: "Informacion del proyecto",
      closeAboutDialog: "Cerrar dialogo de informacion",
    },
  },
  "pt-PT": {
    app: {
      connect4: "Connect 4",
      trainer: "Treinador",
      title: "Treinador de Connect 4",
    },
    mode: {
      training: "Treino",
      freeplay: "Jogo livre",
    },
    controls: {
      reset: "Reiniciar",
      undo: "Desfazer",
      redo: "Refazer",
      settings: "Definicoes",
      statistics: "Estatisticas",
      about: "Sobre",
      playerSettings: "Definicoes do jogador",
      difficulty: "Dificuldade",
      playerColor: "Cor do jogador",
      theme: "Tema",
      sound: "Som",
      colorblindMode: "Modo daltonico",
      devMode: "Modo de desenvolvimento",
      language: "Idioma",
    },
    languages: {
      "en-US": "English",
      "es-ES": "español",
      "pt-PT": "português",
    },
    features: {
      trainingTools: "Ferramentas de treino",
      display: "Visualizacao",
      bestMove: "Melhor jogada",
      moveScores: "Pontuacoes das jogadas",
      performanceComparison: "Comparacao de desempenho",
    },
    colors: {
      red: "Vermelho",
      yellow: "Amarelo",
      alternate: "Alternado",
    },
    themes: {
      light: "Claro",
      dark: "Escuro",
      midnight: "Astronomo",
      greece: "Greece",
      grease: "Grease",
      mogged: "Mogged",
    },
    stats: {
      title: "Estatisticas",
      headers: {
        metric: "Metrica",
        today: "Hoje",
        lifetime: "Historico",
      },
      metrics: {
        wins: "Vitorias",
        losses: "Derrotas",
        ties: "Empates",
        winRate: "Taxa de vitorias",
        averageWinLength: "Media de jogadas para vencer",
        averageLossLength: "Media de jogadas para perder",
        biggestWin: "Maior vitoria",
        biggestLoss: "Maior derrota",
        winsWithoutUndo: "Vitorias sem desfazer",
        winsWithoutAssist: "Vitorias sem ajuda",
        lossesUndone: "Derrotas desfeitas",
        lostMultipleTimes: "Perdeu varias vezes",
        resetCount: "Numero de reinicios",
        resetsWhileLosing: "Reinicios enquanto estava a perder",
        averageGameTime: "Tempo medio de jogo",
        fastestWin: "Vitoria mais rapida",
      },
    },
    about: {
      title: "Sobre o Connect 4 Trainer",
      tabs: {
        about: "Sobre",
        howto: "Instrucoes",
        credits: "Creditos",
      },
      sections: {
        howToPlay: "Como jogar",
        trainingTools: "Ferramentas de treino",
        attribution: "Atribuicao",
        links: "Ligacoes",
        broughtToYouBy: "Apresentado por:",
      },
      panels: {
        about: {
          welcomeHtml:
            'Bem-vindo ao Connect 4 Trainer, apresentado pela <a class="appmogged-link" href="https://appmogged.com" target="_blank" rel="noreferrer">Appmogged</a>.',
          overview:
            "O Connect 4 Trainer e uma aplicacao de treino para navegador criada para estudar aberturas de Connect 4, avaliar jogadas e praticar contra um adversario orientado por um solucionador.",
          exactSolve:
            "O calculo exato e executado no dispositivo do utilizador em WebAssembly, e as posicoes resolvidas ficam em cache no navegador com IndexedDB para reutilizacao.",
        },
        howto: {
          rules: {
            first: "Dois jogadores alternam a colocacao de pecas nas sete colunas do tabuleiro.",
            second: "As pecas caem para o espaco livre mais baixo dessa coluna.",
            third: "O primeiro jogador a ligar quatro pecas na horizontal, vertical ou diagonal vence.",
            fourth: "Se o tabuleiro encher sem haver quatro em linha, a partida termina empatada.",
          },
          tools: {
            bestMove:
              "<strong>Melhor jogada</strong>: mostra pecas verdes de ajuda nas colunas mais fortes segundo o solucionador para a posicao atual.",
            moveScores:
              "<strong>Pontuacoes das jogadas</strong>: mostra a pontuacao ajustada do solucionador para cada coluna jogavel acima do tabuleiro.",
            performanceComparison:
              "<strong>Comparacao de desempenho</strong>: compara a qualidade media acumulada das jogadas vermelhas e amarelas durante o jogo atual.",
          },
        },
        credits: {
          attributionIntro: "Este projeto assenta em dois trabalhos anteriores de solucionadores:",
          pascal: "O trabalho original do solucionador de Connect 4 de Pascal Pons",
          benjamin: "A implementacao do solucionador em Rust/WASM de Benjamin Rall",
          greecePhoto:
            'Fundo de Greece: foto de <a href="https://www.pexels.com/photo/clouds-over-ruins-13748597/" target="_blank" rel="noreferrer">Maksim Romashkin</a>',
          greasePhoto:
            'Fundo de Grease: foto de <a href="https://www.pexels.com/photo/retro-style-restaurant-2927586/" target="_blank" rel="noreferrer">Darya Sannikova</a>',
        },
      },
    },
    status: {
      redWins: "Vence vermelho",
      yellowWins: "Vence amarelo",
      tie: "Empate",
      yourMove: "A tua jogada",
      thinking: "A pensar...",
      playingColumn: "A jogar a coluna {column}",
      redTurn: "Vez do vermelho",
      yellowTurn: "Vez do amarelo",
      lineIn: "{color} em {count}",
      lineColor: {
        red: "vermelho",
        yellow: "amarelo",
      },
      optimizerWorkerFailed: "falha do worker do otimizador.",
    },
    accessibility: {
      menus: "Menus",
      connectGrid: "Tabuleiro de Connect 4",
      historyControls: "Controlos do historico",
      settingsMenu: "Menu de definicoes",
      trainingDisplayControls: "Controlos de visualizacao do treino",
      practiceDifficulty: "Dificuldade de treino",
      freeplayControls: "Controlos do jogo livre",
      practiceColor: "Cor de treino",
      themePicker: "Seletor de tema",
      languagePicker: "Seletor de idioma",
      projectInformation: "Informacao do projeto",
      closeAboutDialog: "Fechar dialogo sobre a aplicacao",
    },
  },
} as const;

type TranslationMap = typeof APP_TRANSLATIONS;
export type AppLocale = keyof TranslationMap;
export type AppStrings = TranslationMap[AppLocale];

export const APP_LANGUAGE_OPTIONS = [
  { locale: "en-US", label: "English" },
  { locale: "es-ES", label: "español" },
  { locale: "pt-PT", label: "português" },
] as const satisfies ReadonlyArray<{ locale: AppLocale; label: string }>;

const APP_LOCALE_FALLBACKS: Record<string, AppLocale> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
};

export const DEFAULT_APP_LOCALE: AppLocale = "en-US";

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
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);

  if (typeof value !== "string") {
    throw new Error(`Missing translation key: ${key}`);
  }

  return value;
}

function normalizeLocale(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  return candidate.trim() || null;
}

export function isAppLocale(value: string): value is AppLocale {
  return value in APP_TRANSLATIONS;
}

export function resolveAppLocale(candidate: string | null | undefined): AppLocale {
  const normalized = normalizeLocale(candidate);
  if (!normalized) {
    return DEFAULT_APP_LOCALE;
  }

  if (isAppLocale(normalized)) {
    return normalized;
  }

  const fallback = APP_LOCALE_FALLBACKS[normalized.toLowerCase().split("-")[0]];
  return fallback ?? DEFAULT_APP_LOCALE;
}

export let APP_LOCALE: AppLocale = DEFAULT_APP_LOCALE;
export let APP_STRINGS: AppStrings = APP_TRANSLATIONS[DEFAULT_APP_LOCALE];

export function setAppLocale(nextLocale: AppLocale): void {
  APP_LOCALE = nextLocale;
  APP_STRINGS = APP_TRANSLATIONS[nextLocale];
  if (typeof document !== "undefined") {
    document.documentElement.lang = nextLocale;
  }
}

setAppLocale(resolveAppLocale(typeof navigator === "undefined" ? null : navigator.language));

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
