const WIDTH = 7;
const HEIGHT = 6;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;
const EMPTY_BOARD_SCORES = [-2, -1, 0, 1, 0, -1, -2];
const FIXED_BOARD_FRAME_ROWS = 7.46;
const FIXED_BOARD_SHELL_BOTTOM_ROWS = 0.3;
const FIXED_SCORE_BAR_BOTTOM_ROWS = 0;
const FIXED_SCORE_BAR_HEIGHT_ROWS = 0.1;
const FIXED_COLUMN_SCORE_TOP_ROWS = 0.74;
const FIXED_COLUMN_SCORE_HEIGHT_ROWS = 0.22;
const UI_STATE_STORAGE_KEY = "connect4-trainer-ui-state";

const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
const trainerGrid = document.getElementById("trainer-grid");
const discGrid = document.getElementById("disc-grid");
const effectsLayer = document.getElementById("effects-layer");
const boardFrame = boardShell?.parentElement;
const scoreBar = document.getElementById("score-bar");
const scoreBarFill = document.getElementById("score-bar-fill");
const columnScoreRow = document.getElementById("column-score-row");
const previewPiece = document.getElementById("preview-piece");
const resetControl = document.getElementById("reset-control");
const trainingToolsToggle = document.getElementById("training-tools-toggle");
const featureControls = document.getElementById("feature-controls");
const bestMovePulse = document.getElementById("best-move-pulse");
const bestMoveToggle = document.getElementById("best-move-toggle");
const moveScoresPulse = document.getElementById("move-scores-pulse");
const moveScoresToggle = document.getElementById("move-scores-toggle");
const gameScorePulse = document.getElementById("game-score-pulse");
const gameScoreToggle = document.getElementById("game-score-toggle");
const devModePulse = document.getElementById("dev-mode-pulse");
const devModeToggle = document.getElementById("dev-mode-toggle");
const devPanel = document.getElementById("dev-panel");
const devOutputBox = document.getElementById("dev-output-box");

if (
  !boardFrame ||
  !boardShell ||
  !boardGrid ||
  !trainerGrid ||
  !discGrid ||
  !effectsLayer ||
  !scoreBar ||
  !scoreBarFill ||
  !columnScoreRow ||
  !previewPiece ||
  !resetControl ||
  !trainingToolsToggle ||
  !featureControls ||
  !bestMovePulse ||
  !bestMoveToggle ||
  !moveScoresPulse ||
  !moveScoresToggle ||
  !gameScorePulse ||
  !gameScoreToggle ||
  !devModePulse ||
  !devModeToggle ||
  !devPanel ||
  !devOutputBox
) {
  throw new Error("Missing required board elements.");
}

const board = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => EMPTY));
const trainerSlots: HTMLDivElement[] = [];
const discSlots: HTMLDivElement[] = [];
const columnScoreSlots: HTMLSpanElement[] = [];
const discElements = Array.from({ length: HEIGHT }, () =>
  Array.from({ length: WIDTH }, () => null as HTMLDivElement | null),
);

type FeatureKey = "bestMove" | "moveScores" | "gameScore" | "devMode";

type PersistedUiState = {
  menuExpanded?: boolean;
  pinned?: Partial<Record<FeatureKey, boolean>>;
};

const featurePulseButtons: Record<FeatureKey, HTMLButtonElement> = {
  bestMove: bestMovePulse as HTMLButtonElement,
  moveScores: moveScoresPulse as HTMLButtonElement,
  gameScore: gameScorePulse as HTMLButtonElement,
  devMode: devModePulse as HTMLButtonElement,
};

const featureToggleInputs: Record<FeatureKey, HTMLInputElement> = {
  bestMove: bestMoveToggle as HTMLInputElement,
  moveScores: moveScoresToggle as HTMLInputElement,
  gameScore: gameScoreToggle as HTMLInputElement,
  devMode: devModeToggle as HTMLInputElement,
};

