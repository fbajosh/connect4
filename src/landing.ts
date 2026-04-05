const WIDTH = 7;
const HEIGHT = 6;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;

const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
const trainerGrid = document.getElementById("trainer-grid");
const discGrid = document.getElementById("disc-grid");
const effectsLayer = document.getElementById("effects-layer");
const previewPiece = document.getElementById("preview-piece");
const resetControl = document.getElementById("reset-control");
const devModeToggle = document.getElementById("dev-mode-toggle");
const devPanel = document.getElementById("dev-panel");
const gameStateBox = document.getElementById("game-state-box");
const optimizerOutputBox = document.getElementById("optimizer-output-box");

if (
  !boardShell ||
  !boardGrid ||
  !trainerGrid ||
  !discGrid ||
  !effectsLayer ||
  !previewPiece ||
  !resetControl ||
  !devModeToggle ||
  !devPanel ||
  !gameStateBox ||
  !optimizerOutputBox
) {
  throw new Error("Missing required board elements.");
}

const board = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => EMPTY));
const trainingModeEnabled = true;
const trainerSlots: HTMLDivElement[] = [];
const discSlots: HTMLDivElement[] = [];
const discElements = Array.from({ length: HEIGHT }, () =>
  Array.from({ length: WIDTH }, () => null as HTMLDivElement | null),
);

let activeColumn: number | null = null;
let activePointerId: number | null = null;
let currentPlayer = RED;
let isAnimating = false;
let isWinLocked = false;
let dropToken = 0;
let moveSequence = "";
let devModeEnabled = false;
let optimizerWorker: Worker | null = null;
let shakeResetTimeout = 0;

type Connect4DebugState = {
  getSequence: () => string;
  getOptimizerOutput: () => string;
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

function syncMoveSequence(): void {
  boardShell.dataset.sequence = moveSequence;
  gameStateBox.value = moveSequence;
}

function setOptimizerOutput(output: string): void {
  optimizerOutputBox.value = output;
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

  if (!trainingModeEnabled || isAnimating || isWinLocked) {
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

function requestOptimizerOutput(): void {
  if (!devModeEnabled && !trainingModeEnabled) {
    return;
  }

  stopOptimizerWorker();
  if (devModeEnabled) {
    setOptimizerOutput("Computing...");
  }

  const worker = new Worker(new URL("./optimizer-worker.ts", import.meta.url), { type: "module" });
  optimizerWorker = worker;

  worker.addEventListener("message", (event: MessageEvent<OptimizerWorkerResponse>) => {
    if (optimizerWorker !== worker) {
      return;
    }

    if (devModeEnabled) {
      setOptimizerOutput(event.data.output);
    }

    if (trainingModeEnabled) {
      if (isOptimizerSuccessPayload(event.data.payload)) {
        renderTrainingHints(event.data.payload.bestColumns);
      } else {
        clearTrainingHints();
      }
    }

    stopOptimizerWorker();
  });

  worker.addEventListener("error", () => {
    if (optimizerWorker !== worker) {
      return;
    }

    if (devModeEnabled) {
      setOptimizerOutput("Optimizer worker failed.");
    }

    clearTrainingHints();
    stopOptimizerWorker();
  });

  worker.postMessage({ sequence: moveSequence });
}

function setDevMode(enabled: boolean): void {
  devModeEnabled = enabled;
  devPanel.classList.toggle("hidden", !enabled);
  devModeToggle.setAttribute("aria-pressed", String(enabled));

  if (!enabled) {
    setOptimizerOutput("");
    if (!trainingModeEnabled) {
      stopOptimizerWorker();
    }
    return;
  }

  syncMoveSequence();
  requestOptimizerOutput();
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
  moveSequence = "";
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
  moveSequence += String(column + 1);
  syncMoveSequence();
  const slotIndex = slotIndexFor(row, column);
  const disc = document.createElement("div");
  disc.className = `disc piece ${playerClass(player)}`;
  discSlots[slotIndex].append(disc);
  discElements[row][column] = disc;
  isWinLocked = updateWinningHighlights();
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

devModeToggle.addEventListener("click", () => {
  setDevMode(!devModeEnabled);
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

syncMoveSequence();
requestOptimizerOutput();
window.connect4State = {
  getSequence: () => moveSequence,
  getOptimizerOutput: () => optimizerOutputBox.value,
};
