import { buildDevOutput } from "./dev-output";
import {
  type FeatureKey,
  type GameMode,
  type OptimizerErrorPayload,
  type OptimizerSuccessPayload,
  type OptimizerWorkerResponse,
  type PersistedUiState,
  type PracticeColor,
  type ThemeName,
} from "./app-types";
import {
  createBoard,
  detectWinningMask,
  EMPTY,
  EMPTY_BOARD_SCORES,
  HEIGHT,
  lowestOpenRow,
  nextPlayer,
  playerClass,
  RED,
  slotIndexFor,
  type BoardState,
  type PlayerValue,
  WIDTH,
  YELLOW,
} from "./game-rules";
import {
  choosePracticeAiColumn,
  effectivePracticeHumanPlayer,
  type PracticeAiDebug,
} from "./practice-ai";
import { shiftSolverScoresToDisplay } from "./score-display";
import {
  isThemeName,
  modeForPathname,
  pathForMode,
  readPersistedUiState,
  titleForMode,
  writePersistedUiState,
} from "./ui-persistence";
import { refreshPwaOfflineCache, registerPwaServiceWorker, stripPwaCacheRefreshParamFromUrl } from "./pwa";
import {
  APP_LANGUAGE_OPTIONS,
  APP_LOCALE,
  APP_STRINGS,
  applyStaticTranslations,
  formatTemplate,
  isAppLocale,
  resolveAppLocale,
  setAppLocale,
  STATS_METRIC_ORDER,
  type StatsMetricKey,
} from "./i18n";
import {
  appendPracticeGameResult,
  appendPracticeStat,
  buildPracticeDifficultyStats,
  createPracticeStatId,
  readStoredPracticeGameResults,
  readStoredPracticeStats,
  removePracticeGameResultByStatId,
  removePracticeStatById,
  type PracticeEventKind,
  type PracticeGameResult,
  type PracticeGameResultBlock,
  type PracticeGameResultMove,
  type PracticeGameResultRecord,
  type PracticeGameStat,
  type PracticeStatRecord,
  type PracticeStatsSummary,
} from "./stats";
import { createAudioController, ensureThemeFont, type SoundEffectKey } from "./media";
import { applyTheme } from "./theme";
import { createMoggedBackground } from "./mogged-background";

const FIXED_BOARD_FRAME_ROWS = 7.46;
const FIXED_BOARD_SHELL_BOTTOM_ROWS = 0.3;
const FIXED_SCORE_BAR_BOTTOM_ROWS = 0;
const FIXED_SCORE_BAR_HEIGHT_ROWS = 0.1;
const FIXED_TURN_INDICATOR_TOP_ROWS = 0.38;
const FIXED_TURN_INDICATOR_HEIGHT_ROWS = 0.16;
const FIXED_COLUMN_SCORE_TOP_ROWS = 0.74;
const FIXED_COLUMN_SCORE_HEIGHT_ROWS = 0.22;
const COMPACT_LANDSCAPE_MEDIA_QUERY = "(orientation: landscape) and (max-height: 560px) and (max-width: 980px)";
const PORTRAIT_DEV_RESIZE_MEDIA_QUERY = "(max-width: 980px) and (orientation: portrait)";
const BOARD_RESET_DOUBLE_TAP_WINDOW_MS = 320;
const BOARD_COMPLETE_TAP_SHAKE_DELAY_MS = 321;
const DEFAULT_DEV_PANEL_PORTRAIT_HEIGHT_RATIO = 0.22;
const MIN_DEV_PANEL_TEXTBOX_HEIGHT_PX = 72;
const MIN_DEV_PANEL_BOARD_SCALE = 0.38;
const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
const trainerGrid = document.getElementById("trainer-grid");
const discGrid = document.getElementById("disc-grid");
const landingRoot = document.querySelector<HTMLElement>(".landing");
const hero = document.querySelector<HTMLElement>(".hero");
const menuBar = document.querySelector<HTMLElement>(".menu-bar");
const boardStage = document.querySelector<HTMLElement>(".board-stage");
const boardArea = document.querySelector<HTMLElement>(".board-area");
const boardActions = document.querySelector<HTMLElement>(".board-actions");
const boardFrame = boardShell?.parentElement;
const titleControl = document.getElementById("title-control");
const scoreBar = document.getElementById("score-bar");
const scoreBarFill = document.getElementById("score-bar-fill");
const turnIndicator = document.getElementById("turn-indicator");
const compactTurnIndicator = document.getElementById("compact-turn-indicator");
const columnScoreRow = document.getElementById("column-score-row");
const previewPiece = document.getElementById("preview-piece");
const historyControls = document.getElementById("history-controls");
const statsControl = document.getElementById("stats-control");
const aboutControl = document.getElementById("about-control");
const trainingModeControl = document.getElementById("training-mode-control");
const freeplayModeControl = document.getElementById("freeplay-mode-control");
const aboutModal = document.getElementById("about-modal");
const aboutBackdrop = document.getElementById("about-backdrop");
const aboutDialog = document.getElementById("about-dialog");
const aboutTitle = document.getElementById("about-title");
const aboutClose = document.getElementById("about-close");
const undoControl = document.getElementById("undo-control");
const redoControl = document.getElementById("redo-control");
const resetControl = document.getElementById("reset-control");
const toolsMenuToggle = document.getElementById("tools-menu-toggle");
const toolsMenu = document.getElementById("tools-menu");
const featureSection = document.getElementById("feature-section");
const featureSectionTitle = document.getElementById("feature-section-title");
const featureControls = document.getElementById("feature-controls");
const practiceControls = document.getElementById("practice-controls");
const difficultySection = document.getElementById("difficulty-section");
const statisticsSection = document.getElementById("statistics-section");
const freeplayControls = document.getElementById("freeplay-controls");
const practiceDifficultySlider = document.getElementById("practice-difficulty-slider");
const practiceDifficultyValue = document.getElementById("practice-difficulty-value");
const freeplayGameScoreToggle = document.getElementById("freeplay-game-score-toggle");
const bestMovePulse = document.getElementById("best-move-pulse");
const bestMoveToggle = document.getElementById("best-move-toggle");
const moveScoresPulse = document.getElementById("move-scores-pulse");
const moveScoresToggle = document.getElementById("move-scores-toggle");
const gameScorePulse = document.getElementById("game-score-pulse");
const gameScoreToggle = document.getElementById("game-score-toggle");
const devPanel = document.getElementById("dev-panel");
const devToolbar = document.getElementById("dev-toolbar");
const devToolbarLeft = devToolbar?.querySelector<HTMLElement>(".dev-toolbar-left");
const devToolbarRight = devToolbar?.querySelector<HTMLElement>(".dev-toolbar-right");
const compactLandscapeDevControls = document.getElementById("compact-landscape-dev-controls");
const importStateControl = document.getElementById("import-state-control");
const exportStateControl = document.getElementById("export-state-control");
const devResizeControl = document.getElementById("dev-resize-control");
const devRefreshControl = document.getElementById("dev-refresh-control");
const devCloseControl = document.getElementById("dev-close-control");
const devOutputBox = document.getElementById("dev-output-box");
const settingsAudioToggle = document.getElementById("settings-audio-toggle");
const settingsDevModeToggle = document.getElementById("settings-dev-mode-toggle");
const settingsColorblindModeToggle = document.getElementById("settings-colorblind-mode-toggle");
const settingsThemeSelect = document.getElementById("settings-theme-select");
const settingsLanguageSelect = document.getElementById("settings-language-select") as HTMLSelectElement | null;
const statsDifficultySelect = document.getElementById("stats-difficulty-select") as HTMLSelectElement | null;
const statsTableBody = document.getElementById("stats-table-body");
const themeBackground = document.getElementById("theme-background");

if (
  !themeBackground ||
  !landingRoot ||
  !hero ||
  !titleControl ||
  !boardStage ||
  !boardArea ||
  !boardActions ||
  !boardFrame ||
  !boardShell ||
  !boardGrid ||
  !trainerGrid ||
  !discGrid ||
  !menuBar ||
  !scoreBar ||
  !scoreBarFill ||
  !turnIndicator ||
  !compactTurnIndicator ||
  !columnScoreRow ||
  !previewPiece ||
  !historyControls ||
  !statsControl ||
  !aboutControl ||
  !trainingModeControl ||
  !freeplayModeControl ||
  !aboutModal ||
  !aboutBackdrop ||
  !aboutDialog ||
  !aboutTitle ||
  !aboutClose ||
  !undoControl ||
  !redoControl ||
  !resetControl ||
  !toolsMenuToggle ||
  !toolsMenu ||
  !featureSection ||
  !featureSectionTitle ||
  !featureControls ||
  !practiceControls ||
  !difficultySection ||
  !statisticsSection ||
  !freeplayControls ||
  !practiceDifficultySlider ||
  !practiceDifficultyValue ||
  !freeplayGameScoreToggle ||
  !bestMovePulse ||
  !bestMoveToggle ||
  !moveScoresPulse ||
  !moveScoresToggle ||
  !gameScorePulse ||
  !gameScoreToggle ||
  !devPanel ||
  !devToolbar ||
  !devToolbarLeft ||
  !devToolbarRight ||
  !compactLandscapeDevControls ||
  !importStateControl ||
  !exportStateControl ||
  !devResizeControl ||
  !devRefreshControl ||
  !devCloseControl ||
  !devOutputBox ||
  !settingsAudioToggle ||
  !settingsDevModeToggle ||
  !settingsColorblindModeToggle ||
  !settingsThemeSelect ||
  !settingsLanguageSelect ||
  !statsDifficultySelect ||
  !statsTableBody
) {
  throw new Error("Missing required board elements.");
}

stripPwaCacheRefreshParamFromUrl();

applyStaticTranslations(document);

const moggedBackground = createMoggedBackground(themeBackground as HTMLCanvasElement);
const audioController = createAudioController();

const board: BoardState = createBoard();
const trainerSlots: HTMLDivElement[] = [];
const discSlots: HTMLDivElement[] = [];
const columnScoreSlots: HTMLSpanElement[] = [];
const practiceColorButtons = Array.from(
  practiceControls.querySelectorAll<HTMLButtonElement>("[data-practice-color]"),
);
const aboutTabButtons = Array.from(aboutModal.querySelectorAll<HTMLButtonElement>("[data-about-tab]"));
const aboutPanels = Array.from(aboutModal.querySelectorAll<HTMLElement>("[data-about-panel]"));
const modalViews = Array.from(aboutModal.querySelectorAll<HTMLElement>("[data-modal-view]"));
const modeButtons: Array<[GameMode, HTMLButtonElement]> = [
  ["training", trainingModeControl as HTMLButtonElement],
  ["freeplay", freeplayModeControl as HTMLButtonElement],
];
const discElements = Array.from({ length: HEIGHT }, () =>
  Array.from({ length: WIDTH }, () => null as HTMLDivElement | null),
);

const featurePulseButtons: Record<FeatureKey, HTMLButtonElement> = {
  bestMove: bestMovePulse as HTMLButtonElement,
  moveScores: moveScoresPulse as HTMLButtonElement,
  gameScore: gameScorePulse as HTMLButtonElement,
};

const featureToggleInputs: Record<FeatureKey, HTMLInputElement> = {
  bestMove: bestMoveToggle as HTMLInputElement,
  moveScores: moveScoresToggle as HTMLInputElement,
  gameScore: gameScoreToggle as HTMLInputElement,
};

const buildVersion = import.meta.env.VITE_BUILD_VERSION?.trim() || "dev";

document.documentElement.lang = APP_LOCALE;

