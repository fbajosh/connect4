import { buildDevOutput, scoreBarRedShare } from "./dev-output";
import {
  type FeatureKey,
  type GameMode,
  type OptimizerErrorPayload,
  type OptimizerSuccessPayload,
  type OptimizerWorkerResponse,
  type PersistedUiState,
  type PracticeColor,
  type StatsRange,
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
  modeLabel,
  isThemeName,
  modeForPathname,
  pathForMode,
  readPersistedUiState,
  titleForMode,
  writePersistedUiState,
} from "./ui-persistence";
import { appendPracticeStat, buildPracticeStatsRows, createPracticeStatId, readStoredPracticeStats, removePracticeStatById, type PracticeGameResult, type PracticeGameStat } from "./stats";
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
const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
const trainerGrid = document.getElementById("trainer-grid");
const discGrid = document.getElementById("disc-grid");
const landingRoot = document.querySelector<HTMLElement>(".landing");
const hero = document.querySelector<HTMLElement>(".hero");
const menuBar = document.querySelector<HTMLElement>(".menu-bar");
const boardStage = document.querySelector<HTMLElement>(".board-stage");
const boardActions = document.querySelector<HTMLElement>(".board-actions");
const boardFrame = boardShell?.parentElement;
const titleControl = document.getElementById("title-control");
const scoreBar = document.getElementById("score-bar");
const scoreBarFill = document.getElementById("score-bar-fill");
const turnIndicator = document.getElementById("turn-indicator");
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
const devOutputBox = document.getElementById("dev-output-box");
const settingsAudioToggle = document.getElementById("settings-audio-toggle");
const settingsDevModeToggle = document.getElementById("settings-dev-mode-toggle");
const settingsColorblindModeToggle = document.getElementById("settings-colorblind-mode-toggle");
const settingsThemeSelect = document.getElementById("settings-theme-select");
const statsTableBody = document.getElementById("stats-table-body");
const themeBackground = document.getElementById("theme-background");

if (
  !themeBackground ||
  !landingRoot ||
  !hero ||
  !titleControl ||
  !boardStage ||
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
  !devOutputBox ||
  !settingsAudioToggle ||
  !settingsDevModeToggle ||
  !settingsColorblindModeToggle ||
  !settingsThemeSelect ||
  !statsTableBody
) {
  throw new Error("Missing required board elements.");
}

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
const statsRangeButtons = Array.from(aboutModal.querySelectorAll<HTMLButtonElement>("[data-stats-range]"));
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
let currentTheme: ThemeName = "light";
let statsRange: StatsRange = "all-time";
let practiceRoundIndex = 0;
let aiMoveTimeout = 0;
let aiScheduledSequence: string | null = null;
let aiPlannedColumn: number | null = null;
let aiPlannedDebug: PracticeAiDebug | null = null;
let lastPracticeAiDebug: PracticeAiDebug | null = null;
let historyIndex = 0;
let freeplayUndoAvailable = false;
let currentPracticeRecordedStatId: string | null = null;
const previousRedScores: Array<number | null> = [];
const previousYellowScores: Array<number | null> = [];
const moveHistory: MoveRecord[] = [];
let practiceStats: PracticeGameStat[] = readStoredPracticeStats();
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
    statsRange,
    theme: currentTheme,
    pinned: {
      bestMove: featurePinned.bestMove,
      moveScores: featurePinned.moveScores,
      gameScore: featurePinned.gameScore,
    },
  };
  writePersistedUiState(state);
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
    aboutTitle.textContent = "Statistics";
    return;
  }

  aboutTitle.textContent = "About Connect 4 Trainer";
}

