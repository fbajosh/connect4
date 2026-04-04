import { HEIGHT, INVALID_MOVE, WIDTH } from "./connect4/constants";
import { parseSequence, type ParsedGame, type Player } from "./game-state";
import type { AnalyzeRequest, ClearCacheRequest, WorkerResponse } from "./worker-protocol";

type AnalysisSnapshot = {
  bestColumns: number[];
  elapsedMs: number;
  nodeCount: number;
  positionScore: number;
  scores: number[];
  sequence: string;
  weak: boolean;
};

type FeedbackKind = "error" | "info";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

function playerName(player: Player): string {
  return player === 1 ? "Red" : "Yellow";
}

function formatCompactScore(score: number): string {
  if (score === INVALID_MOVE) {
    return "Full";
  }
  if (score > 0) {
    return `W${score}`;
  }
  if (score < 0) {
    return `L${Math.abs(score)}`;
  }
  return "D";
}

function formatScoreSummary(score: number): string {
  if (score > 0) {
    return `Winning in ${score} move${score === 1 ? "" : "s"} with perfect play.`;
  }
  if (score < 0) {
    const distance = Math.abs(score);
    return `Losing in ${distance} move${distance === 1 ? "" : "s"} with perfect play.`;
  }
  return "Perfect play leads to a draw.";
}

function formatElapsed(ms: number): string {
  if (ms < 10) {
    return `${ms.toFixed(2)} ms`;
  }
  if (ms < 100) {
    return `${ms.toFixed(1)} ms`;
  }
  return `${Math.round(ms)} ms`;
}

function pickPreferredColumn(columns: number[]): number | null {
  if (columns.length === 0) {
    return null;
  }

  return [...columns].sort((left, right) => {
    const centerDistance = Math.abs(left - 3) - Math.abs(right - 3);
    return centerDistance !== 0 ? centerDistance : left - right;
  })[0];
}

function parseCurrentGame(sequence: string): ParsedGame {
  const parsed = parseSequence(sequence);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.game;
}

const boardElement = getElement<HTMLDivElement>("board");
const sequenceInput = getElement<HTMLInputElement>("sequence-input");
const turnLabel = getElement<HTMLParagraphElement>("turn-label");
const statusLabel = getElement<HTMLParagraphElement>("status-label");
const analysisLabel = getElement<HTMLParagraphElement>("analysis-label");
const analysisList = getElement<HTMLUListElement>("analysis-list");
const loadButton = getElement<HTMLButtonElement>("load-sequence");
const undoButton = getElement<HTMLButtonElement>("undo-move");
const resetButton = getElement<HTMLButtonElement>("reset-game");
const analyzeButton = getElement<HTMLButtonElement>("analyze-position");
const bestMoveButton = getElement<HTMLButtonElement>("play-best-move");
const clearCacheButton = getElement<HTMLButtonElement>("clear-cache");
const weakModeInput = getElement<HTMLInputElement>("weak-mode");

const worker = new Worker(new URL("./solver-worker.ts", import.meta.url), { type: "module" });

let sequence = "";
let latestAnalysis: AnalysisSnapshot | null = null;
let latestRequestId = 0;
let latestRequest: { autoPlay: boolean; requestId: number; sequence: string; weak: boolean } | null = null;
let isBusy = false;
let feedbackText = "";
let feedbackKind: FeedbackKind = "info";

function currentWeakMode(): boolean {
  return weakModeInput.checked;
}

function currentAnalysis(): AnalysisSnapshot | null {
  if (!latestAnalysis) {
    return null;
  }
  return latestAnalysis.sequence === sequence && latestAnalysis.weak === currentWeakMode() ? latestAnalysis : null;
}

function setFeedback(message: string, kind: FeedbackKind = "info"): void {
  feedbackText = message;
  feedbackKind = kind;
}

function setSequence(nextSequence: string): void {
  sequence = nextSequence;
  sequenceInput.value = nextSequence;
  latestAnalysis = null;
  latestRequest = null;
  isBusy = false;
  setFeedback("");
  render();
}

function playColumn(col: number): void {
  const game = parseCurrentGame(sequence);
  if (game.winner !== 0 || game.isDraw || game.heights[col] >= HEIGHT) {
    return;
  }
  setSequence(sequence + String(col + 1));
}