let activeColumn: number | null = null;
let activePointerId: number | null = null;
let currentPlayer: PlayerValue = RED;
let isAnimating = false;
let isWinLocked = false;
let winningPlayer: PlayerValue | null = null;
let dropToken = 0;
let moveSequence = "";
let optimizerWorker: Worker | null = null;
let boardFrameLayoutRaf = 0;
let boardFrameLayoutTimeout = 0;
let shakeResetTimeout = 0;
let isAboutModalOpen = false;
let activeAboutTab: AboutTab = "about";
let activeModalView: ModalView = "about";
let latestOptimizerOutput = "";
let latestOptimizerPayload: OptimizerSuccessPayload | null = null;
let currentMode: GameMode = "training";
let isToolsMenuExpanded = false;
let isDevModeEnabled = false;
let isAudioEnabled = true;
let isColorblindModeEnabled = false;
let practiceColor: PracticeColor = "red";
let practiceDifficulty = 10;
let lowestAiDifficultyThisGame: number | null = null;
let statsDifficulty = 10;
let currentTheme: ThemeName = "light";
let practiceRoundIndex = 0;
let aiMoveTimeout = 0;
let aiScheduledSequence: string | null = null;
let aiPlannedColumn: number | null = null;
let aiPlannedDebug: PracticeAiDebug | null = null;
let lastPracticeAiDebug: PracticeAiDebug | null = null;
let historyIndex = 0;
let freeplayUndoAvailable = false;
let currentPracticeRecordedStatId: string | null = null;
let isImportedGame = false;
let didUseAssistThisGame = false;
let didUseUndoThisGame = false;
let hasUndoneLossSinceReset = false;
let gameTimerInterval = 0;
let gameTimerStartedAt: number | null = null;
let currentGameStartedAt: number | null = null;
let pendingBoardResetShakeTimeout = 0;
let lastBoardResetTapAt = 0;
let lastBoardResetTapPointerType: string | null = null;
let pendingPracticeGameDurationMs: number | null = null;
let portraitDevPanelHeightPx: number | null = null;
let activeDevResizePointerId: number | null = null;
let activeDevResizeStartY = 0;
let activeDevResizeStartHeightPx = 0;
const previousRedScores: Array<number | null> = [];
const previousYellowScores: Array<number | null> = [];
const moveHistory: MoveRecord[] = [];
let practiceStats: PracticeStatRecord[] = readStoredPracticeStats();
let modalReturnFocusTarget: HTMLElement | null = null;
const featurePinned: Record<FeatureKey, boolean> = {
  bestMove: false,
  moveScores: false,
  gameScore: false,
};
const featureHeld: Record<FeatureKey, boolean> = {
  bestMove: false,
  moveScores: false,
  gameScore: false,
};

type AboutTab = "about" | "howto" | "credits";
type ModalView = "about" | "stats";

type Connect4DebugState = {
  getCompletedGameResults: () => PracticeGameResultRecord[];
  getSequence: () => string;
  getOptimizerOutput: () => string;
  getPreviousRedScores: () => Array<number | null>;
  getPreviousYellowScores: () => Array<number | null>;
};

type MoveRecord = {
  aiDebug: PracticeAiDebug | null;
  column: number;
  player: PlayerValue;
  previousScore: number | null;
};

type RebuildHistoryOptions = {
  suppressCompletionEffects?: boolean;
  suppressStatsRecording?: boolean;
};

type DevOutputImport = {
  didUseAssist: boolean | null;
  didUseUndo: boolean | null;
  mode: GameMode | null;
  practiceColor: PracticeColor | null;
  practiceDifficulty: number | null;
  state: string;
  timerMs: number | null;
};

declare global {
  interface Window {
    connect4State?: Connect4DebugState;
  }
}

function persistUiState(): void {
  const state: PersistedUiState = {
    audioEnabled: isAudioEnabled,
    colorblindMode: isColorblindModeEnabled,
    devMode: isDevModeEnabled,
    toolsMenuExpanded: isToolsMenuExpanded,
    selectedMode: currentMode,
    practiceColor,
    practiceDifficulty,
    locale: APP_LOCALE,
    theme: currentTheme,
    pinned: {
      bestMove: featurePinned.bestMove,
      moveScores: featurePinned.moveScores,
      gameScore: featurePinned.gameScore,
    },
  };
  writePersistedUiState(state);
}

function stateSequenceFromLocation(): string | null {
  const rawState = new URLSearchParams(window.location.search).get("state");
  if (!rawState) {
    return null;
  }

  const sequence = rawState.trim();
  return sequence.length > 0 ? sequence : null;
}

function moveHistoryFromSequence(sequence: string): MoveRecord[] | null {
  if (sequence === "") {
    return [];
  }

  if (!/^[1-7]+$/.test(sequence)) {
    return null;
  }

  const importedBoard = createBoard();
  const importedHistory: MoveRecord[] = [];
  let player: PlayerValue = RED;

  for (let index = 0; index < sequence.length; index += 1) {
    if (detectWinningMask(importedBoard).hasWinningRun) {
      return null;
    }

    const column = Number(sequence[index]) - 1;
    const row = lowestOpenRow(importedBoard, column);
    if (row === null) {
      return null;
    }

    importedBoard[row][column] = player;
    importedHistory.push({
      aiDebug: null,
      column,
      player,
      previousScore: null,
    });
    player = nextPlayer(player);
  }

  return importedHistory;
}

function isValidImportSequence(sequence: string, options: { allowEmpty?: boolean } = {}): boolean {
  if (sequence === "") {
    return options.allowEmpty === true;
  }

  if (!/^[1-7]+$/.test(sequence)) {
    return false;
  }

  const counts = Array.from({ length: WIDTH }, () => 0);
  for (const character of sequence) {
    const column = Number(character) - 1;
    counts[column] += 1;
    if (counts[column] > HEIGHT) {
      return false;
    }
  }

  return true;
}

function isGameModeValue(value: string): value is GameMode {
  return value === "training" || value === "freeplay";
}

function isPracticeColorValue(value: string): value is PracticeColor {
  return value === "red" || value === "yellow" || value === "alternate";
}

function parseDevOutputFields(rawText: string): Map<string, string> | null {
  const fields = new Map<string, string>();

  for (const line of rawText.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine === "--") {
      continue;
    }

    const match = /^([a-z][a-z_]*):\s*(.*)$/i.exec(trimmedLine);
    if (!match) {
      continue;
    }

    fields.set(match[1].toLowerCase(), match[2].trim());
  }

  return fields.has("state") ? fields : null;
}

function parsePlayerColorFallback(value: string | undefined): PracticeColor | null {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.includes("alternate")) {
    return "alternate";
  }

  if (normalizedValue.startsWith("red")) {
    return "red";
  }

  if (normalizedValue.startsWith("yellow")) {
    return "yellow";
  }

  return null;
}

function parseOptionalYesNo(value: string | undefined): boolean | null {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "yes") {
    return true;
  }

  if (normalizedValue === "no") {
    return false;
  }

  throw new Error(`Invalid yes/no value: ${value}`);
}

function parseOptionalDifficulty(value: string | undefined): number | null {
  const normalizedValue = value?.trim() ?? "";
  if (!normalizedValue) {
    return null;
  }

  const difficulty = Number(normalizedValue);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 10) {
    throw new Error(`Invalid practice difficulty: ${value}`);
  }

  return difficulty;
}

function parseOptionalTimerMs(value: string | undefined): number | null {
  const normalizedValue = value?.trim() ?? "";
  if (!normalizedValue || normalizedValue === "-") {
    return null;
  }

  const parts = normalizedValue.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Invalid timer value: ${value}`);
  }

  const values = parts.map((part) => Number(part));
  const seconds = values[values.length - 1];
  const minutes = values[values.length - 2];
  const hours = values.length === 3 ? values[0] : 0;
  if (minutes >= 60 || seconds >= 60) {
    throw new Error(`Invalid timer value: ${value}`);
  }

  return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
}

function parseDevOutputImport(rawText: string): DevOutputImport | null {
  const fields = parseDevOutputFields(rawText);
  if (!fields) {
    return null;
  }

  const state = fields.get("state") ?? "";
  if (!isValidImportSequence(state, { allowEmpty: true }) || moveHistoryFromSequence(state) === null) {
    throw new Error("Invalid imported Connect 4 state.");
  }

  const rawMode = fields.get("mode")?.trim().toLowerCase() ?? "";
  if (rawMode && !isGameModeValue(rawMode)) {
    throw new Error(`Invalid mode: ${rawMode}`);
  }

  const rawPracticeColor = fields.get("practice_color")?.trim().toLowerCase() ?? "";
  const practiceColorFromField = rawPracticeColor
    ? isPracticeColorValue(rawPracticeColor)
      ? rawPracticeColor
      : null
    : null;
  if (rawPracticeColor && practiceColorFromField === null) {
    throw new Error(`Invalid practice color: ${rawPracticeColor}`);
  }

  return {
    didUseAssist: parseOptionalYesNo(fields.get("assists_enabled")),
    didUseUndo: parseOptionalYesNo(fields.get("undo_used")),
    mode: rawMode ? rawMode : null,
    practiceColor: practiceColorFromField ?? parsePlayerColorFallback(fields.get("player_color")),
    practiceDifficulty: parseOptionalDifficulty(fields.get("practice_difficulty") || fields.get("difficulty_floor")),
    state,
    timerMs: parseOptionalTimerMs(fields.get("timer")),
  };
}

function stateImportCandidateFromText(rawText: string): { allowEmpty: boolean; sequence: string } | null {
  const sequence = rawText.trim();
  if (isValidImportSequence(sequence)) {
    return {
      allowEmpty: false,
      sequence,
    };
  }

  const fields = parseDevOutputFields(rawText);
  if (!fields) {
    return null;
  }

  return {
    allowEmpty: true,
    sequence: fields.get("state") ?? "",
  };
}

function syncMoveSequence(): void {
  boardShell.dataset.sequence = moveSequence;
  syncFeatureUI();
}

function setAboutModalOpen(open: boolean): void {
  isAboutModalOpen = open;
  aboutModal.classList.toggle("hidden", !open);
  aboutModal.setAttribute("aria-hidden", String(!open));

  if (open) {
    syncModalView();
    syncAboutDialogPosition();
  }
}

function syncAboutDialogPosition(): void {
  const menuBarRect = menuBar.getBoundingClientRect();
  const landingStyle = window.getComputedStyle(landingRoot);
  const edgeBuffer = Number.parseFloat(landingStyle.paddingTop || "0") || 0;
  const top = Math.max(edgeBuffer, menuBarRect.top);
  const maxHeight = Math.max(240, window.innerHeight - top - edgeBuffer);

  aboutDialog.style.setProperty("--about-dialog-top", `${top}px`);
  aboutDialog.style.setProperty("--about-dialog-max-height", `${maxHeight}px`);
}

function syncAboutTabs(): void {
  for (const button of aboutTabButtons) {
    const tab = button.dataset.aboutTab as AboutTab | undefined;
    const isSelected = tab === activeAboutTab;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
  }

  for (const panel of aboutPanels) {
    const tab = panel.dataset.aboutPanel as AboutTab | undefined;
    panel.classList.toggle("hidden", tab !== activeAboutTab);
  }
}

function syncModalView(): void {
  for (const view of modalViews) {
    const viewName = view.dataset.modalView as ModalView | undefined;
    view.classList.toggle("hidden", viewName !== activeModalView);
  }

  if (activeModalView === "stats") {
    aboutTitle.textContent = APP_STRINGS.stats.title;
    return;
  }

  aboutTitle.textContent = APP_STRINGS.about.title;
}

function openModalView(view: ModalView, trigger: HTMLElement, options?: { aboutTab?: AboutTab }): void {
  activeModalView = view;
  modalReturnFocusTarget = trigger;
  if (view === "about" && options?.aboutTab) {
    setAboutTab(options.aboutTab);
  } else if (view === "stats") {
    setStatsDifficulty(practiceDifficulty);
  } else {
    syncModalView();
  }
  setAboutModalOpen(true);
  aboutClose.focus();
}

function closeActiveModal(): void {
  setAboutModalOpen(false);
  const focusTarget = modalReturnFocusTarget;
  modalReturnFocusTarget = null;
  (focusTarget ?? toolsMenuToggle).focus();
}

function formatStatsNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(/\.0$/, "");
}

function formatWinRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function currentGameTimerMs(): number {
  if (gameTimerStartedAt === null) {
    return pendingPracticeGameDurationMs ?? 0;
  }

  return Math.max(0, Date.now() - gameTimerStartedAt);
}

function syncGameTimerInterval(): void {
  if (gameTimerStartedAt !== null) {
    if (gameTimerInterval !== 0) {
      return;
    }

    gameTimerInterval = window.setInterval(() => {
      if (effectiveDevModeVisible()) {
        renderDevOutput();
      }
    }, 1000);
    return;
  }

  if (gameTimerInterval !== 0) {
    window.clearInterval(gameTimerInterval);
    gameTimerInterval = 0;
  }
}

function hasTrainingAssistEnabled(): boolean {
  if (!isTrainingMode()) {
    return false;
  }

  for (const feature of Object.keys(featurePinned) as FeatureKey[]) {
    if (featurePinned[feature] || featureHeld[feature]) {
      return true;
    }
  }

  return false;
}

function markAssistUsedIfEnabled(): void {
  if (hasTrainingAssistEnabled()) {
    didUseAssistThisGame = true;
  }
}

function startGameTimerIfNeeded(player: PlayerValue): void {
  if (gameTimerStartedAt !== null) {
    return;
  }

  if (currentMode === "training" && player !== trainingHumanPlayer()) {
    return;
  }

  pendingPracticeGameDurationMs = null;
  gameTimerStartedAt = Date.now();
  syncGameTimerInterval();
  renderDevOutput();
}

function completeGameTimer(): void {
  pendingPracticeGameDurationMs = currentGameTimerMs();
  gameTimerStartedAt = null;
  syncGameTimerInterval();
  renderDevOutput();
}

function resetGameTimer(): void {
  pendingPracticeGameDurationMs = null;
  gameTimerStartedAt = null;
  currentGameStartedAt = null;
  syncGameTimerInterval();
  renderDevOutput();
}

function clearPendingBoardResetShake(): void {
  if (pendingBoardResetShakeTimeout !== 0) {
    window.clearTimeout(pendingBoardResetShakeTimeout);
    pendingBoardResetShakeTimeout = 0;
  }
}

function clearPendingBoardResetTap(): void {
  clearPendingBoardResetShake();
  lastBoardResetTapAt = 0;
  lastBoardResetTapPointerType = null;
}

function isGameComplete(): boolean {
  return isWinLocked || !hasPlayableMove();
}

function scheduleCompletedGameShake(): void {
  clearPendingBoardResetShake();
  pendingBoardResetShakeTimeout = window.setTimeout(() => {
    pendingBoardResetShakeTimeout = 0;
    lastBoardResetTapAt = 0;
    lastBoardResetTapPointerType = null;
    if (!isGameComplete()) {
      return;
    }

    triggerWinLockShake();
  }, BOARD_COMPLETE_TAP_SHAKE_DELAY_MS);
}

function maybeHandleBoardDoubleTapReset(event: PointerEvent): boolean {
  if (!isGameComplete()) {
    clearPendingBoardResetTap();
    return false;
  }

  const isDoubleTap =
    lastBoardResetTapAt !== 0 &&
    event.timeStamp - lastBoardResetTapAt <= BOARD_RESET_DOUBLE_TAP_WINDOW_MS &&
    lastBoardResetTapPointerType === event.pointerType;

  lastBoardResetTapAt = event.timeStamp;
  lastBoardResetTapPointerType = event.pointerType;

  if (!isDoubleTap || !canReset()) {
    scheduleCompletedGameShake();
    return true;
  }

  clearPendingBoardResetTap();
  resetBoard({ recordTrainingReset: true });
  return true;
}

function statsMetricValue(metric: StatsMetricKey, summary: PracticeStatsSummary): string {
  switch (metric) {
    case "wins":
      return String(summary.wins);
    case "losses":
      return String(summary.losses);
    case "ties":
      return String(summary.ties);
    case "winRate":
      return formatWinRate(summary.winRate);
    case "averageWinLength":
      return formatStatsNumber(summary.averageWinLength);
    case "averageLossLength":
      return formatStatsNumber(summary.averageLossLength);
    case "biggestWin":
      return formatStatsNumber(summary.biggestWin);
    case "biggestLoss":
      return formatStatsNumber(summary.biggestLoss);
    case "winsWithoutUndo":
      return String(summary.winsWithoutUndo);
    case "winsWithoutAssist":
      return String(summary.winsWithoutAssist);
    case "lossesUndone":
      return String(summary.lossesUndone);
    case "lostMultipleTimes":
      return String(summary.lostMultipleTimes);
    case "resetCount":
      return String(summary.resetCount);
    case "resetsWhileLosing":
      return String(summary.resetsWhileLosing);
    case "averageGameTime":
      return formatDuration(summary.averageGameTimeMs);
    case "fastestWin":
      return formatDuration(summary.fastestWinMs);
    default:
      return "-";
  }
}

function renderStatsTable(): void {
  const stats = buildPracticeDifficultyStats(practiceStats, statsDifficulty);
  statsTableBody.replaceChildren();

  for (const metric of STATS_METRIC_ORDER) {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <th scope="row">${APP_STRINGS.stats.metrics[metric]}</th>
      <td>${statsMetricValue(metric, stats.today)}</td>
      <td>${statsMetricValue(metric, stats.lifetime)}</td>
    `;
    statsTableBody.append(tableRow);
  }
}