function openModalView(view: ModalView, trigger: HTMLElement, options?: { aboutTab?: AboutTab }): void {
  activeModalView = view;
  modalReturnFocusTarget = trigger;
  if (view === "about" && options?.aboutTab) {
    setAboutTab(options.aboutTab);
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

  return String(Math.round(value));
}

function formatWinRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function renderStatsTable(): void {
  const rows = buildPracticeStatsRows(practiceStats, statsRange);
  statsTableBody.replaceChildren();

  for (const row of rows) {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <th scope="row">${row.difficulty}</th>
      <td>${row.wins}</td>
      <td>${row.losses}</td>
      <td>${formatWinRate(row.winRate)}</td>
      <td>${formatStatsNumber(row.averageWinLength)}</td>
      <td>${formatStatsNumber(row.averageLossLength)}</td>
    `;
    statsTableBody.append(tableRow);
  }
}

function syncStatsRangeControls(): void {
  for (const button of statsRangeButtons) {
    const range = button.dataset.statsRange as StatsRange | undefined;
    const isSelected = range === statsRange;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function syncThemeControls(): void {
  settingsThemeSelect.value = currentTheme;
  settingsAudioToggle.checked = isAudioEnabled;
  settingsColorblindModeToggle.checked = isColorblindModeEnabled;
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

function setStatsRange(range: StatsRange): void {
  statsRange = range;
  persistUiState();
  syncStatsRangeControls();
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

  if (window.matchMedia("(orientation: landscape) and (max-height: 560px) and (max-width: 980px)").matches) {
    const landingStyle = window.getComputedStyle(landingRoot);
    const edgeBuffer = Number.parseFloat(landingStyle.paddingLeft || "0") || 0;
    const layoutGap = Number.parseFloat(landingStyle.columnGap || landingStyle.gap || "0") || 0;
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
  featureSectionTitle.textContent = inTraining ? "Training Tools" : "Display";
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
  syncStatsRangeControls();
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

function renderDevOutput(): void {
  const isVisible = effectiveDevModeVisible();
  landingRoot.classList.toggle("has-dev-panel", isVisible);
  devPanel.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    devOutputBox.value = "";
    return;
  }

  devOutputBox.value = buildDevOutput({
    optimizerOutput: latestOptimizerOutput,
    practiceAiDebug: isTrainingMode() ? lastPracticeAiDebug : null,
    practiceDifficulty: isTrainingMode() ? practiceDifficulty : null,
    previousRedScores,
    previousYellowScores,
    state: moveSequence,
    winner: winningPlayer !== null ? playerClass(winningPlayer) : null,
  });
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

  if (isWinLocked) {
    if (winningPlayer === RED) {
      turnIndicator.classList.add("is-red");
      turnIndicator.textContent = "Red wins";
      return;
    }

    if (winningPlayer === YELLOW) {
      turnIndicator.classList.add("is-yellow");
      turnIndicator.textContent = "Yellow wins";
      return;
    }

    turnIndicator.textContent = "";
    return;
  }

  if (!hasPlayableMove()) {
    turnIndicator.textContent = "Tie";
    return;
  }

  if (isTrainingMode()) {
    if (isHumanTurn()) {
      turnIndicator.textContent = "Your move";
      return;
    }

    if (isAiCalculating()) {
      turnIndicator.textContent = "Thinking...";
      return;
    }

    if (aiPlannedColumn !== null) {
      turnIndicator.textContent = `Playing Column ${aiPlannedColumn + 1}`;
      return;
    }

    turnIndicator.textContent = "";
    return;
  }

  if (currentPlayer === RED) {
    turnIndicator.classList.add("is-red");
    turnIndicator.textContent = "Red's turn";
    return;
  }

  turnIndicator.classList.add("is-yellow");
  turnIndicator.textContent = "Yellow's turn";
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

function removeCurrentPracticeRecordedStat(): void {
  if (currentPracticeRecordedStatId === null) {
    return;
  }

  practiceStats = removePracticeStatById(currentPracticeRecordedStatId);
  currentPracticeRecordedStatId = null;
  renderStatsTable();
}

function maybeRecordCompletedPracticeGame(): void {
  if (!isTrainingMode() || !isWinLocked || winningPlayer === null || currentPracticeRecordedStatId !== null) {
    return;
  }

  const humanPlayer = effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
    red: RED,
    yellow: YELLOW,
  });
  const result: PracticeGameResult = winningPlayer === humanPlayer ? "win" : "loss";
  const stat: PracticeGameStat = {
    completedAt: Date.now(),
    difficulty: practiceDifficulty,
    id: createPracticeStatId(),
    moveCount: historyIndex,
    result,
  };

  practiceStats = appendPracticeStat(stat);
  currentPracticeRecordedStatId = stat.id;
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
    return historyIndex > 0;
  }

  return freeplayUndoAvailable && historyIndex > 0;
}

function canRedo(): boolean {
  return isTrainingMode() && historyIndex < moveHistory.length;
}

function canReset(): boolean {
  return historyIndex > 0;
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

  const redShare = scoreBarRedShare(previousRedScores, previousYellowScores);
  scoreBar.style.setProperty("--score-red-share", String(redShare));
  scoreBarFill.style.width = `${redShare * 100}%`;
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

function rebuildBoardFromHistory(): void {
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
    playCompletionSound();
  }
  maybeRecordCompletedPracticeGame();
  syncMoveSequence();
  requestOptimizerOutput();
}

function commitMove(column: number, player: PlayerValue): void {
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

  const scores = currentPracticeAiScores();
  if (!scores) {
    return;
  }

  const aiChoice = choosePracticeAiColumn({
    difficulty: practiceDifficulty,
    isColumnPlayable: (column) => lowestOpenRow(board, column) !== null,
    scores,
  });
  if (aiChoice.column === null) {
    return;
  }

  const scheduledSequence = moveSequence;
  aiPlannedColumn = aiChoice.column;
  aiPlannedDebug = aiChoice.debug;
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
  latestOptimizerOutput = "status: Computing...";
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

    latestOptimizerOutput = "Optimizer worker failed.";
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

function resetBoard(options?: { advancePracticeRound?: boolean }): void {
  const { advancePracticeRound = true } = options ?? {};
  playSoundEffect("board-reset");
  animateResetPieces();
  if (advancePracticeRound && isTrainingMode() && practiceColor === "alternate") {
    practiceRoundIndex += 1;
  }
  currentPracticeRecordedStatId = null;
  moveHistory.length = 0;
  historyIndex = 0;
  freeplayUndoAvailable = false;
  rebuildBoardFromHistory();
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
    if (historyIndex === 0) {
      return;
    }

    playSoundEffect("undo");
    removeCurrentPracticeRecordedStat();
    historyIndex -= 1;
    rebuildBoardFromHistory();
    return;
  }

  if (!freeplayUndoAvailable || historyIndex === 0) {
    return;
  }

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

  if (!isHumanTurn()) {
    return;
  }

  if (isWinLocked) {
    triggerWinLockShake();
    return;
  }

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

  resetBoard();
});

titleControl.addEventListener("click", () => {
  if (!canReset()) {
    return;
  }

  resetBoard();
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

for (const button of statsRangeButtons) {
  button.addEventListener("click", () => {
    const range = button.dataset.statsRange as StatsRange | undefined;
    if (!range) {
      return;
    }

    setStatsRange(range);
  });
}

settingsThemeSelect.addEventListener("change", () => {
  const theme = settingsThemeSelect.value as ThemeName;
  if (!isThemeName(theme)) {
    return;
  }

  setTheme(theme);
  setToolsMenuExpanded(false);
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
    resetBoard();
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
  scheduleBoardFrameLayout();
});

window.visualViewport?.addEventListener("resize", () => {
  scheduleBoardFrameLayout();
});

window.addEventListener("popstate", () => {
  const pathMode = modeForPathname(window.location.pathname);
  if (!pathMode) {
    return;
  }

  setCurrentMode(pathMode, { history: "none" });
});

const persistedUiState = readPersistedUiState();
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
statsRange = persistedUiState.statsRange === "today" ? "today" : "all-time";
currentTheme = isThemeName(persistedUiState.theme ?? "") ? persistedUiState.theme : "light";
const persistedDifficulty = persistedUiState.practiceDifficulty;
if (typeof persistedDifficulty === "number" && Number.isFinite(persistedDifficulty)) {
  practiceDifficulty = Math.max(1, Math.min(10, Math.round(persistedDifficulty)));
}
ensureThemeFont(currentTheme);
applyTheme(currentTheme);
moggedBackground.setEnabled(currentTheme === "mogged");
syncDiscPatternMode();
syncThemeAudio(false);
settingsAudioToggle.checked = isAudioEnabled;
updateDocumentTitle();
syncModeUrl(currentMode, "replace");
syncModeControls();
setAboutTab(activeAboutTab);
renderStatsTable();
setToolsMenuExpanded(persistedUiState.toolsMenuExpanded ?? persistedUiState.menuExpanded ?? false);
syncFeatureControls();
syncMoveSequence();
requestOptimizerOutput();
maybeScheduleAiTurn();
window.connect4State = {
  getSequence: () => moveSequence,
  getOptimizerOutput: () => devOutputBox.value,
  getPreviousRedScores: () => [...previousRedScores],
  getPreviousYellowScores: () => [...previousYellowScores],
};
