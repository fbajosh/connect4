const WIDTH = 7;
const HEIGHT = 6;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;

const boardShell = document.getElementById("board-shell");
const boardGrid = document.getElementById("board-grid");
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
const discSlots: HTMLDivElement[] = [];

let activeColumn: number | null = null;
let activePointerId: number | null = null;
let currentPlayer = RED;
let isAnimating = false;
let dropToken = 0;
let moveSequence = "";
let devModeEnabled = false;
let optimizerWorker: Worker | null = null;

type Connect4DebugState = {
  getSequence: () => string;
  getOptimizerOutput: () => string;
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

function stopOptimizerWorker(): void {
  optimizerWorker?.terminate();
  optimizerWorker = null;
}

function requestOptimizerOutput(): void {
  if (!devModeEnabled) {
    return;
  }

  stopOptimizerWorker();
  setOptimizerOutput("Computing...");

  const worker = new Worker(new URL("./optimizer-worker.ts", import.meta.url), { type: "module" });
  optimizerWorker = worker;

  worker.addEventListener("message", (event: MessageEvent<{ output: string }>) => {
    if (optimizerWorker !== worker) {
      return;
    }

    setOptimizerOutput(event.data.output);
    stopOptimizerWorker();
  });

  worker.addEventListener("error", () => {
    if (optimizerWorker !== worker) {
      return;
    }

    setOptimizerOutput("Optimizer worker failed.");
    stopOptimizerWorker();
  });

  worker.postMessage({ sequence: moveSequence });
}

function setDevMode(enabled: boolean): void {
  devModeEnabled = enabled;
  devPanel.classList.toggle("hidden", !enabled);
  devModeToggle.setAttribute("aria-pressed", String(enabled));

  if (!enabled) {
    stopOptimizerWorker();
    setOptimizerOutput("");
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

function updatePreview(column: number): void {
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

  if (activePointerId !== null && boardGrid.hasPointerCapture(activePointerId)) {
    boardGrid.releasePointerCapture(activePointerId);
  }

  activePointerId = null;
  currentPlayer = RED;
  moveSequence = "";
  syncMoveSequence();
  hidePreview();

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      board[row][column] = EMPTY;
    }
  }

  for (const slot of discSlots) {
    slot.replaceChildren();
  }

  requestOptimizerOutput();
}

function placeDisc(row: number, column: number, player: number): void {
  board[row][column] = player;
  moveSequence += String(column + 1);
  syncMoveSequence();
  const slotIndex = (HEIGHT - 1 - row) * WIDTH + column;
  const disc = document.createElement("div");
  disc.className = `disc piece ${playerClass(player)}`;
  discSlots[slotIndex].append(disc);
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
  const slot = document.createElement("div");
  slot.className = "disc-slot";
  discSlots.push(slot);
  discGrid.append(slot);

  const cell = document.createElement("div");
  cell.className = "board-cell";
  boardGrid.append(cell);
}

syncMoveSequence();
window.connect4State = {
  getSequence: () => moveSequence,
  getOptimizerOutput: () => optimizerOutputBox.value,
};