function syncStatsDifficultyControl(): void {
  statsDifficultySelect.value = String(statsDifficulty);
}

function syncThemeControls(): void {
  settingsThemeSelect.value = currentTheme;
  settingsAudioToggle.checked = isAudioEnabled;
  settingsColorblindModeToggle.checked = isColorblindModeEnabled;
}

function syncLanguageControl(): void {
  for (const [index, optionConfig] of APP_LANGUAGE_OPTIONS.entries()) {
    const option = settingsLanguageSelect.options[index] ?? document.createElement("option");
    option.value = optionConfig.locale;
    option.textContent = optionConfig.label;
    if (!option.parentElement) {
      settingsLanguageSelect.append(option);
    }
  }

  settingsLanguageSelect.value = APP_LOCALE;
}

function labelTextForTooltip(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  const labelText = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
  return labelText;
}

function setTooltip(element: HTMLElement | null | undefined, fallback = ""): void {
  if (!element) {
    return;
  }

  const tooltipText = labelTextForTooltip(element) || fallback;
  if (tooltipText) {
    element.title = tooltipText;
  }
}

function syncIconTooltips(): void {
  const tooltipElements = [
    resetControl,
    undoControl,
    redoControl,
    toolsMenuToggle,
    settingsLanguageSelect.closest<HTMLElement>(".settings-language-row")?.querySelector<HTMLElement>(".settings-language-label"),
    aboutClose,
    ...practiceColorButtons,
    importStateControl,
    exportStateControl,
    devResizeControl,
    devRefreshControl,
    devCloseControl,
  ];

  for (const element of tooltipElements) {
    setTooltip(element);
  }

  setTooltip(settingsAudioToggle.closest<HTMLElement>(".sound-toggle"), APP_STRINGS.controls.sound);
}

function refreshLocalizedUi(): void {
  applyStaticTranslations(document, APP_STRINGS);
  syncLanguageControl();
  syncThemeControls();
  syncModalView();
  renderStatsTable();
  syncModeControls();
  renderTurnIndicator();
  renderDevOutput();
  syncIconTooltips();
}

function syncDiscPatternMode(): void {
  const shouldShowPatterns = currentTheme === "midnight" || isColorblindModeEnabled;
  document.documentElement.dataset.discPatterns = shouldShowPatterns ? "true" : "false";
}

function setAboutTab(tab: AboutTab): void {
  activeAboutTab = tab;
  syncAboutTabs();
  syncModalView();
}

function setStatsDifficulty(nextDifficulty: number): void {
  statsDifficulty = Math.max(1, Math.min(10, Math.round(nextDifficulty)));
  syncStatsDifficultyControl();
  renderStatsTable();
}

function setDevModeEnabled(enabled: boolean): void {
  isDevModeEnabled = enabled;
  settingsDevModeToggle.checked = enabled;
  persistUiState();
  syncFeatureUI();
}

function pauseAllAudio(): void {
  audioController.pauseAll();
}

function setColorblindModeEnabled(enabled: boolean): void {
  isColorblindModeEnabled = enabled;
  settingsColorblindModeToggle.checked = enabled;
  syncDiscPatternMode();
  persistUiState();
}

function setAudioEnabled(enabled: boolean): void {
  isAudioEnabled = enabled;
  settingsAudioToggle.checked = enabled;
  persistUiState();

  if (!enabled) {
    pauseAllAudio();
    return;
  }

  syncThemeAudio(true);
}

function syncThemeAudio(allowPlayback: boolean): void {
  audioController.syncThemeAudio(currentTheme, {
    allowPlayback,
    audioEnabled: isAudioEnabled,
  });
}

function playSoundEffect(effect: SoundEffectKey): void {
  audioController.playSoundEffect(effect, isAudioEnabled);
}

function setTheme(theme: ThemeName): void {
  currentTheme = theme;
  ensureThemeFont(theme);
  applyTheme(theme);
  moggedBackground.setEnabled(theme === "mogged");
  syncDiscPatternMode();
  syncThemeControls();
  persistUiState();
  syncThemeAudio(true);
}

function runCriticalFrame(callback: () => void): void {
  let hasRun = false;
  let frameId = 0;
  let timeoutId = 0;

  const run = (): void => {
    if (hasRun) {
      return;
    }

    hasRun = true;
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
    }
    if (timeoutId !== 0) {
      window.clearTimeout(timeoutId);
    }
    callback();
  };

  frameId = window.requestAnimationFrame(run);
  timeoutId = window.setTimeout(run, 20);
}

function scheduleBoardFrameLayout(): void {
  if (boardFrameLayoutRaf !== 0 || boardFrameLayoutTimeout !== 0) {
    return;
  }

  boardFrameLayoutRaf = window.requestAnimationFrame(() => {
    boardFrameLayoutRaf = 0;
    if (boardFrameLayoutTimeout !== 0) {
      window.clearTimeout(boardFrameLayoutTimeout);
      boardFrameLayoutTimeout = 0;
    }
    layoutBoardFrame();
  });
  boardFrameLayoutTimeout = window.setTimeout(() => {
    boardFrameLayoutTimeout = 0;
    if (boardFrameLayoutRaf !== 0) {
      window.cancelAnimationFrame(boardFrameLayoutRaf);
      boardFrameLayoutRaf = 0;
    }
    layoutBoardFrame();
  }, 20);
}

function layoutBoardFrame(): void {
  boardFrame.style.transform = "";
  boardActions.style.width = "";
  syncAboutDialogPosition();

  if (window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches) {
    const landingStyle = window.getComputedStyle(landingRoot);
    const edgeBuffer = Number.parseFloat(landingStyle.paddingLeft || "0") || 0;
    const layoutGap = Number.parseFloat(landingStyle.columnGap || landingStyle.gap || "0") || 0;
    boardActions.style.width = `${menuBar.getBoundingClientRect().width}px`;
    const leftBoundary = Math.max(
      hero.getBoundingClientRect().right,
      boardActions.getBoundingClientRect().right,
    ) + layoutGap;
    const clampedLeft = Math.min(
      Math.max(edgeBuffer, leftBoundary),
      window.innerWidth - edgeBuffer - 220,
    );

    toolsMenu.style.setProperty("--compact-menu-left", `${clampedLeft}px`);
    return;
  }

  const frameRect = boardFrame.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  const actionsRect = historyControls.getBoundingClientRect();
  const stageRect = boardStage.getBoundingClientRect();
  const landingStyle = window.getComputedStyle(landingRoot);
  const layoutGap = Number.parseFloat(landingStyle.rowGap || landingStyle.gap || "0") || 0;
  const minTop = Math.max(stageRect.top, heroRect.bottom + layoutGap);
  const maxTop = Math.min(stageRect.bottom - frameRect.height, actionsRect.top - layoutGap - frameRect.height);
  const desiredTop = window.innerHeight / 2 - frameRect.height / 2;
  const clampedTop =
    minTop <= maxTop ? Math.max(minTop, Math.min(desiredTop, maxTop)) : Math.min(minTop, maxTop);
  const offsetY = clampedTop - frameRect.top;

  boardFrame.style.transform = `translateY(${offsetY}px)`;
  boardActions.style.width = `${frameRect.width}px`;
  toolsMenu.style.setProperty(
    "--menu-panel-width",
    `${Math.max(frameRect.width, menuBar.getBoundingClientRect().width, boardActions.getBoundingClientRect().width)}px`,
  );
  toolsMenu.style.removeProperty("--compact-menu-left");
}