function applySequence(): void {
  const candidate = sequenceInput.value.trim();
  const parsed = parseSequence(candidate);

  if (!parsed.ok) {
    latestAnalysis = null;
    latestRequest = null;
    isBusy = false;
    setFeedback(parsed.error, "error");
    render();
    return;
  }

  setSequence(candidate);
}

function requestAnalysis(autoPlay: boolean): void {
  const game = parseCurrentGame(sequence);
  if (game.winner !== 0 || game.isDraw) {
    setFeedback("The position is terminal, so there is nothing left for the solver to analyze.", "info");
    render();
    return;
  }

  latestRequestId += 1;
  latestRequest = {
    autoPlay,
    requestId: latestRequestId,
    sequence,
    weak: currentWeakMode(),
  };
  isBusy = true;
  latestAnalysis = null;
  setFeedback("");

  const message: AnalyzeRequest = {
    requestId: latestRequestId,
    sequence,
    type: "analyze",
    weak: currentWeakMode(),
  };
  worker.postMessage(message);
  render();
}

function clearCache(): void {
  latestRequestId += 1;
  const message: ClearCacheRequest = {
    requestId: latestRequestId,
    type: "clear-cache",
  };
  worker.postMessage(message);
  latestAnalysis = null;
  latestRequest = null;
  isBusy = false;
  setFeedback("Solver cache cleared.", "info");
  render();
}

function renderBoard(game: ParsedGame, analysis: AnalysisSnapshot | null): void {
  boardElement.replaceChildren();

  for (let col = 0; col < WIDTH; col += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "column";
    button.dataset.column = String(col);

    const legalMove = game.heights[col] < HEIGHT && game.winner === 0 && !game.isDraw;
    const immediateWin = game.nextWinningColumns.includes(col);
    const bestMove = analysis?.bestColumns.includes(col) ?? false;
    const score = analysis?.scores[col] ?? INVALID_MOVE;

    if (!legalMove) {
      button.disabled = true;
    }
    if (immediateWin) {
      button.classList.add("immediate");
    }
    if (bestMove) {
      button.classList.add("best");
    }

    button.setAttribute(
      "aria-label",
      legalMove ? `Play column ${col + 1}` : `Column ${col + 1} is unavailable`,
    );

    if (legalMove) {
      button.addEventListener("click", () => {
        playColumn(col);
      });
    }

    const header = document.createElement("div");
    header.className = "column-top";

    const label = document.createElement("span");
    label.className = "column-label";
    label.textContent = `Col ${col + 1}`;
    header.append(label);

    const scoreBadge = document.createElement("span");
    scoreBadge.className = "column-score";
    if (analysis) {
      scoreBadge.textContent = formatCompactScore(score);
      if (score > 0) {
        scoreBadge.classList.add("win");
      } else if (score < 0) {
        scoreBadge.classList.add("loss");
      } else if (score === 0) {
        scoreBadge.classList.add("draw");
      }
    } else if (isBusy) {
      scoreBadge.textContent = legalMove ? "..." : "Full";
    } else {
      scoreBadge.textContent = legalMove ? "Play" : "Full";
    }
    header.append(scoreBadge);
    button.append(header);

    for (let row = HEIGHT - 1; row >= 0; row -= 1) {
      const cell = document.createElement("span");
      cell.className = "cell";
      const disc = game.board[row][col];
      if (disc === 1) {
        cell.classList.add("red", "filled");
      } else if (disc === 2) {
        cell.classList.add("yellow", "filled");
      }
      button.append(cell);
    }

    boardElement.append(button);
  }
}

function renderAnalysisList(game: ParsedGame, analysis: AnalysisSnapshot | null): void {
  analysisList.replaceChildren();

  for (let col = 0; col < WIDTH; col += 1) {
    const item = document.createElement("li");
    item.className = "analysis-item";

    const title = document.createElement("span");
    title.className = "analysis-column";
    title.textContent = `Column ${col + 1}`;
    item.append(title);

    const detail = document.createElement("span");
    detail.className = "analysis-detail";

    if (game.heights[col] >= HEIGHT) {
      detail.textContent = "Full";
    } else if (analysis) {
      detail.textContent = formatCompactScore(analysis.scores[col]);
      if (analysis.bestColumns.includes(col)) {
        item.classList.add("best");
      }
    } else if (game.nextWinningColumns.includes(col)) {
      detail.textContent = "Wins now";
      item.classList.add("immediate");
    } else {
      detail.textContent = "Playable";
    }

    item.append(detail);
    analysisList.append(item);
  }
}