let activeColumn: number | null = null;
let activePointerId: number | null = null;
let currentPlayer = RED;
let isAnimating = false;
let isWinLocked = false;
let winningPlayer: number | null = null;
let dropToken = 0;
let moveSequence = "";
let optimizerWorker: Worker | null = null;
let shakeResetTimeout = 0;
let latestOptimizerOutput = "";
let latestOptimizerPayload: OptimizerSuccessPayload | null = null;
let isTrainingToolsMenuExpanded = false;
const previousRedScores: Array<number | null> = [];
const previousYellowScores: Array<number | null> = [];
const featurePinned: Record<FeatureKey, boolean> = {
  bestMove: false,
  moveScores: false,
  gameScore: false,
  devMode: false,
};
const featureHeld: Record<FeatureKey, boolean> = {
  bestMove: false,
  moveScores: false,
  gameScore: false,
  devMode: false,
};

type Connect4DebugState = {
  getSequence: () => string;
  getOptimizerOutput: () => string;
  getPreviousRedScores: () => Array<number | null>;
  getPreviousYellowScores: () => Array<number | null>;
};

type OptimizerSuccessPayload = {
  bestColumns: number[];
  bestMoves: string;
  elapsedMs?: number;
  nodeCount?: number;
  positionScore: number;
  scores: number[];
  sequence: string;
  source?: "local-cache" | "wasm";
};

type OptimizerErrorPayload = {
  error: string;
  invalidAtMove?: number;
  sequence: string;
};

type OptimizerWorkerResponse = {
  output: string;
  payload: OptimizerSuccessPayload | OptimizerErrorPayload;
};

declare global {
  interface Window {
    connect4State?: Connect4DebugState;
  }
}