function isTrainingMode(): boolean {
  return currentMode === "training";
}

function updateDocumentTitle(): void {
  document.title = titleForMode(currentMode);
}

function syncModeUrl(mode: GameMode, strategy: "push" | "replace"): void {
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const targetPath = pathForMode(mode);

  if (currentPath === targetPath) {
    return;
  }

  const nextUrl = `${targetPath}${window.location.search}${window.location.hash}`;
  if (strategy === "push") {
    window.history.pushState({ mode }, "", nextUrl);
    return;
  }

  window.history.replaceState({ mode }, "", nextUrl);
}

function isHumanTurn(): boolean {
  return (
    !isTrainingMode() ||
    currentPlayer ===
      effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
        red: RED,
        yellow: YELLOW,
      })
  );
}

function updatePracticeControls(): void {
  const inTraining = isTrainingMode();
  practiceControls.classList.toggle("hidden", !isTrainingMode());
  freeplayControls.classList.toggle("hidden", currentMode !== "freeplay");
  featureControls.classList.toggle("hidden", !inTraining);
  featureSection.classList.toggle("hidden", !inTraining && currentMode !== "freeplay");
  featureSectionTitle.textContent = inTraining ? APP_STRINGS.features.trainingTools : APP_STRINGS.features.display;
  difficultySection.classList.toggle("hidden", !inTraining);
  statisticsSection.classList.toggle("hidden", !inTraining);

  for (const button of practiceColorButtons) {
    const color = button.dataset.practiceColor as PracticeColor | undefined;
    const isSelected = color === practiceColor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  practiceDifficultySlider.value = String(practiceDifficulty);
  practiceDifficultyValue.textContent = String(practiceDifficulty);
  freeplayGameScoreToggle.checked = featurePinned.gameScore;
  settingsAudioToggle.checked = isAudioEnabled;
  settingsDevModeToggle.checked = isDevModeEnabled;
  syncThemeControls();
  syncStatsDifficultyControl();
}

function isFeatureVisible(feature: FeatureKey): boolean {
  return featurePinned[feature] || featureHeld[feature];
}

function effectiveBestMoveVisible(): boolean {
  return isTrainingMode() && isFeatureVisible("bestMove");
}

function effectiveMoveScoresVisible(): boolean {
  return isTrainingMode() && isFeatureVisible("moveScores");
}

function effectiveGameScoreVisible(): boolean {
  return (isTrainingMode() || currentMode === "freeplay") && isFeatureVisible("gameScore");
}

function effectiveDevModeVisible(): boolean {
  return isDevModeEnabled;
}

function setFeaturePinned(feature: FeatureKey, pinned: boolean): void {
  featurePinned[feature] = pinned;
  if (pinned) {
    featureHeld[feature] = false;
  }

  markAssistUsedIfEnabled();
  featureToggleInputs[feature].checked = pinned;
  persistUiState();
  syncFeatureControls();
  syncFeatureUI();
}

function setFeatureHeld(feature: FeatureKey, held: boolean): void {
  if (featurePinned[feature]) {
    return;
  }

  featureHeld[feature] = held;
  markAssistUsedIfEnabled();
  syncFeatureControls();
  syncFeatureUI();
}

function syncFeatureControls(): void {
  for (const feature of Object.keys(featurePulseButtons) as FeatureKey[]) {
    const isPinned = featurePinned[feature];
    const isHeld = featureHeld[feature] && !isPinned;
    featurePulseButtons[feature].disabled = isPinned;
    featurePulseButtons[feature].classList.toggle("is-held", isHeld);
    featureToggleInputs[feature].checked = isPinned;
  }
}

function syncModeControls(): void {
  for (const [mode, button] of modeButtons) {
    const isSelected = mode === currentMode;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  updatePracticeControls();
}

function setToolsMenuExpanded(expanded: boolean): void {
  isToolsMenuExpanded = expanded;

  toolsMenuToggle.setAttribute("aria-expanded", String(isToolsMenuExpanded));
  toolsMenu.classList.toggle("hidden", !isToolsMenuExpanded);
  persistUiState();
}

function setCurrentMode(
  mode: GameMode,
  options: { history?: "push" | "replace" | "none"; resetBoard?: boolean } = {},
): void {
  const historyStrategy = options.history ?? "push";
  const shouldResetBoard = options.resetBoard ?? true;
  const modeChanged = mode !== currentMode;

  currentMode = mode;
  updateDocumentTitle();
  syncModeControls();
  persistUiState();

  if (historyStrategy !== "none") {
    syncModeUrl(mode, historyStrategy);
  }

  if (modeChanged && shouldResetBoard) {
    resetBoard({ advancePracticeRound: false });
  }
}

function setPracticeColor(nextColor: PracticeColor): void {
  if (nextColor === practiceColor) {
    return;
  }

  practiceColor = nextColor;
  updatePracticeControls();
  persistUiState();
  resetBoard({ advancePracticeRound: false });
}

function setPracticeDifficulty(nextDifficulty: number): void {
  practiceDifficulty = Math.max(1, Math.min(10, Math.round(nextDifficulty)));
  updatePracticeControls();
  persistUiState();
  maybeScheduleAiTurn();
}

function applyBoardFrameLayout(): void {
  boardFrame.style.setProperty("--board-frame-rows", String(FIXED_BOARD_FRAME_ROWS));
  boardFrame.style.setProperty(
    "--board-shell-bottom-ratio",
    String(FIXED_BOARD_SHELL_BOTTOM_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--score-bar-bottom-ratio",
    String(FIXED_SCORE_BAR_BOTTOM_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--score-bar-height-ratio",
    String(FIXED_SCORE_BAR_HEIGHT_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--turn-indicator-top-ratio",
    String(FIXED_TURN_INDICATOR_TOP_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--turn-indicator-height-ratio",
    String(FIXED_TURN_INDICATOR_HEIGHT_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--column-score-top-ratio",
    String(FIXED_COLUMN_SCORE_TOP_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
  boardFrame.style.setProperty(
    "--column-score-height-ratio",
    String(FIXED_COLUMN_SCORE_HEIGHT_ROWS / FIXED_BOARD_FRAME_ROWS),
  );
}

function syncCompactLandscapeDevControls(): void {
  const shouldDockIntoBoardActions = effectiveDevModeVisible() && window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches;

  if (shouldDockIntoBoardActions) {
    if (devToolbarLeft.parentElement !== compactLandscapeDevControls) {
      compactLandscapeDevControls.append(devToolbarLeft);
    }

    if (devToolbarRight.parentElement !== compactLandscapeDevControls) {
      compactLandscapeDevControls.append(devToolbarRight);
    }

    compactLandscapeDevControls.classList.remove("hidden");
    return;
  }

  if (devToolbarLeft.parentElement !== devToolbar) {
    devToolbar.insertBefore(devToolbarLeft, devResizeControl);
  }

  if (devToolbarRight.parentElement !== devToolbar) {
    devToolbar.append(devToolbarRight);
  }

  compactLandscapeDevControls.classList.add("hidden");
}

function isPortraitDevResizeEnabled(): boolean {
  return window.matchMedia(PORTRAIT_DEV_RESIZE_MEDIA_QUERY).matches;
}

function clearPortraitDevPanelHeight(): void {
  landingRoot.style.removeProperty("--dev-panel-portrait-height");
}

function portraitDevPanelMinHeight(): number {
  const toolbarHeight = devToolbar.getBoundingClientRect().height || 0;
  return Math.max(108, Math.ceil(toolbarHeight + MIN_DEV_PANEL_TEXTBOX_HEIGHT_PX));
}

function unsqueezedBoardFrameHeight(): number {
  return boardArea.getBoundingClientRect().width * FIXED_BOARD_FRAME_ROWS / WIDTH;
}

function portraitDevPanelMaxHeight(): number {
  const landingRect = landingRoot.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  const actionsRect = boardActions.getBoundingClientRect();
  const landingStyle = window.getComputedStyle(landingRoot);
  const layoutGap = Number.parseFloat(landingStyle.rowGap || landingStyle.gap || "0") || 0;
  const minHeight = portraitDevPanelMinHeight();
  const minBoardHeight = Math.max(120, unsqueezedBoardFrameHeight() * MIN_DEV_PANEL_BOARD_SCALE);
  const minBoardStageHeight = actionsRect.height + layoutGap + minBoardHeight;
  const maxHeight = Math.floor(landingRect.height - heroRect.height - 2 * layoutGap - minBoardStageHeight);
  return Math.max(minHeight, maxHeight);
}

function defaultPortraitDevPanelHeight(): number {
  return Math.round(window.innerHeight * DEFAULT_DEV_PANEL_PORTRAIT_HEIGHT_RATIO);
}

function clampPortraitDevPanelHeight(height: number): number {
  const minHeight = portraitDevPanelMinHeight();
  const maxHeight = portraitDevPanelMaxHeight();
  return Math.max(minHeight, Math.min(maxHeight, Math.round(height)));
}

function stopPortraitDevPanelResize(): void {
  if (activeDevResizePointerId !== null && devResizeControl.hasPointerCapture(activeDevResizePointerId)) {
    devResizeControl.releasePointerCapture(activeDevResizePointerId);
  }

  activeDevResizePointerId = null;
  devResizeControl.classList.remove("is-dragging");
}

function syncPortraitDevPanelHeight(): void {
  if (!effectiveDevModeVisible() || !isPortraitDevResizeEnabled()) {
    stopPortraitDevPanelResize();
    clearPortraitDevPanelHeight();
    return;
  }

  const measuredHeight = devPanel.getBoundingClientRect().height;
  if (portraitDevPanelHeightPx === null) {
    portraitDevPanelHeightPx = measuredHeight > 0 ? measuredHeight : defaultPortraitDevPanelHeight();
  }

  portraitDevPanelHeightPx = clampPortraitDevPanelHeight(portraitDevPanelHeightPx);
  landingRoot.style.setProperty("--dev-panel-portrait-height", `${portraitDevPanelHeightPx}px`);
}

function updatePortraitDevPanelHeight(height: number): void {
  portraitDevPanelHeightPx = clampPortraitDevPanelHeight(height);
  landingRoot.style.setProperty("--dev-panel-portrait-height", `${portraitDevPanelHeightPx}px`);
  scheduleBoardFrameLayout();
}

function currentDevOutputText(): string {
  return buildDevOutput({
    assistsEnabled: didUseAssistThisGame,
    difficultyFloor: isTrainingMode() ? String(trainingStatDifficulty()) : "",
    lastMove: historyIndex > 0 ? `${playerClass(moveHistory[historyIndex - 1].player)} ${moveHistory[historyIndex - 1].column + 1}` : "",
    mode: currentMode,
    optimizerOutput: latestOptimizerOutput,
    playerColor: currentHumanPlayerColorLabel(),
    practiceColor,
    practiceAiDebug: isTrainingMode() ? lastPracticeAiDebug : null,
    practiceDifficulty: isTrainingMode() ? practiceDifficulty : null,
    previousRedScores,
    previousYellowScores,
    remaining: currentSolvedLineRemainingText(),
    scoreShare: currentScoreShareLabel(),
    state: moveSequence,
    timer: formatDuration(currentGameTimerMs()),
    undoUsed: didUseUndoThisGame,
    version: buildVersion,
    winDiscs: currentWinningDiscCount() === null ? "" : String(currentWinningDiscCount()),
    winner: winningPlayer !== null ? playerClass(winningPlayer) : null,
  });
}

function renderDevOutput(): void {
  const isVisible = effectiveDevModeVisible();
  landingRoot.classList.toggle("has-dev-panel", isVisible);
  devPanel.classList.toggle("hidden", !isVisible);
  syncCompactLandscapeDevControls();
  if (!isVisible) {
    syncPortraitDevPanelHeight();
    devOutputBox.value = "";
    return;
  }

  syncPortraitDevPanelHeight();

  devOutputBox.value = currentDevOutputText();
}

function hasPlayableMove(): boolean {
  for (let column = 0; column < WIDTH; column += 1) {
    if (lowestOpenRow(board, column) !== null) {
      return true;
    }
  }

  return false;
}

function isAiCalculating(): boolean {
  if (!isTrainingMode() || isWinLocked || isHumanTurn() || aiPlannedColumn !== null) {
    return false;
  }

  if (moveSequence === "") {
    return false;
  }

  return !latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence;
}

function renderTurnIndicator(): void {
  turnIndicator.classList.remove("is-red", "is-yellow");
  compactTurnIndicator.classList.remove("is-red", "is-yellow");

  const setTurnIndicator = (text: string, color: "red" | "yellow" | null = null): void => {
    turnIndicator.textContent = text;
    compactTurnIndicator.textContent = text;

    if (color === "red") {
      turnIndicator.classList.add("is-red");
      compactTurnIndicator.classList.add("is-red");
    } else if (color === "yellow") {
      turnIndicator.classList.add("is-yellow");
      compactTurnIndicator.classList.add("is-yellow");
    }
  };

  if (isWinLocked) {
    if (winningPlayer === RED) {
      setTurnIndicator(APP_STRINGS.status.redWins, "red");
      return;
    }

    if (winningPlayer === YELLOW) {
      setTurnIndicator(APP_STRINGS.status.yellowWins, "yellow");
      return;
    }

    setTurnIndicator("");
    return;
  }

  if (!hasPlayableMove()) {
    setTurnIndicator(APP_STRINGS.status.tie);
    return;
  }

  if (isTrainingMode()) {
    if (isHumanTurn()) {
      setTurnIndicator(APP_STRINGS.status.yourMove);
      return;
    }

    if (isAiCalculating()) {
      setTurnIndicator(APP_STRINGS.status.thinking);
      return;
    }

    if (aiPlannedColumn !== null) {
      setTurnIndicator(formatTemplate(APP_STRINGS.status.playingColumn, { column: aiPlannedColumn + 1 }));
      return;
    }

    setTurnIndicator("");
    return;
  }

  if (currentPlayer === RED) {
    setTurnIndicator(APP_STRINGS.status.redTurn, "red");
    return;
  }

  setTurnIndicator(APP_STRINGS.status.yellowTurn, "yellow");
}

function syncFeatureUI(): void {
  applyBoardFrameLayout();
  updateScoreBar();
  renderTurnIndicator();
  renderColumnScores();
  renderCurrentTrainingHints();
  renderDevOutput();
  syncHistoryControls();
  scheduleBoardFrameLayout();
}

function trainingStatDifficulty(): number {
  return lowestAiDifficultyThisGame ?? practiceDifficulty;
}

function recordPracticeEvent(kind: PracticeEventKind, difficulty = trainingStatDifficulty()): void {
  if (!isTrainingMode() || isImportedGame) {
    return;
  }

  practiceStats = appendPracticeStat({
    difficulty,
    id: createPracticeStatId(),
    kind,
    occurredAt: Date.now(),
  });
  renderStatsTable();
}

function removeCurrentPracticeRecordedStat(): PracticeGameStat | null {
  if (currentPracticeRecordedStatId === null) {
    return null;
  }

  const removedStatId = currentPracticeRecordedStatId;
  const { nextStats, removedStat } = removePracticeStatById(currentPracticeRecordedStatId);
  removePracticeGameResultByStatId(removedStatId);
  practiceStats = nextStats;
  currentPracticeRecordedStatId = null;
  renderStatsTable();
  return removedStat?.kind === "game" ? removedStat : null;
}

function boardCellLabel(cell: number): "empty" | "red" | "yellow" {
  if (cell === RED) {
    return "red";
  }

  if (cell === YELLOW) {
    return "yellow";
  }

  return "empty";
}

function clonePracticeAiDebug(debug: PracticeAiDebug | null): PracticeGameResultMove["aiDebug"] {
  if (debug === null) {
    return null;
  }

  return {
    patternAdjustments: [...debug.patternAdjustments],
    rawScores: [...debug.rawScores],
    rng: debug.rng,
    selectionMode: debug.selectionMode,
    tacticalFilter: debug.tacticalFilter,
    temperature: debug.temperature,
  };
}

function gameResultMoves(): PracticeGameResultMove[] {
  return moveHistory.slice(0, historyIndex).map((record, index) => ({
    aiDebug: clonePracticeAiDebug(record.aiDebug),
    column: record.column + 1,
    moveNumber: index + 1,
    player: playerClass(record.player),
    previousScore: record.previousScore,
  }));
}

function completedPracticeGameResultBlock(
  stat: PracticeGameStat,
  humanPlayer: PlayerValue,
  startedAt: number,
): PracticeGameResultBlock {
  return {
    appVersion: buildVersion,
    completedAt: stat.completedAt,
    completedAtIso: new Date(stat.completedAt).toISOString(),
    difficulty: stat.difficulty,
    finalBoard: board.map((row) => row.map(boardCellLabel)),
    finalRemaining: currentSolvedLineRemainingText(),
    finalScoreShare: currentScoreShareLabel(),
    gameDurationMs: stat.gameDurationMs,
    humanPlayer: playerClass(humanPlayer),
    lowestAiDifficulty: lowestAiDifficultyThisGame,
    mode: "training",
    moveCount: stat.moveCount,
    moves: gameResultMoves(),
    practiceColor,
    previousRedScores: [...previousRedScores],
    previousYellowScores: [...previousYellowScores],
    result: stat.result,
    schemaVersion: 1,
    selectedDifficulty: practiceDifficulty,
    startedAt,
    startedAtIso: new Date(startedAt).toISOString(),
    state: moveSequence,
    usedAssist: stat.usedAssist,
    usedUndo: stat.usedUndo,
    winDiscs: stat.winningDiscCount,
    winner: winningPlayer === null ? null : playerClass(winningPlayer),
  };
}

function maybeRecordCompletedPracticeGame(): void {
  if (
    !isTrainingMode() ||
    currentPracticeRecordedStatId !== null ||
    isImportedGame
  ) {
    return;
  }

  if (!isWinLocked && hasPlayableMove()) {
    return;
  }

  const humanPlayer = effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
    red: RED,
    yellow: YELLOW,
  });
  const result: PracticeGameResult =
    !isWinLocked || winningPlayer === null ? "tie" : winningPlayer === humanPlayer ? "win" : "loss";
  const stat: PracticeGameStat = {
    completedAt: Date.now(),
    difficulty: trainingStatDifficulty(),
    gameDurationMs: pendingPracticeGameDurationMs ?? 0,
    id: createPracticeStatId(),
    kind: "game",
    moveCount: historyIndex,
    result,
    usedAssist: didUseAssistThisGame,
    usedUndo: didUseUndoThisGame,
    winningDiscCount: result === "tie" ? null : currentWinningDiscCount(),
  };
  const startedAt = currentGameStartedAt ?? Math.max(0, stat.completedAt - (stat.gameDurationMs ?? 0));

  practiceStats = appendPracticeStat(stat);
  appendPracticeGameResult({
    completedAt: stat.completedAt,
    id: createPracticeStatId(),
    practiceStatId: stat.id,
    result: completedPracticeGameResultBlock(stat, humanPlayer, startedAt),
    startedAt,
  });
  currentPracticeRecordedStatId = stat.id;
  if (result === "loss" && hasUndoneLossSinceReset) {
    recordPracticeEvent("repeat-loss", stat.difficulty);
  }
  renderStatsTable();
}

function playCompletionSound(): void {
  if (!isWinLocked) {
    playSoundEffect("tie");
    return;
  }

  if (currentMode === "freeplay") {
    playSoundEffect("win");
    return;
  }

  if (!isTrainingMode() || winningPlayer === null) {
    return;
  }

  const humanPlayer = effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
    red: RED,
    yellow: YELLOW,
  });
  playSoundEffect(winningPlayer === humanPlayer ? "win" : "lose");
}

function canUndo(): boolean {
  if (isTrainingMode()) {
    return trainingUndoTargetIndex() !== null;
  }

  return freeplayUndoAvailable && historyIndex > 0;
}

function canRedo(): boolean {
  return isTrainingMode() && historyIndex < moveHistory.length;
}

function canReset(): boolean {
  return historyIndex > 0;
}

function trainingHumanPlayer(): PlayerValue {
  return effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
    red: RED,
    yellow: YELLOW,
  });
}

function currentHumanPlayerColorLabel(): string {
  if (!isTrainingMode()) {
    return "";
  }

  const actualColor =
    trainingHumanPlayer() === RED ? APP_STRINGS.colors.red.toLowerCase() : APP_STRINGS.colors.yellow.toLowerCase();
  return practiceColor === "alternate" ? `${actualColor} (${APP_STRINGS.colors.alternate.toLowerCase()})` : actualColor;
}

function currentScoreShareLabel(): string {
  return `${APP_STRINGS.status.lineColor.red} ${ (currentSolvedLineRedShare() * 100).toFixed(4) }%`;
}

function isHumanCurrentlyLosing(): boolean {
  if (!isTrainingMode()) {
    return false;
  }

  const redShare = currentSolvedLineRedShare();
  if (redShare === 0.5) {
    return false;
  }

  return trainingHumanPlayer() === RED ? redShare < 0.5 : redShare > 0.5;
}

function currentWinningDiscCount(): number | null {
  if (!isWinLocked || winningPlayer === null) {
    return null;
  }

  const { winningMask } = detectWinningMask(board);
  let count = 0;
  for (const row of winningMask) {
    for (const cell of row) {
      if (cell) {
        count += 1;
      }
    }
  }

  return count;
}

function trainingUndoTargetIndex(): number | null {
  if (!isTrainingMode()) {
    return null;
  }

  const humanPlayer = trainingHumanPlayer();
  for (let index = historyIndex - 1; index >= 0; index -= 1) {
    if (moveHistory[index]?.player === humanPlayer) {
      return index;
    }
  }

  return null;
}

function canStartHumanMove(): boolean {
  return !isAnimating && isHumanTurn() && !isWinLocked;
}

function syncHistoryControls(): void {
  redoControl.classList.toggle("hidden", !isTrainingMode());
  redoControl.disabled = isAnimating || !canRedo();
  redoControl.setAttribute("aria-hidden", String(!isTrainingMode()));
  undoControl.disabled = isAnimating || !canUndo();
  resetControl.disabled = isAnimating || !canReset();
}

function isOptimizerSuccessPayload(
  payload: OptimizerSuccessPayload | OptimizerErrorPayload,
): payload is OptimizerSuccessPayload {
  return !("error" in payload);
}

function stopOptimizerWorker(): void {
  optimizerWorker?.terminate();
  optimizerWorker = null;
}

function updateScoreBar(): void {
  scoreBar.classList.toggle("hidden", !effectiveGameScoreVisible());
  if (!effectiveGameScoreVisible()) {
    return;
  }

  const redShare = currentSolvedLineRedShare();
  scoreBar.style.setProperty("--score-red-share", String(redShare));
  scoreBarFill.style.width = `${redShare * 100}%`;
}

function solvedLineLength(positionScore: number): number {
  const halfBoard = (WIDTH * HEIGHT) / 2;
  if (positionScore === 0) {
    return halfBoard;
  }

  return Math.max(0, Math.min(halfBoard, halfBoard + 1 - Math.abs(positionScore)));
}

function currentSolvedLineRedShare(): number {
  const totalCells = WIDTH * HEIGHT;
  const halfBoard = totalCells / 2;

  if (winningPlayer === RED) {
    return 1;
  }

  if (winningPlayer === YELLOW) {
    return 0;
  }

  if (!hasPlayableMove()) {
    return 0.5;
  }

  if (moveSequence === "") {
    return halfBoard / totalCells;
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return 0.5;
  }

  const { positionScore } = latestOptimizerPayload;
  if (positionScore === 0) {
    return 0.5;
  }

  const lineLength = solvedLineLength(positionScore);
  const advantagedPlayer = positionScore > 0 ? currentPlayer : nextPlayer(currentPlayer);
  const redCells = advantagedPlayer === RED ? totalCells - lineLength : lineLength;
  return redCells / totalCells;
}

function currentSolvedLineRemainingText(): string {
  if (winningPlayer === RED) {
    return formatTemplate(APP_STRINGS.status.lineIn, {
      color: APP_STRINGS.status.lineColor.red,
      count: 0,
    });
  }

  if (winningPlayer === YELLOW) {
    return formatTemplate(APP_STRINGS.status.lineIn, {
      color: APP_STRINGS.status.lineColor.yellow,
      count: 0,
    });
  }

  if (!hasPlayableMove()) {
    return APP_STRINGS.status.tie;
  }

  if (moveSequence === "") {
    return formatTemplate(APP_STRINGS.status.lineIn, {
      color: APP_STRINGS.status.lineColor.red,
      count: 21,
    });
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return "-";
  }

  const { positionScore } = latestOptimizerPayload;
  if (positionScore === 0) {
    return APP_STRINGS.status.tie;
  }

  const advantagedPlayer = positionScore > 0 ? currentPlayer : nextPlayer(currentPlayer);
  const lineLength = solvedLineLength(positionScore);
  return formatTemplate(APP_STRINGS.status.lineIn, {
    color: advantagedPlayer === RED ? APP_STRINGS.status.lineColor.red : APP_STRINGS.status.lineColor.yellow,
    count: lineLength,
  });
}

function activeBestColumns(): number[] | null {
  if (isWinLocked) {
    return null;
  }

  if (moveSequence === "") {
    return [4];
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return null;
  }

  return latestOptimizerPayload.bestColumns;
}

function activeColumnScores(): number[] | null {
  if (isWinLocked) {
    return null;
  }

  if (moveSequence === "") {
    return EMPTY_BOARD_SCORES;
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return null;
  }

  return latestOptimizerPayload.scores;
}

function renderColumnScores(): void {
  columnScoreRow.classList.toggle("hidden", !effectiveMoveScoresVisible());
  if (!effectiveMoveScoresVisible()) {
    return;
  }

  const scores = activeColumnScores();
  const displayScores = scores ? shiftSolverScoresToDisplay(scores) : null;
  for (let column = 0; column < WIDTH; column += 1) {
    const slot = columnScoreSlots[column];
    const score = displayScores?.[column];
    slot.textContent = score === undefined || score === null ? "" : String(score);
  }
}

function scoreForSelectedColumn(column: number): number | null {
  if (moveSequence === "") {
    return EMPTY_BOARD_SCORES[column] ?? null;
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return null;
  }

  const score = latestOptimizerPayload.scores[column];
  return typeof score === "number" ? score : null;
}

function clearBoardVisualState(): void {
  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      board[row][column] = EMPTY;
      discElements[row][column] = null;
    }
  }

  for (const slot of discSlots) {
    slot.replaceChildren();
  }
}

function rebuildBoardFromHistory(options: RebuildHistoryOptions = {}): void {
  const {
    suppressCompletionEffects = false,
    suppressStatsRecording = false,
  } = options;
  const wasGameComplete = isWinLocked || !hasPlayableMove();
  cancelAiTurn();
  stopOptimizerWorker();
  dropToken += 1;
  isAnimating = false;
  window.clearTimeout(shakeResetTimeout);
  boardShell.classList.remove("is-locked-shaking");

  if (activePointerId !== null && boardGrid.hasPointerCapture(activePointerId)) {
    boardGrid.releasePointerCapture(activePointerId);
  }

  activePointerId = null;
  latestOptimizerOutput = "";
  latestOptimizerPayload = null;
  lastPracticeAiDebug = null;
  moveSequence = "";
  previousRedScores.length = 0;
  previousYellowScores.length = 0;
  currentPlayer = RED;
  winningPlayer = null;
  isWinLocked = false;
  hidePreview();
  clearTrainingHints();
  clearBoardVisualState();

  for (let index = 0; index < historyIndex; index += 1) {
    const record = moveHistory[index];
    const row = lowestOpenRow(board, record.column);
    if (row === null) {
      break;
    }

    board[row][record.column] = record.player;
    if (record.player === RED) {
      previousRedScores.push(record.previousScore);
    } else {
      previousYellowScores.push(record.previousScore);
    }

    moveSequence += String(record.column + 1);
    const disc = document.createElement("div");
    disc.className = `disc piece ${playerClass(record.player)}`;
    discSlots[slotIndexFor(row, record.column)].append(disc);
    discElements[row][record.column] = disc;
    currentPlayer = nextPlayer(record.player);

    if (record.aiDebug !== null) {
      lastPracticeAiDebug = record.aiDebug;
    }
  }

  isWinLocked = updateWinningHighlights();
  winningPlayer = isWinLocked && historyIndex > 0 ? moveHistory[historyIndex - 1].player : null;
  const isGameComplete = isWinLocked || !hasPlayableMove();
  if (!wasGameComplete && isGameComplete) {
    completeGameTimer();
  }
  if (!suppressCompletionEffects && !wasGameComplete && isGameComplete) {
    playCompletionSound();
  }
  if (!suppressStatsRecording) {
    maybeRecordCompletedPracticeGame();
  }
  syncMoveSequence();
  requestOptimizerOutput();
}

function commitMove(column: number, player: PlayerValue): void {
  if (isTrainingMode() && player !== trainingHumanPlayer()) {
    lowestAiDifficultyThisGame =
      lowestAiDifficultyThisGame === null ? practiceDifficulty : Math.min(lowestAiDifficultyThisGame, practiceDifficulty);
  }

  const record: MoveRecord = {
    aiDebug:
      isTrainingMode() &&
      player !==
        effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
          red: RED,
          yellow: YELLOW,
        })
        ? lastPracticeAiDebug
        : null,
    column,
    player,
    previousScore: scoreForSelectedColumn(column),
  };

  if (isTrainingMode()) {
    const expectedRecord = moveHistory[historyIndex];
    if (
      expectedRecord &&
      expectedRecord.column === record.column &&
      expectedRecord.player === record.player
    ) {
      if (expectedRecord.previousScore === null && record.previousScore !== null) {
        expectedRecord.previousScore = record.previousScore;
      }
      if (record.aiDebug !== null) {
        expectedRecord.aiDebug = record.aiDebug;
      }
      historyIndex += 1;
      rebuildBoardFromHistory();
      return;
    }
  }

  moveHistory.length = historyIndex;
  moveHistory.push(record);
  historyIndex = moveHistory.length;
  freeplayUndoAvailable = currentMode === "freeplay";
  rebuildBoardFromHistory();
}

