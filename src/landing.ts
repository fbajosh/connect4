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
  isThemeName,
  modeForPathname,
  pathForMode,
  readPersistedUiState,
  titleForMode,
  writePersistedUiState,
} from "./ui-persistence";
import { appendPracticeStat, buildPracticeStatsRows, createPracticeStatId, readStoredPracticeStats, removePracticeStatById, type PracticeGameResult, type PracticeGameStat } from "./stats";
import { applyTheme } from "./theme";
const FIXED_BOARD_FRAME_ROWS = 7.46;
const FIXED_BOARD_SHELL_BOTTOM_ROWS = 0.3;
const FIXED_SCORE_BAR_BOTTOM_ROWS = 0;
const FIXED_SCORE_BAR_HEIGHT_ROWS = 0.1;
const FIXED_COLUMN_SCORE_TOP_ROWS = 0.74;
const FIXED_COLUMN_SCORE_HEIGHT_ROWS = 0.22;
const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
const trainerGrid = document.getElementById("trainer-grid");
const discGrid = document.getElementById("disc-grid");
const effectsLayer = document.getElementById("effects-layer");
const landingRoot = document.querySelector<HTMLElement>(".landing");
const hero = document.querySelector<HTMLElement>(".hero");
const menuBar = document.querySelector<HTMLElement>(".menu-bar");
const boardStage = document.querySelector<HTMLElement>(".board-stage");
const boardActions = document.querySelector<HTMLElement>(".board-actions");
const boardFrame = boardShell?.parentElement;
const scoreBar = document.getElementById("score-bar");
const scoreBarFill = document.getElementById("score-bar-fill");
const columnScoreRow = document.getElementById("column-score-row");
const previewPiece = document.getElementById("preview-piece");
const historyControls = document.getElementById("history-controls");
const aboutControl = document.getElementById("about-control");
const aboutModal = document.getElementById("about-modal");
const aboutBackdrop = document.getElementById("about-backdrop");
const aboutDialog = document.getElementById("about-dialog");
const aboutClose = document.getElementById("about-close");
const undoControl = document.getElementById("undo-control");
const redoControl = document.getElementById("redo-control");
const resetControl = document.getElementById("reset-control");
const modeMenuToggle = document.getElementById("mode-menu-toggle");
const modeMenu = document.getElementById("mode-menu");
const toolsMenuToggle = document.getElementById("tools-menu-toggle");
const toolsMenu = document.getElementById("tools-menu");
const featureControls = document.getElementById("feature-controls");
const practiceControls = document.getElementById("practice-controls");
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
const settingsDevModeToggle = document.getElementById("settings-dev-mode-toggle");
const statsTableBody = document.getElementById("stats-table-body");

if (
  !landingRoot ||
  !hero ||
  !boardStage ||
  !boardActions ||
  !boardFrame ||
  !boardShell ||
  !boardGrid ||
  !trainerGrid ||
  !discGrid ||
  !effectsLayer ||
  !menuBar ||
  !scoreBar ||
  !scoreBarFill ||
  !columnScoreRow ||
  !previewPiece ||
  !historyControls ||
  !aboutControl ||
  !aboutModal ||
  !aboutBackdrop ||
  !aboutDialog ||
  !aboutClose ||
  !undoControl ||
  !redoControl ||
  !resetControl ||
  !modeMenuToggle ||
  !modeMenu ||
  !toolsMenuToggle ||
  !toolsMenu ||
  !featureControls ||
  !practiceControls ||
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
  !settingsDevModeToggle ||
  !statsTableBody
) {
  throw new Error("Missing required board elements.");
}