function readPersistedUiState(): PersistedUiState {
  try {
    const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PersistedUiState;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function persistUiState(): void {
  try {
    const state: PersistedUiState = {
      menuExpanded: isTrainingToolsMenuExpanded,
      pinned: {
        bestMove: featurePinned.bestMove,
        moveScores: featurePinned.moveScores,
        gameScore: featurePinned.gameScore,
        devMode: featurePinned.devMode,
      },
    };
    window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures; the UI still works without persistence.
  }
}

function syncMoveSequence(): void {
  boardShell.dataset.sequence = moveSequence;
  syncFeatureUI();
}

function isFeatureVisible(feature: FeatureKey): boolean {
  return featurePinned[feature] || featureHeld[feature];
}

function effectiveBestMoveVisible(): boolean {
  return isFeatureVisible("bestMove");
}

function effectiveMoveScoresVisible(): boolean {
  return isFeatureVisible("moveScores");
}

function effectiveGameScoreVisible(): boolean {
  return isFeatureVisible("gameScore");
}

function effectiveDevModeVisible(): boolean {
  return isFeatureVisible("devMode");
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

function setTrainingToolsMenuExpanded(expanded: boolean): void {
  isTrainingToolsMenuExpanded = expanded;
  trainingToolsToggle.setAttribute("aria-expanded", String(expanded));
  featureControls.classList.toggle("hidden", !expanded);
  persistUiState();
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
  devPanel.classList.toggle("hidden", !effectiveDevModeVisible());
  if (!effectiveDevModeVisible()) {
    devOutputBox.value = "";
    return;
  }

  const lines = [`state: ${moveSequence}`];
  if (winningPlayer !== null) {
    lines.push(`winner: ${playerClass(winningPlayer)}`);
  } else if (latestOptimizerOutput.length > 0) {
    lines.push(latestOptimizerOutput);
  }
  lines.push(`total-red: ${formatAverageScore(previousRedScores)}`);
  lines.push(`total-yellow: ${formatAverageScore(previousYellowScores)}`);
  lines.push(`previous-red: ${formatScoreHistory(previousRedScores)}`);
  lines.push(`previous-yellow: ${formatScoreHistory(previousYellowScores)}`);

  devOutputBox.value = lines.join("\n");
}

function syncFeatureUI(): void {
  applyBoardFrameLayout();
  updateScoreBar();
  renderColumnScores();
  renderCurrentTrainingHints();
  renderDevOutput();
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

function formatScoreHistory(scores: Array<number | null>): string {
  return scores.map((score) => (score === null ? "?" : String(score))).join(", ");
}

function averageScore(scores: Array<number | null>): number {
  const validScores = scores.filter((score): score is number => typeof score === "number");
  if (validScores.length === 0) {
    return 0;
  }

  return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
}

function formatAverageScore(scores: Array<number | null>): string {
  const average = averageScore(scores);
  return Number.isInteger(average) ? String(average) : average.toFixed(2);
}

function scoreBarRedShare(): number {
  const totalRed = averageScore(previousRedScores);
  const totalYellow = averageScore(previousYellowScores);
  const denominator = 2 * (Math.abs(totalRed) + Math.abs(totalYellow));

  if (denominator === 0) {
    return 0.5;
  }

  const numerator =
    Math.abs(totalRed) + totalRed + Math.abs(totalYellow) - totalYellow;

  return Math.max(0, Math.min(1, numerator / denominator));
}

function updateScoreBar(): void {
  scoreBar.classList.toggle("hidden", !effectiveGameScoreVisible());
  if (!effectiveGameScoreVisible()) {
    return;
  }

  const redShare = scoreBarRedShare();
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
  for (let column = 0; column < WIDTH; column += 1) {
    const slot = columnScoreSlots[column];
    const score = scores?.[column];
    slot.textContent = score === undefined || score === -1000 ? "" : String(score);
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

function slotIndexFor(row: number, column: number): number {
  return (HEIGHT - 1 - row) * WIDTH + column;
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

    const row = lowestOpenRow(column);
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

function requestOptimizerOutput(): void {
  if (isWinLocked && winningPlayer !== null) {
    stopOptimizerWorker();
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
    stopOptimizerWorker();
  });

  worker.addEventListener("error", () => {
    if (optimizerWorker !== worker) {
      return;
    }

    latestOptimizerOutput = "Optimizer worker failed.";
    latestOptimizerPayload = null;
    syncFeatureUI();
    stopOptimizerWorker();
  });

  worker.postMessage({ sequence: moveSequence });
}

function playerClass(player: number): string {
  return player === RED ? "red" : "yellow";
}

function clampColumn(column: number): number {
  return Math.max(0, Math.min(WIDTH - 1, column));
}

function columnFromPointer(clientX: number): number {
  const rect = boardShell.getBoundingClientRect();
  const cellSize = rect.width / WIDTH;
  return clampColumn(Math.floor((clientX - rect.left) / cellSize));
}

function lowestOpenRow(column: number): number | null {
  for (let row = 0; row < HEIGHT; row += 1) {
    if (board[row][column] === EMPTY) {
      return row;
    }
  }

  return null;
}

function isInBounds(row: number, column: number): boolean {
  return row >= 0 && row < HEIGHT && column >= 0 && column < WIDTH;
}

function updateWinningHighlights(): boolean {
  const highlighted = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => false));
  const directions: Array<[columnStep: number, rowStep: number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let hasWinningRun = false;

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      const player = board[row][column];
      if (player === EMPTY) {
        continue;
      }

      for (const [columnStep, rowStep] of directions) {
        const previousRow = row - rowStep;
        const previousColumn = column - columnStep;
        if (isInBounds(previousRow, previousColumn) && board[previousRow][previousColumn] === player) {
          continue;
        }

        const run: Array<[row: number, column: number]> = [];
        let scanRow = row;
        let scanColumn = column;

        while (isInBounds(scanRow, scanColumn) && board[scanRow][scanColumn] === player) {
          run.push([scanRow, scanColumn]);
          scanRow += rowStep;
          scanColumn += columnStep;
        }

        if (run.length < 4) {
          continue;
        }

        hasWinningRun = true;
        for (const [runRow, runColumn] of run) {
          highlighted[runRow][runColumn] = true;
        }
      }
    }
  }

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      discElements[row][column]?.classList.toggle("is-winning", highlighted[row][column]);
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

  if (lowestOpenRow(column) === null) {
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

function resetBoard(): void {
  animateResetPieces();
  dropToken += 1;
  isAnimating = false;
  window.clearTimeout(shakeResetTimeout);
  boardShell.classList.remove("is-locked-shaking");

  if (activePointerId !== null && boardGrid.hasPointerCapture(activePointerId)) {
    boardGrid.releasePointerCapture(activePointerId);
  }

  activePointerId = null;
  currentPlayer = RED;
  isWinLocked = false;
  winningPlayer = null;
  moveSequence = "";
  latestOptimizerOutput = "";
  latestOptimizerPayload = null;
  previousRedScores.length = 0;
  previousYellowScores.length = 0;
  syncMoveSequence();
  hidePreview();
  clearTrainingHints();

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      board[row][column] = EMPTY;
      discElements[row][column] = null;
    }
  }

  for (const slot of discSlots) {
    slot.replaceChildren();
  }

  updateWinningHighlights();
  requestOptimizerOutput();
}

function placeDisc(row: number, column: number, player: number): void {
  board[row][column] = player;
  const previousScore = scoreForSelectedColumn(column);
  if (player === RED) {
    previousRedScores.push(previousScore);
  } else {
    previousYellowScores.push(previousScore);
  }
  moveSequence += String(column + 1);
  syncMoveSequence();
  const slotIndex = slotIndexFor(row, column);
  const disc = document.createElement("div");
  disc.className = `disc piece ${playerClass(player)}`;
  discSlots[slotIndex].append(disc);
  discElements[row][column] = disc;
  isWinLocked = updateWinningHighlights();
  winningPlayer = isWinLocked ? player : null;
  requestOptimizerOutput();
}

function nextPlayer(player: number): number {
  return player === RED ? YELLOW : RED;
}

function targetTopForRow(row: number): string {
  return `calc(${HEIGHT - 1 - row} * var(--cell-size) + (var(--cell-size) - var(--piece-size)) / 2)`;
}

function dropPreview(column: number): void {
  const row = lowestOpenRow(column);
  if (row === null) {
    hidePreview();
    return;
  }

  const player = currentPlayer;
  const currentDropToken = ++dropToken;
  isAnimating = true;
  clearTrainingHints();
  previewPiece.classList.add("dropping");
  previewPiece.style.top = targetTopForRow(row);

  const onTransitionEnd = (event: Event) => {
    const transitionEvent = event as TransitionEvent;
    if (transitionEvent.propertyName !== "top") {
      return;
    }

    previewPiece.removeEventListener("transitionend", onTransitionEnd);
    if (currentDropToken !== dropToken) {
      return;
    }
    placeDisc(row, column, player);
    currentPlayer = nextPlayer(player);
    isAnimating = false;
    hidePreview();
  };

  previewPiece.addEventListener("transitionend", onTransitionEnd);
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
  resetBoard();
});

trainingToolsToggle.addEventListener("click", () => {
  setTrainingToolsMenuExpanded(!isTrainingToolsMenuExpanded);
});

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

const persistedUiState = readPersistedUiState();
for (const feature of Object.keys(featureToggleInputs) as FeatureKey[]) {
  const pinned = persistedUiState.pinned?.[feature];
  featurePinned[feature] = pinned === true;
  featureToggleInputs[feature].checked = featurePinned[feature];
}

setTrainingToolsMenuExpanded(persistedUiState.menuExpanded === true);
syncFeatureControls();
syncMoveSequence();
requestOptimizerOutput();
window.connect4State = {
  getSequence: () => moveSequence,
  getOptimizerOutput: () => devOutputBox.value,
  getPreviousRedScores: () => [...previousRedScores],
  getPreviousYellowScores: () => [...previousYellowScores],
};