function clearTrainingHints(): void {
  for (const slot of trainerSlots) {
    slot.replaceChildren();
  }
}

function renderTrainingHints(bestColumns: number[]): void {
  clearTrainingHints();

  if (!effectiveBestMoveVisible() || isAnimating || isWinLocked) {
    return;
  }

  const uniqueColumns = new Set(bestColumns);
  for (const oneBasedColumn of uniqueColumns) {
    const column = oneBasedColumn - 1;
    if (column < 0 || column >= WIDTH) {
      continue;
    }

    const row = lowestOpenRow(board, column);
    if (row === null) {
      continue;
    }

    const trainerPiece = document.createElement("div");
    trainerPiece.className = "trainer-piece piece trainer";
    trainerSlots[slotIndexFor(row, column)].append(trainerPiece);
  }
}

function renderCurrentTrainingHints(): void {
  const bestColumns = activeBestColumns();
  if (!bestColumns) {
    clearTrainingHints();
    return;
  }

  renderTrainingHints(bestColumns);
}

function cancelAiTurn(): void {
  if (aiMoveTimeout !== 0) {
    window.clearTimeout(aiMoveTimeout);
    aiMoveTimeout = 0;
  }

  aiScheduledSequence = null;
  aiPlannedColumn = null;
  aiPlannedDebug = null;
}