const board: BoardState = createBoard();
const trainerSlots: HTMLDivElement[] = [];
const discSlots: HTMLDivElement[] = [];
const columnScoreSlots: HTMLSpanElement[] = [];
const practiceColorButtons = Array.from(
  practiceControls.querySelectorAll<HTMLButtonElement>("[data-practice-color]"),
);
const aboutTabButtons = Array.from(aboutModal.querySelectorAll<HTMLButtonElement>("[data-about-tab]"));
const aboutPanels = Array.from(aboutModal.querySelectorAll<HTMLElement>("[data-about-panel]"));
const statsRangeButtons = Array.from(aboutModal.querySelectorAll<HTMLButtonElement>("[data-stats-range]"));
const themeOptionButtons = Array.from(aboutModal.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
const discElements = Array.from({ length: HEIGHT }, () =>
  Array.from({ length: WIDTH }, () => null as HTMLDivElement | null),
);

const modeOptionButtons = Array.from(
  modeMenu.querySelectorAll<HTMLButtonElement>("[data-mode-option]"),
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
let shakeResetTimeout = 0;
let isAboutModalOpen = false;
let activeAboutTab: AboutTab = "about";
let latestOptimizerOutput = "";
let latestOptimizerPayload: OptimizerSuccessPayload | null = null;
let currentMode: GameMode = "training";
let isModeMenuExpanded = false;
let isToolsMenuExpanded = false;
let isDevModeEnabled = false;
let practiceColor: PracticeColor = "red";
let practiceDifficulty = 10;
let currentTheme: ThemeName = "light";
let statsRange: StatsRange = "all-time";
let practiceRoundIndex = 0;
let aiMoveTimeout = 0;
let aiScheduledSequence: string | null = null;
let lastPracticeAiDebug: PracticeAiDebug | null = null;
let historyIndex = 0;
let freeplayUndoAvailable = false;
let currentPracticeRecordedStatId: string | null = null;
const previousRedScores: Array<number | null> = [];
const previousYellowScores: Array<number | null> = [];
const moveHistory: MoveRecord[] = [];
let practiceStats: PracticeGameStat[] = readStoredPracticeStats();
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

type AboutTab = "about" | "howto" | "stats" | "settings" | "credits";

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
    devMode: isDevModeEnabled,
    modeMenuExpanded: isModeMenuExpanded,
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

function formatStatsNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWinRate(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
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
  for (const button of themeOptionButtons) {
    const theme = button.dataset.themeOption as ThemeName | undefined;
    const isSelected = theme === currentTheme;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function setAboutTab(tab: AboutTab): void {
  activeAboutTab = tab;
  syncAboutTabs();
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

function setTheme(theme: ThemeName): void {
  currentTheme = theme;
  applyTheme(theme);
  syncThemeControls();
  persistUiState();
}

function scheduleBoardFrameLayout(): void {
  if (boardFrameLayoutRaf !== 0) {
    return;
  }

  boardFrameLayoutRaf = window.requestAnimationFrame(() => {
    boardFrameLayoutRaf = 0;
    layoutBoardFrame();
  });
}

function layoutBoardFrame(): void {
  boardFrame.style.transform = "";
  boardActions.style.width = "";
  syncAboutDialogPosition();

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

function isPracticeMode(): boolean {
  return currentMode === "practice";
}

function isHumanTurn(): boolean {
  return (
    !isPracticeMode() ||
    currentPlayer ===
      effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
        red: RED,
        yellow: YELLOW,
      })
  );
}

function updatePracticeControls(): void {
  practiceControls.classList.toggle("hidden", !isPracticeMode());
  freeplayControls.classList.toggle("hidden", currentMode !== "freeplay");
  featureControls.classList.toggle("hidden", !isTrainingMode());

  for (const button of practiceColorButtons) {
    const color = button.dataset.practiceColor as PracticeColor | undefined;
    const isSelected = color === practiceColor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  practiceDifficultySlider.value = String(practiceDifficulty);
  practiceDifficultyValue.textContent = String(practiceDifficulty);
  freeplayGameScoreToggle.checked = featurePinned.gameScore;
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

function syncModeMenu(): void {
  for (const option of modeOptionButtons) {
    const optionMode = option.dataset.modeOption as GameMode | undefined;
    const isSelected = optionMode === currentMode;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-pressed", String(isSelected));
  }
  updatePracticeControls();
}

function setModeMenuExpanded(expanded: boolean): void {
  isModeMenuExpanded = expanded;
  if (expanded) {
    isToolsMenuExpanded = false;
  }

  modeMenuToggle.setAttribute("aria-expanded", String(isModeMenuExpanded));
  modeMenu.classList.toggle("hidden", !isModeMenuExpanded);
  toolsMenuToggle.setAttribute("aria-expanded", String(isToolsMenuExpanded));
  toolsMenu.classList.toggle("hidden", !isToolsMenuExpanded);
  persistUiState();
}

function setToolsMenuExpanded(expanded: boolean): void {
  isToolsMenuExpanded = expanded;
  if (expanded) {
    isModeMenuExpanded = false;
  }

  toolsMenuToggle.setAttribute("aria-expanded", String(isToolsMenuExpanded));
  toolsMenu.classList.toggle("hidden", !isToolsMenuExpanded);
  modeMenuToggle.setAttribute("aria-expanded", String(isModeMenuExpanded));
  modeMenu.classList.toggle("hidden", !isModeMenuExpanded);
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
  syncModeMenu();
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
    practiceAiDebug: isPracticeMode() ? lastPracticeAiDebug : null,
    practiceDifficulty: isPracticeMode() ? practiceDifficulty : null,
    previousRedScores,
    previousYellowScores,
    state: moveSequence,
    winner: winningPlayer !== null ? playerClass(winningPlayer) : null,
  });
}

function syncFeatureUI(): void {
  applyBoardFrameLayout();
  updateScoreBar();
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
  if (!isPracticeMode() || !isWinLocked || winningPlayer === null || currentPracticeRecordedStatId !== null) {
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

function lastAppliedPracticeHumanMoveIndex(): number {
  const humanPlayer = effectivePracticeHumanPlayer(practiceColor, practiceRoundIndex, {
    red: RED,
    yellow: YELLOW,
  });

  for (let index = historyIndex - 1; index >= 0; index -= 1) {
    if (moveHistory[index]?.player === humanPlayer) {
      return index;
    }
  }

  return -1;
}

function canUndo(): boolean {
  if (isTrainingMode()) {
    return historyIndex > 0;
  }

  if (isPracticeMode()) {
    return lastAppliedPracticeHumanMoveIndex() !== -1;
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
  maybeRecordCompletedPracticeGame();
  syncMoveSequence();
  requestOptimizerOutput();
}

function commitMove(column: number, player: PlayerValue): void {
  const record: MoveRecord = {
    aiDebug:
      isPracticeMode() &&
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
}

function currentPracticeAiScores(): number[] | null {
  if (!isPracticeMode() || isWinLocked) {
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

  if (!isPracticeMode() || isAnimating || isWinLocked || isHumanTurn()) {
    return;
  }

  const scores = currentPracticeAiScores();
  if (!scores) {
    return;
  }

  const scheduledSequence = moveSequence;
  aiScheduledSequence = scheduledSequence;
  aiMoveTimeout = window.setTimeout(() => {
    aiMoveTimeout = 0;
    aiScheduledSequence = null;

    if (
      !isPracticeMode() ||
      isAnimating ||
      isWinLocked ||
      isHumanTurn() ||
      moveSequence !== scheduledSequence
    ) {
      return;
    }

    const liveScores = currentPracticeAiScores();
    if (!liveScores) {
      return;
    }

    const aiChoice = choosePracticeAiColumn({
      difficulty: practiceDifficulty,
      isColumnPlayable: (column) => lowestOpenRow(board, column) !== null,
      scores: liveScores,
    });
    lastPracticeAiDebug = aiChoice.debug;
    const chosenColumn = aiChoice.column;
    if (chosenColumn === null) {
      return;
    }

    updatePreview(chosenColumn);
    requestAnimationFrame(() => {
      if (
        !isPracticeMode() ||
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
  requestAnimationFrame(() => {
    if (!canStartHumanMove() || lowestOpenRow(board, column) === null) {
      hidePreview();
      return;
    }

    dropPreview(column);
  });
}

function animateResetPiece(source: HTMLElement): void {
  const rect = source.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }

  const clone = source.cloneNode(false) as HTMLDivElement;
  clone.classList.remove("disc", "preview-piece", "hidden", "dropping");
  clone.classList.add("reset-piece");
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.setProperty("--reset-drop", `${window.innerHeight - rect.top + rect.height}px`);
  effectsLayer.append(clone);

  requestAnimationFrame(() => {
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
  animateResetPieces();
  if (advancePracticeRound && isPracticeMode() && practiceColor === "alternate") {
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
  requestAnimationFrame(() => {
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

    historyIndex -= 1;
    rebuildBoardFromHistory();
    return;
  }

  if (isPracticeMode()) {
    const lastHumanMoveIndex = lastAppliedPracticeHumanMoveIndex();
    if (lastHumanMoveIndex === -1) {
      return;
    }

    removeCurrentPracticeRecordedStat();
    historyIndex = lastHumanMoveIndex;
    rebuildBoardFromHistory();
    return;
  }

  if (!freeplayUndoAvailable || historyIndex === 0) {
    return;
  }

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

aboutControl.addEventListener("click", () => {
  setAboutModalOpen(true);
  aboutClose.focus();
});

aboutClose.addEventListener("click", () => {
  setAboutModalOpen(false);
  aboutControl.focus();
});

aboutBackdrop.addEventListener("click", () => {
  setAboutModalOpen(false);
  aboutControl.focus();
});

undoControl.addEventListener("click", () => {
  performUndo();
});

redoControl.addEventListener("click", () => {
  performRedo();
});

modeMenuToggle.addEventListener("click", () => {
  setModeMenuExpanded(!isModeMenuExpanded);
});

toolsMenuToggle.addEventListener("click", () => {
  setToolsMenuExpanded(!isToolsMenuExpanded);
});

for (const option of modeOptionButtons) {
  option.addEventListener("click", () => {
    const selectedMode = option.dataset.modeOption as GameMode | undefined;
    if (!selectedMode) {
      return;
    }

    setCurrentMode(selectedMode);
    setModeMenuExpanded(false);
  });
}

for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
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

for (const button of themeOptionButtons) {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeOption as ThemeName | undefined;
    if (!theme) {
      return;
    }

    setTheme(theme);
  });
}

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && isAboutModalOpen) {
    setAboutModalOpen(false);
    aboutControl.focus();
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
for (const feature of Object.keys(featureToggleInputs) as FeatureKey[]) {
  const pinned = persistedUiState.pinned?.[feature];
  featurePinned[feature] = pinned === true;
  featureToggleInputs[feature].checked = featurePinned[feature];
}

currentMode = modeForPathname(window.location.pathname) ?? persistedUiState.selectedMode ?? "training";
isDevModeEnabled = persistedUiState.devMode === true;
practiceColor = persistedUiState.practiceColor ?? "red";
statsRange = persistedUiState.statsRange === "today" ? "today" : "all-time";
currentTheme = isThemeName(persistedUiState.theme ?? "") ? persistedUiState.theme : "light";
const persistedDifficulty = persistedUiState.practiceDifficulty;
if (typeof persistedDifficulty === "number" && Number.isFinite(persistedDifficulty)) {
  practiceDifficulty = Math.max(1, Math.min(10, Math.round(persistedDifficulty)));
}
applyTheme(currentTheme);
updateDocumentTitle();
syncModeUrl(currentMode, "replace");
syncModeMenu();
setAboutTab(activeAboutTab);
renderStatsTable();
setModeMenuExpanded(persistedUiState.modeMenuExpanded === true);
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