function render(): void {
  const game = parseCurrentGame(sequence);
  const analysis = currentAnalysis();

  renderBoard(game, analysis);
  renderAnalysisList(game, analysis);

  turnLabel.textContent =
    game.winner !== 0
      ? `${playerName(game.winner as Player)} won on the last move.`
      : game.isDraw
        ? "The board is full. This game is a draw."
        : `${playerName(game.currentPlayer)} to move.`;

  if (game.winner !== 0) {
    statusLabel.textContent = "Solver analysis is disabled after the winning move because the game is already over.";
  } else if (game.isDraw) {
    statusLabel.textContent = "There are no legal moves left.";
  } else if (game.nextWinningColumns.length > 0) {
    statusLabel.textContent = `${playerName(game.currentPlayer)} has an immediate win in column ${game.nextWinningColumns
      .map((col) => col + 1)
      .join(", ")}.`;
  } else {
    statusLabel.textContent = "Click a column to play, or paste a move sequence and load it.";
  }

  if (isBusy && latestRequest && latestRequest.sequence === sequence && latestRequest.weak === currentWeakMode()) {
    analysisLabel.textContent = "Analyzing the current position in the background...";
    analysisLabel.className = "status-line";
  } else if (analysis) {
    const bestColumn = pickPreferredColumn(analysis.bestColumns);
    const bestMoveText = bestColumn === null ? "No legal moves remain." : `Best move: column ${bestColumn + 1}.`;
    analysisLabel.textContent = `${bestMoveText} ${formatScoreSummary(analysis.positionScore)} ${formatElapsed(
      analysis.elapsedMs,
    )}, ${analysis.nodeCount.toLocaleString()} nodes.`;
    analysisLabel.className = "status-line";
  } else if (feedbackText) {
    analysisLabel.textContent = feedbackText;
    analysisLabel.className = feedbackKind === "error" ? "status-line error" : "status-line";
  } else {
    analysisLabel.textContent = currentWeakMode()
      ? "Quick mode only distinguishes win, loss, and draw. Use it when the exact score takes too long."
      : "Run the analyzer to score every legal move from the current position.";
    analysisLabel.className = "status-line";
  }

  analyzeButton.disabled = game.winner !== 0 || game.isDraw || isBusy;
  bestMoveButton.disabled = game.winner !== 0 || game.isDraw || isBusy;
  undoButton.disabled = sequence.length === 0;
  resetButton.disabled = sequence.length === 0;
}

worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
  const message = event.data;

  if (message.type === "cache-cleared") {
    render();
    return;
  }

  if (!latestRequest || message.requestId !== latestRequest.requestId) {
    return;
  }

  const request = latestRequest;
  latestRequest = null;
  isBusy = false;

  if (request.sequence !== sequence || request.weak !== currentWeakMode()) {
    render();
    return;
  }

  if (!message.ok) {
    latestAnalysis = null;
    setFeedback(message.error, "error");
    render();
    return;
  }

  latestAnalysis = {
    bestColumns: message.bestColumns,
    elapsedMs: message.elapsedMs,
    nodeCount: message.nodeCount,
    positionScore: message.positionScore,
    scores: message.scores,
    sequence: request.sequence,
    weak: request.weak,
  };
  setFeedback("");
  render();

  if (request.autoPlay) {
    const bestColumn = pickPreferredColumn(message.bestColumns);
    if (bestColumn !== null) {
      playColumn(bestColumn);
    }
  }
});

loadButton.addEventListener("click", applySequence);
sequenceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applySequence();
  }
});
undoButton.addEventListener("click", () => {
  if (sequence.length === 0) {
    return;
  }
  setSequence(sequence.slice(0, -1));
});
resetButton.addEventListener("click", () => {
  setSequence("");
});
analyzeButton.addEventListener("click", () => {
  requestAnalysis(false);
});
bestMoveButton.addEventListener("click", () => {
  const analysis = currentAnalysis();
  if (analysis) {
    const bestColumn = pickPreferredColumn(analysis.bestColumns);
    if (bestColumn !== null) {
      playColumn(bestColumn);
    }
    return;
  }

  requestAnalysis(true);
});
clearCacheButton.addEventListener("click", clearCache);
weakModeInput.addEventListener("change", () => {
  latestAnalysis = null;
  latestRequest = null;
  isBusy = false;
  setFeedback("");
  render();
});

sequenceInput.value = sequence;
render();