function currentPracticeAiScores(): number[] | null {
  if (!isTrainingMode() || isWinLocked) {
    return null;
  }

  if (moveSequence === "") {
    return EMPTY_BOARD_SCORES;
  }

  if (!latestOptimizerPayload || latestOptimizerPayload.sequence !== moveSequence) {
    return null;
  }

  return latestOptimizerPayload.scores;
}

function maybeScheduleAiTurn(): void {
  cancelAiTurn();

  if (!isTrainingMode() || isAnimating || isWinLocked || isHumanTurn()) {
    return;
  }

  let chosenColumn: number | null = null;
  let chosenDebug: PracticeAiDebug | null = null;

  if (historyIndex < moveHistory.length) {
    const nextRecord = moveHistory[historyIndex];
    if (nextRecord.player !== currentPlayer) {
      return;
    }

    chosenColumn = nextRecord.column;
    chosenDebug = nextRecord.aiDebug;
  } else {
    const scores = currentPracticeAiScores();
    if (!scores) {
      return;
    }

    const aiChoice = choosePracticeAiColumn({
      board,
      difficulty: practiceDifficulty,
      isColumnPlayable: (column) => lowestOpenRow(board, column) !== null,
      player: currentPlayer,
      scores,
    });
    if (aiChoice.column === null) {
      return;
    }

    chosenColumn = aiChoice.column;
    chosenDebug = aiChoice.debug;
  }

  const scheduledSequence = moveSequence;
  aiPlannedColumn = chosenColumn;
  aiPlannedDebug = chosenDebug;
  aiScheduledSequence = scheduledSequence;
  renderTurnIndicator();
  aiMoveTimeout = window.setTimeout(() => {
    aiMoveTimeout = 0;
    aiScheduledSequence = null;

    if (
      !isTrainingMode() ||
      isAnimating ||
      isWinLocked ||
      isHumanTurn() ||
      moveSequence !== scheduledSequence
    ) {
      return;
    }

    if (aiPlannedColumn === null) {
      return;
    }

    lastPracticeAiDebug = aiPlannedDebug;
    const chosenColumn = aiPlannedColumn;
    aiPlannedColumn = null;
    aiPlannedDebug = null;

    updatePreview(chosenColumn);
    runCriticalFrame(() => {
      if (
        !isTrainingMode() ||
        isAnimating ||
        isWinLocked ||
        isHumanTurn() ||
        moveSequence !== scheduledSequence
      ) {
        return;
      }

      dropPreview(chosenColumn);
    });
  }, 500);
}

function requestOptimizerOutput(): void {
  if (isWinLocked && winningPlayer !== null) {
    stopOptimizerWorker();
    cancelAiTurn();
    clearTrainingHints();
    latestOptimizerOutput = "";
    latestOptimizerPayload = null;
    syncFeatureUI();
    return;
  }

  stopOptimizerWorker();
  latestOptimizerPayload = null;
  latestOptimizerOutput = `status: ${APP_STRINGS.status.thinking}`;
  aiPlannedColumn = null;
  aiPlannedDebug = null;
  syncFeatureUI();
  maybeScheduleAiTurn();

  const worker = new Worker(new URL("./optimizer-worker.ts", import.meta.url), { type: "module" });
  optimizerWorker = worker;

  worker.addEventListener("message", (event: MessageEvent<OptimizerWorkerResponse>) => {
    if (optimizerWorker !== worker) {
      return;
    }

    if (isOptimizerSuccessPayload(event.data.payload)) {
      latestOptimizerPayload = event.data.payload;
    } else {
      latestOptimizerPayload = null;
    }

    latestOptimizerOutput = event.data.output;
    syncFeatureUI();
    maybeScheduleAiTurn();
    stopOptimizerWorker();
  });

  worker.addEventListener("error", () => {
    if (optimizerWorker !== worker) {
      return;
    }

    latestOptimizerOutput = `status: ${APP_STRINGS.status.optimizerWorkerFailed}`;
    latestOptimizerPayload = null;
    syncFeatureUI();
    cancelAiTurn();
    stopOptimizerWorker();
  });

  worker.postMessage({ sequence: moveSequence });
}

function clampColumn(column: number): number {
  return Math.max(0, Math.min(WIDTH - 1, column));
}

function columnFromPointer(clientX: number): number {
  const rect = boardShell.getBoundingClientRect();
  const cellSize = rect.width / WIDTH;
  return clampColumn(Math.floor((clientX - rect.left) / cellSize));
}

function updateWinningHighlights(): boolean {
  const { hasWinningRun, winningMask } = detectWinningMask(board);

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      discElements[row][column]?.classList.toggle("is-winning", winningMask[row][column]);
    }
  }

  return hasWinningRun;
}

function triggerWinLockShake(): void {
  window.clearTimeout(shakeResetTimeout);
  boardShell.classList.remove("is-locked-shaking");
  void boardShell.offsetWidth;
  boardShell.classList.add("is-locked-shaking");
  shakeResetTimeout = window.setTimeout(() => {
    boardShell.classList.remove("is-locked-shaking");
  }, 280);
}

function updatePreview(column: number): void {
  if (isWinLocked) {
    hidePreview();
    return;
  }

  activeColumn = column;
  previewPiece.style.setProperty("--column", String(column));
  previewPiece.classList.remove("hidden", "red", "yellow");

  if (lowestOpenRow(board, column) === null) {
    previewPiece.classList.add("hidden");
    return;
  }

  previewPiece.classList.add(playerClass(currentPlayer));
}

function hidePreview(): void {
  activeColumn = null;
  previewPiece.classList.add("hidden");
  previewPiece.classList.remove("dropping", "red", "yellow");
  previewPiece.style.removeProperty("top");
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function queueHumanMove(column: number): void {
  if (!canStartHumanMove()) {
    if (isWinLocked) {
      triggerWinLockShake();
    }
    return;
  }

  if (lowestOpenRow(board, column) === null) {
    hidePreview();
    return;
  }

  if (activePointerId !== null && boardGrid.hasPointerCapture(activePointerId)) {
    boardGrid.releasePointerCapture(activePointerId);
  }
  activePointerId = null;

  updatePreview(column);
  runCriticalFrame(() => {
    if (!canStartHumanMove() || lowestOpenRow(board, column) === null) {
      hidePreview();
      return;
    }

    dropPreview(column);
  });
}

function animateResetPiece(source: HTMLElement): void {
  const rect = source.getBoundingClientRect();
  const boardShellRect = boardShell.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }

  const clone = source.cloneNode(false) as HTMLDivElement;
  clone.classList.remove("disc", "preview-piece", "hidden", "dropping");
  clone.classList.add("reset-piece");
  clone.style.left = `${rect.left - boardShellRect.left}px`;
  clone.style.top = `${rect.top - boardShellRect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.setProperty("--reset-drop", `${window.innerHeight - rect.top + rect.height}px`);
  boardShell.append(clone);

  runCriticalFrame(() => {
    clone.classList.add("falling");
  });

  window.setTimeout(() => {
    clone.remove();
  }, 760);
}

function animateResetPieces(): void {
  const placedDiscs = discGrid.querySelectorAll<HTMLElement>(".disc");
  for (const disc of placedDiscs) {
    animateResetPiece(disc);
  }

  if (isAnimating && !previewPiece.classList.contains("hidden")) {
    animateResetPiece(previewPiece);
  }
}

function resetBoard(options?: { advancePracticeRound?: boolean; recordTrainingReset?: boolean }): void {
  const { advancePracticeRound = true, recordTrainingReset = false } = options ?? {};
  if (recordTrainingReset && isTrainingMode() && !isImportedGame) {
    const difficulty = trainingStatDifficulty();
    recordPracticeEvent("reset", difficulty);
    if (isHumanCurrentlyLosing()) {
      recordPracticeEvent("reset-while-losing", difficulty);
    }
  }

  clearPendingBoardResetTap();
  playSoundEffect("board-reset");
  animateResetPieces();
  if (advancePracticeRound && isTrainingMode() && practiceColor === "alternate") {
    practiceRoundIndex += 1;
  }
  currentPracticeRecordedStatId = null;
  isImportedGame = false;
  lowestAiDifficultyThisGame = null;
  didUseAssistThisGame = hasTrainingAssistEnabled();
  didUseUndoThisGame = false;
  hasUndoneLossSinceReset = false;
  resetGameTimer();
  moveHistory.length = 0;
  historyIndex = 0;
  freeplayUndoAvailable = false;
  rebuildBoardFromHistory();
}

function importStateFromLocation(): void {
  const sequence = stateSequenceFromLocation();
  const importedHistory = sequence ? moveHistoryFromSequence(sequence) : [];

  clearPendingBoardResetTap();
  moveHistory.length = 0;
  historyIndex = 0;
  freeplayUndoAvailable = false;
  currentPracticeRecordedStatId = null;
  isImportedGame = Boolean(sequence);
  lowestAiDifficultyThisGame = null;
  didUseAssistThisGame = hasTrainingAssistEnabled();
  didUseUndoThisGame = false;
  hasUndoneLossSinceReset = false;
  resetGameTimer();

  if (sequence && importedHistory === null) {
    console.warn(`Ignoring invalid Connect 4 state from URL: ${sequence}`);
    isImportedGame = false;
    rebuildBoardFromHistory({
      suppressCompletionEffects: true,
      suppressStatsRecording: true,
    });
    return;
  }

  if (importedHistory) {
    moveHistory.push(...importedHistory);
    historyIndex = importedHistory.length;
    freeplayUndoAvailable = currentMode === "freeplay" && historyIndex > 0;
  }

  rebuildBoardFromHistory({
    suppressCompletionEffects: true,
    suppressStatsRecording: true,
  });
}

function importStateSequence(sequence: string, options: { allowEmpty?: boolean } = {}): boolean {
  if (!isValidImportSequence(sequence, options)) {
    return false;
  }

  const importedHistory = moveHistoryFromSequence(sequence);
  if (importedHistory === null) {
    return false;
  }

  clearPendingBoardResetTap();
  moveHistory.length = 0;
  moveHistory.push(...importedHistory);
  historyIndex = importedHistory.length;
  freeplayUndoAvailable = currentMode === "freeplay" && historyIndex > 0;
  currentPracticeRecordedStatId = null;
  isImportedGame = importedHistory.length > 0;
  lowestAiDifficultyThisGame = null;
  didUseAssistThisGame = hasTrainingAssistEnabled();
  didUseUndoThisGame = false;
  hasUndoneLossSinceReset = false;
  resetGameTimer();
  rebuildBoardFromHistory({
    suppressCompletionEffects: true,
    suppressStatsRecording: true,
  });
  return true;
}

function applyImportedDevSettings(importedOutput: DevOutputImport): void {
  const hasMode = importedOutput.mode !== null;
  if (importedOutput.mode !== null) {
    currentMode = importedOutput.mode;
  }

  if (importedOutput.practiceColor !== null) {
    practiceColor = importedOutput.practiceColor;
  }

  if (importedOutput.practiceDifficulty !== null) {
    practiceDifficulty = importedOutput.practiceDifficulty;
  }

  updateDocumentTitle();
  syncModeControls();
  updatePracticeControls();
  persistUiState();

  if (hasMode) {
    syncModeUrl(currentMode, "replace");
  }
}

function applyImportedDevRunState(importedOutput: DevOutputImport): void {
  if (importedOutput.didUseAssist !== null) {
    didUseAssistThisGame = importedOutput.didUseAssist;
  }

  if (importedOutput.didUseUndo !== null) {
    didUseUndoThisGame = importedOutput.didUseUndo;
  }

  if (importedOutput.timerMs !== null) {
    const timerMs = Math.max(0, importedOutput.timerMs);
    if (isGameComplete()) {
      pendingPracticeGameDurationMs = timerMs;
      gameTimerStartedAt = null;
    } else if (timerMs > 0) {
      pendingPracticeGameDurationMs = null;
      gameTimerStartedAt = Date.now() - timerMs;
    } else {
      pendingPracticeGameDurationMs = null;
      gameTimerStartedAt = null;
    }

    syncGameTimerInterval();
  }

  renderDevOutput();
}

function importDevOutputText(rawText: string): boolean {
  try {
    const importedOutput = parseDevOutputImport(rawText);
    if (importedOutput === null) {
      return false;
    }

    applyImportedDevSettings(importedOutput);
    if (!importStateSequence(importedOutput.state, { allowEmpty: true })) {
      return false;
    }

    applyImportedDevRunState(importedOutput);
    return true;
  } catch {
    return false;
  }
}

async function importStateFromClipboard(): Promise<void> {
  if (!navigator.clipboard?.readText) {
    console.warn("Clipboard import is unavailable.");
    return;
  }

  try {
    const rawText = await navigator.clipboard.readText();
    if (importDevOutputText(rawText)) {
      return;
    }

    const candidate = stateImportCandidateFromText(rawText);
    if (
      candidate === null ||
      !importStateSequence(candidate.sequence, { allowEmpty: candidate.allowEmpty })
    ) {
      console.warn("Clipboard did not contain a valid Connect 4 state.");
      return;
    }
  } catch {
    console.warn("Clipboard import failed.");
  }
}

async function exportStateToClipboard(): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    console.warn("Clipboard export is unavailable.");
    return;
  }

  try {
    renderDevOutput();
    const output = effectiveDevModeVisible() ? devOutputBox.value : currentDevOutputText();
    await navigator.clipboard.writeText(output);
  } catch {
    console.warn("Clipboard export failed.");
  }
}

function targetTopForRow(row: number): string {
  return `calc(${HEIGHT - 1 - row} * var(--cell-size) + (var(--cell-size) - var(--piece-size)) / 2)`;
}

function dropPreview(column: number): void {
  const row = lowestOpenRow(board, column);
  if (row === null) {
    hidePreview();
    return;
  }

  const player = currentPlayer;
  currentGameStartedAt ??= Date.now();
  startGameTimerIfNeeded(player);
  const currentDropToken = ++dropToken;
  let didFinish = false;
  isAnimating = true;
  clearTrainingHints();

  const finishDrop = (): void => {
    if (didFinish) {
      return;
    }

    didFinish = true;
    previewPiece.removeEventListener("transitionend", onTransitionEnd);
    window.clearTimeout(fallbackTimeout);

    if (currentDropToken !== dropToken) {
      return;
    }

    playSoundEffect(currentTheme === "mogged" ? "mogg" : "disc-drop");
    hidePreview();
    commitMove(column, player);
  };

  const onTransitionEnd = (event: Event) => {
    const transitionEvent = event as TransitionEvent;
    if (transitionEvent.propertyName !== "top") {
      return;
    }

    finishDrop();
  };

  previewPiece.addEventListener("transitionend", onTransitionEnd);
  previewPiece.classList.add("dropping");
  void previewPiece.offsetWidth;
  runCriticalFrame(() => {
    if (currentDropToken !== dropToken) {
      return;
    }

    previewPiece.style.top = targetTopForRow(row);
  });

  const fallbackTimeout = window.setTimeout(() => {
    finishDrop();
  }, 450);
}

function endInteraction(drop: boolean): void {
  if (activePointerId !== null) {
    boardGrid.releasePointerCapture(activePointerId);
  }
  activePointerId = null;

  if (!drop || activeColumn === null) {
    hidePreview();
    return;
  }

  dropPreview(activeColumn);
}

function performUndo(): void {
  if (isAnimating) {
    return;
  }

  if (isTrainingMode()) {
    const targetIndex = trainingUndoTargetIndex();
    if (targetIndex === null) {
      return;
    }

    didUseUndoThisGame = true;
    playSoundEffect("undo");
    const removedStat = removeCurrentPracticeRecordedStat();
    if (removedStat?.result === "loss") {
      hasUndoneLossSinceReset = true;
      recordPracticeEvent("loss-undo", removedStat.difficulty);
    }
    historyIndex = targetIndex;
    rebuildBoardFromHistory();
    return;
  }

  if (!freeplayUndoAvailable || historyIndex === 0) {
    return;
  }

  didUseUndoThisGame = true;
  playSoundEffect("undo");
  historyIndex -= 1;
  freeplayUndoAvailable = false;
  rebuildBoardFromHistory();
}

function performRedo(): void {
  if (isAnimating || !isTrainingMode() || historyIndex >= moveHistory.length) {
    return;
  }

  historyIndex += 1;
  rebuildBoardFromHistory();
}

function bindFeatureControl(feature: FeatureKey): void {
  const pulseButton = featurePulseButtons[feature];
  const toggleInput = featureToggleInputs[feature];

  pulseButton.addEventListener("pointerdown", (event: PointerEvent) => {
    if (featurePinned[feature]) {
      return;
    }

    pulseButton.setPointerCapture(event.pointerId);
    setFeatureHeld(feature, true);
  });

  const clearHeld = () => {
    setFeatureHeld(feature, false);
  };

  pulseButton.addEventListener("pointerup", clearHeld);
  pulseButton.addEventListener("pointercancel", clearHeld);
  pulseButton.addEventListener("lostpointercapture", clearHeld);

  toggleInput.addEventListener("change", () => {
    setFeaturePinned(feature, toggleInput.checked);
  });
}

boardGrid.addEventListener("pointerdown", (event: PointerEvent) => {
  const isFirstBoardAudioInteraction = audioController.noteBoardInteraction();
  if (isFirstBoardAudioInteraction) {
    syncThemeAudio(true);
  }

  if (isAnimating) {
    return;
  }

  if (maybeHandleBoardDoubleTapReset(event)) {
    return;
  }

  if (!isHumanTurn()) {
    return;
  }

  if (isWinLocked) {
    triggerWinLockShake();
    return;
  }

  clearPendingBoardResetTap();
  activePointerId = event.pointerId;
  boardGrid.setPointerCapture(event.pointerId);
  updatePreview(columnFromPointer(event.clientX));
});

boardGrid.addEventListener("pointermove", (event: PointerEvent) => {
  if (isAnimating || activePointerId !== event.pointerId) {
    return;
  }

  updatePreview(columnFromPointer(event.clientX));
});

boardGrid.addEventListener("pointerup", (event: PointerEvent) => {
  if (activePointerId !== event.pointerId || isAnimating) {
    return;
  }

  endInteraction(true);
});

boardGrid.addEventListener("pointercancel", (event: PointerEvent) => {
  if (activePointerId !== event.pointerId || isAnimating) {
    return;
  }

  endInteraction(false);
});

boardGrid.addEventListener("lostpointercapture", () => {
  if (!isAnimating && activePointerId !== null) {
    activePointerId = null;
    hidePreview();
  }
});

resetControl.addEventListener("click", () => {
  if (!canReset()) {
    return;
  }

  resetBoard({ recordTrainingReset: true });
});

titleControl.addEventListener("click", () => {
  if (!canReset()) {
    return;
  }

  resetBoard({ recordTrainingReset: true });
});

aboutControl.addEventListener("click", () => {
  setToolsMenuExpanded(false);
  openModalView("about", aboutControl, { aboutTab: "about" });
});

statsControl.addEventListener("click", () => {
  setToolsMenuExpanded(false);
  openModalView("stats", statsControl);
});

aboutClose.addEventListener("click", () => {
  closeActiveModal();
});

aboutBackdrop.addEventListener("click", () => {
  closeActiveModal();
});

undoControl.addEventListener("click", () => {
  performUndo();
});

redoControl.addEventListener("click", () => {
  performRedo();
});

toolsMenuToggle.addEventListener("click", () => {
  setToolsMenuExpanded(!isToolsMenuExpanded);
});

document.addEventListener("pointerdown", (event: PointerEvent) => {
  if (!isToolsMenuExpanded) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (toolsMenu.contains(target) || toolsMenuToggle.contains(target)) {
    return;
  }

  setToolsMenuExpanded(false);
});

trainingModeControl.addEventListener("click", () => {
  setCurrentMode("training");
});

freeplayModeControl.addEventListener("click", () => {
  setCurrentMode("freeplay");
});

for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
  const row = Math.floor(index / WIDTH);
  const column = index % WIDTH;
  const trainerSlot = document.createElement("div");
  trainerSlot.className = "trainer-slot";
  trainerSlots.push(trainerSlot);
  trainerGrid.append(trainerSlot);

  const slot = document.createElement("div");
  slot.className = "disc-slot";
  discSlots.push(slot);
  discGrid.append(slot);

  const cell = document.createElement("div");
  cell.className = "board-cell";
  cell.style.setProperty("--board-col", String(column));
  cell.style.setProperty("--board-row", String(row));
  boardGrid.append(cell);
}

for (let column = 0; column < WIDTH; column += 1) {
  const score = document.createElement("span");
  score.className = "column-score";
  columnScoreSlots.push(score);
  columnScoreRow.append(score);
}

for (const feature of Object.keys(featurePulseButtons) as FeatureKey[]) {
  bindFeatureControl(feature);
}

for (const button of practiceColorButtons) {
  button.addEventListener("click", () => {
    const nextColor = button.dataset.practiceColor as PracticeColor | undefined;
    if (!nextColor) {
      return;
    }

    setPracticeColor(nextColor);
  });
}

practiceDifficultySlider.addEventListener("input", () => {
  setPracticeDifficulty(Number(practiceDifficultySlider.value));
});

freeplayGameScoreToggle.addEventListener("change", () => {
  setFeaturePinned("gameScore", freeplayGameScoreToggle.checked);
});

settingsDevModeToggle.addEventListener("change", () => {
  setDevModeEnabled(settingsDevModeToggle.checked);
});

settingsAudioToggle.addEventListener("change", () => {
  setAudioEnabled(settingsAudioToggle.checked);
});

settingsColorblindModeToggle.addEventListener("change", () => {
  setColorblindModeEnabled(settingsColorblindModeToggle.checked);
});

for (const button of aboutTabButtons) {
  button.addEventListener("click", () => {
    const tab = button.dataset.aboutTab as AboutTab | undefined;
    if (!tab) {
      return;
    }

    setAboutTab(tab);
  });
}

statsDifficultySelect.addEventListener("change", () => {
  setStatsDifficulty(Number(statsDifficultySelect.value));
});

settingsThemeSelect.addEventListener("change", () => {
  const theme = settingsThemeSelect.value as ThemeName;
  if (!isThemeName(theme)) {
    return;
  }

  setTheme(theme);
  setToolsMenuExpanded(false);
});

settingsLanguageSelect.addEventListener("change", () => {
  const nextLocale = settingsLanguageSelect.value;
  if (!isAppLocale(nextLocale)) {
    return;
  }

  setAppLocale(nextLocale);
  refreshLocalizedUi();
  persistUiState();
});

importStateControl.addEventListener("click", () => {
  void importStateFromClipboard();
});

exportStateControl.addEventListener("click", () => {
  void exportStateToClipboard();
});

devRefreshControl.addEventListener("click", () => {
  void refreshPwaOfflineCache();
});

devCloseControl.addEventListener("click", () => {
  setDevModeEnabled(false);
});

devResizeControl.addEventListener("pointerdown", (event: PointerEvent) => {
  if (!effectiveDevModeVisible() || !isPortraitDevResizeEnabled()) {
    return;
  }

  event.preventDefault();
  syncPortraitDevPanelHeight();
  activeDevResizePointerId = event.pointerId;
  activeDevResizeStartY = event.clientY;
  activeDevResizeStartHeightPx = devPanel.getBoundingClientRect().height;
  devResizeControl.setPointerCapture(event.pointerId);
  devResizeControl.classList.add("is-dragging");
});

devResizeControl.addEventListener("pointermove", (event: PointerEvent) => {
  if (activeDevResizePointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  updatePortraitDevPanelHeight(activeDevResizeStartHeightPx + (activeDevResizeStartY - event.clientY));
});

devResizeControl.addEventListener("pointerup", (event: PointerEvent) => {
  if (activeDevResizePointerId !== event.pointerId) {
    return;
  }

  stopPortraitDevPanelResize();
});

devResizeControl.addEventListener("pointercancel", (event: PointerEvent) => {
  if (activeDevResizePointerId !== event.pointerId) {
    return;
  }

  stopPortraitDevPanelResize();
});

devResizeControl.addEventListener("lostpointercapture", () => {
  stopPortraitDevPanelResize();
});

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && isAboutModalOpen) {
    closeActiveModal();
    return;
  }

  if (event.key === "Escape" && isToolsMenuExpanded) {
    setToolsMenuExpanded(false);
    return;
  }

  if (event.repeat || isEditableShortcutTarget(event.target)) {
    return;
  }

  if (event.key === "Enter") {
    if (!canReset()) {
      return;
    }

    event.preventDefault();
    resetBoard({ recordTrainingReset: true });
    return;
  }

  if (event.key === "Backspace") {
    if (!canUndo()) {
      return;
    }

    event.preventDefault();
    performUndo();
    return;
  }

  const keyNumber = Number.parseInt(event.key, 10);
  if (Number.isNaN(keyNumber) || keyNumber < 1 || keyNumber > WIDTH) {
    return;
  }

  if (!canStartHumanMove()) {
    if (isWinLocked) {
      event.preventDefault();
      triggerWinLockShake();
    }
    return;
  }

  event.preventDefault();
  queueHumanMove(keyNumber - 1);
});

window.addEventListener("resize", () => {
  syncCompactLandscapeDevControls();
  syncPortraitDevPanelHeight();
  scheduleBoardFrameLayout();
});

window.visualViewport?.addEventListener("resize", () => {
  syncCompactLandscapeDevControls();
  syncPortraitDevPanelHeight();
  scheduleBoardFrameLayout();
});

window.addEventListener("popstate", () => {
  const pathMode = modeForPathname(window.location.pathname);
  if (!pathMode) {
    return;
  }

  setCurrentMode(pathMode, { history: "none", resetBoard: false });
  importStateFromLocation();
});

const persistedUiState = readPersistedUiState();
setAppLocale(resolveAppLocale(persistedUiState.locale));
const persistedMode = persistedUiState.selectedMode === "freeplay" ? "freeplay" : "training";
currentMode = modeForPathname(window.location.pathname) ?? persistedMode;
const persistedPinned = persistedUiState.pinned ?? {};
for (const feature of Object.keys(featureToggleInputs) as FeatureKey[]) {
  const hasPersistedPinned = Object.prototype.hasOwnProperty.call(persistedPinned, feature);
  const pinned = hasPersistedPinned ? persistedPinned[feature] === true : currentMode === "training";
  featurePinned[feature] = pinned;
  featureToggleInputs[feature].checked = pinned;
}

isDevModeEnabled = persistedUiState.devMode === true;
isAudioEnabled = persistedUiState.audioEnabled !== false;
isColorblindModeEnabled = persistedUiState.colorblindMode === true;
practiceColor = persistedUiState.practiceColor ?? "red";
currentTheme = isThemeName(persistedUiState.theme ?? "") ? persistedUiState.theme : "light";
const persistedDifficulty = persistedUiState.practiceDifficulty;
if (typeof persistedDifficulty === "number" && Number.isFinite(persistedDifficulty)) {
  practiceDifficulty = Math.max(1, Math.min(10, Math.round(persistedDifficulty)));
}
statsDifficulty = practiceDifficulty;
didUseAssistThisGame = hasTrainingAssistEnabled();
ensureThemeFont(currentTheme);
applyTheme(currentTheme);
moggedBackground.setEnabled(currentTheme === "mogged");
syncDiscPatternMode();
syncThemeAudio(false);
settingsAudioToggle.checked = isAudioEnabled;
refreshLocalizedUi();
syncModeUrl(currentMode, "replace");
registerPwaServiceWorker();
setAboutTab(activeAboutTab);
setToolsMenuExpanded(persistedUiState.toolsMenuExpanded ?? persistedUiState.menuExpanded ?? false);
syncFeatureControls();
importStateFromLocation();
window.connect4State = {
  getCompletedGameResults: () => readStoredPracticeGameResults(),
  getSequence: () => moveSequence,
  getOptimizerOutput: () => latestOptimizerOutput,
  getPreviousRedScores: () => [...previousRedScores],
  getPreviousYellowScores: () => [...previousYellowScores],
};
