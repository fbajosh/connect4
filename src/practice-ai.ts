import type { PracticeColor } from "./app-types";
import {
  detectWinningMask,
  EMPTY,
  isInBounds,
  lowestOpenRow,
  nextPlayer,
  type BoardState,
  type PlayerValue,
} from "./game-rules";

type PlayerMap = {
  red: number;
  yellow: number;
};

export type PracticeAiDebug = {
  patternAdjustments: Array<number | null>;
  rawScores: Array<number | null>;
  rng: number | null;
  selectionMode: "flat" | "softmax" | "deterministic";
  tacticalFilter: "none" | "win" | "block" | "avoid-loss";
  temperature: number | null;
};

type ChoosePracticeAiColumnOptions = {
  board: BoardState;
  difficulty: number;
  isColumnPlayable: (column: number) => boolean;
  player: PlayerValue;
  random?: () => number;
  scores: number[];
};

const PATTERN_CONNECT_DIVISOR = 4;
const PATTERN_GAP_DIVISOR = 8;
const PATTERN_WEIGHT_DIVISOR = 5;
const RUN_DIRECTIONS: Array<[columnStep: number, rowStep: number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function effectivePracticeHumanPlayer(
  practiceColor: PracticeColor,
  practiceRoundIndex: number,
  players: PlayerMap,
): number {
  if (practiceColor === "yellow") {
    return players.yellow;
  }

  if (practiceColor === "alternate") {
    return practiceRoundIndex % 2 === 0 ? players.red : players.yellow;
  }

  return players.red;
}

export function practiceTemperature(difficulty: number): number {
  if (difficulty <= 1 || difficulty >= 10) {
    return 0;
  }

  if (difficulty === 2) {
    return 8;
  }

  if (difficulty === 3) {
    return 6;
  }

  if (difficulty === 4) {
    return 4.5;
  }

  if (difficulty === 5) {
    return 3.2;
  }

  if (difficulty === 6) {
    return 2.35;
  }

  if (difficulty === 7) {
    return 1.7;
  }

  if (difficulty === 8) {
    return 1.1;
  }

  return 0.625;
}

function cloneBoard(board: BoardState): BoardState {
  return board.map((row) => [...row]);
}

function boardAfterMove(
  board: BoardState,
  column: number,
  player: PlayerValue,
): BoardState | null {
  const row = lowestOpenRow(board, column);
  if (row === null) {
    return null;
  }

  const nextBoard = cloneBoard(board);
  nextBoard[row][column] = player;
  return nextBoard;
}

function immediateWinningColumns(board: BoardState, player: PlayerValue): number[] {
  const columns: number[] = [];

  for (let column = 0; column < board[0].length; column += 1) {
    const nextBoard = boardAfterMove(board, column, player);
    if (nextBoard !== null && detectWinningMask(nextBoard).hasWinningRun) {
      columns.push(column);
    }
  }

  return columns;
}

function countContiguous(
  board: BoardState,
  row: number,
  column: number,
  columnStep: number,
  rowStep: number,
  player: PlayerValue,
): number {
  let total = 0;
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (isInBounds(nextRow, nextColumn) && board[nextRow][nextColumn] === player) {
    total += 1;
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return total;
}

function qualifyingWindows(
  row: number,
  column: number,
  columnStep: number,
  rowStep: number,
): Array<Array<[row: number, column: number]>> {
  const windows: Array<Array<[row: number, column: number]>> = [];

  for (let startOffset = -3; startOffset <= 0; startOffset += 1) {
    const cells: Array<[row: number, column: number]> = [];
    let isValid = true;

    for (let index = 0; index < 4; index += 1) {
      const nextRow = row + (startOffset + index) * rowStep;
      const nextColumn = column + (startOffset + index) * columnStep;
      if (!isInBounds(nextRow, nextColumn)) {
        isValid = false;
        break;
      }

      cells.push([nextRow, nextColumn]);
    }

    if (isValid) {
      windows.push(cells);
    }
  }

  return windows;
}

function countCreateThreePatterns(
  board: BoardState,
  row: number,
  column: number,
  player: PlayerValue,
): number {
  let total = 0;

  for (const [columnStep, rowStep] of RUN_DIRECTIONS) {
    const backward = countContiguous(board, row, column, -columnStep, -rowStep, player);
    const forward = countContiguous(board, row, column, columnStep, rowStep, player);
    if (backward >= 2 || forward >= 2) {
      total += 1;
    }
  }

  return total;
}

function countConnectivePatterns(
  board: BoardState,
  row: number,
  column: number,
  player: PlayerValue,
): number {
  const opponent = nextPlayer(player);
  let total = 0;

  for (const [columnStep, rowStep] of RUN_DIRECTIONS) {
    const touchesOwnPiece =
      (isInBounds(row - rowStep, column - columnStep) &&
        board[row - rowStep][column - columnStep] === player) ||
      (isInBounds(row + rowStep, column + columnStep) &&
        board[row + rowStep][column + columnStep] === player);

    if (!touchesOwnPiece) {
      continue;
    }

    const hasFutureRun = qualifyingWindows(row, column, columnStep, rowStep).some((cells) =>
      cells.every(([windowRow, windowColumn]) => board[windowRow][windowColumn] !== opponent),
    );

    if (hasFutureRun) {
      total += 1;
    }
  }

  return total;
}

function countGappedFourPatterns(
  board: BoardState,
  row: number,
  column: number,
  player: PlayerValue,
): number {
  let total = 0;

  for (const [columnStep, rowStep] of RUN_DIRECTIONS) {
    const hasGappedWindow = qualifyingWindows(row, column, columnStep, rowStep).some((cells) => {
      let ownCount = 0;
      let emptyCount = 0;
      let emptyIndex = -1;

      cells.forEach(([windowRow, windowColumn], index) => {
        const cell = board[windowRow][windowColumn];
        if (cell === player) {
          ownCount += 1;
        } else if (cell === EMPTY) {
          emptyCount += 1;
          emptyIndex = index;
        } else {
          emptyCount = 99;
        }
      });

      return ownCount === 3 && emptyCount === 1 && emptyIndex > 0 && emptyIndex < cells.length - 1;
    });

    if (hasGappedWindow) {
      total += 1;
    }
  }

  return total;
}

function patternAdjustmentForColumn(options: {
  board: BoardState;
  column: number;
  difficulty: number;
  player: PlayerValue;
}): number {
  if (options.difficulty <= 1 || options.difficulty >= 10) {
    return 0;
  }

  const row = lowestOpenRow(options.board, options.column);
  if (row === null) {
    return 0;
  }

  const boardAfterMove = cloneBoard(options.board);
  boardAfterMove[row][options.column] = options.player;

  const createThree = countCreateThreePatterns(boardAfterMove, row, options.column, options.player);
  const connective = countConnectivePatterns(boardAfterMove, row, options.column, options.player);
  const gappedFour = countGappedFourPatterns(boardAfterMove, row, options.column, options.player);
  const weightedPatternScore =
    createThree + connective / PATTERN_CONNECT_DIVISOR + gappedFour / PATTERN_GAP_DIVISOR;

  return (weightedPatternScore * practiceTemperature(options.difficulty)) / PATTERN_WEIGHT_DIVISOR;
}

function emptyDisplayMoves(length: number): Array<number | null> {
  return Array.from({ length }, () => null as number | null);
}

function setDisplayMoves(
  length: number,
  columns: number[],
  values: number[],
): Array<number | null> {
  const displayMoves = emptyDisplayMoves(length);
  columns.forEach((column, index) => {
    displayMoves[column] = values[index];
  });
  return displayMoves;
}

type EvaluatedEntry = {
  column: number;
  isWinningMove: boolean;
  opponentWinningReplies: number[];
  score: number;
};

export function choosePracticeAiColumn(
  options: ChoosePracticeAiColumnOptions,
): { column: number | null; debug: PracticeAiDebug | null } {
  const validEntries = options.scores
    .map((score, column) => ({ score, column }))
    .filter((entry) => entry.score !== -1000 && options.isColumnPlayable(entry.column));

  if (validEntries.length === 0) {
    return {
      column: null,
      debug: null,
    };
  }

  const random = options.random ?? Math.random;
  const validColumns = validEntries.map((entry) => entry.column);
  const rawScores = setDisplayMoves(
    options.scores.length,
    validColumns,
    validEntries.map((entry) => entry.score),
  );
  const patternAdjustments = setDisplayMoves(
    options.scores.length,
    validColumns,
    validEntries.map((entry) =>
      patternAdjustmentForColumn({
        board: options.board,
        column: entry.column,
        difficulty: options.difficulty,
        player: options.player,
      }),
    ),
  );
  const opponent = nextPlayer(options.player);
  const evaluatedEntries = validEntries.flatMap((entry) => {
    const nextBoard = boardAfterMove(options.board, entry.column, options.player);
    if (nextBoard === null) {
      return [];
    }

    return [
      {
        column: entry.column,
        isWinningMove: detectWinningMask(nextBoard).hasWinningRun,
        opponentWinningReplies: immediateWinningColumns(nextBoard, opponent),
        score: entry.score,
      } satisfies EvaluatedEntry,
    ];
  });

  if (evaluatedEntries.length === 0) {
    return {
      column: null,
      debug: null,
    };
  }

  let candidateEntries = evaluatedEntries;
  let tacticalFilter: PracticeAiDebug["tacticalFilter"] = "none";
  const winningEntries = evaluatedEntries.filter((entry) => entry.isWinningMove);
  const opponentWinningColumns = immediateWinningColumns(options.board, opponent);

  if (winningEntries.length > 0) {
    candidateEntries = winningEntries;
    tacticalFilter = "win";
  } else {
    const safeEntries = evaluatedEntries.filter((entry) => entry.opponentWinningReplies.length === 0);
    const isOpponentThreatening = opponentWinningColumns.length > 0;

    if (safeEntries.length > 0 && safeEntries.length < evaluatedEntries.length) {
      candidateEntries = safeEntries;
      tacticalFilter = isOpponentThreatening ? "block" : "avoid-loss";
    } else if (isOpponentThreatening) {
      const opponentWinningColumnSet = new Set(opponentWinningColumns);
      const blockingEntries = evaluatedEntries.filter((entry) => opponentWinningColumnSet.has(entry.column));
      if (blockingEntries.length > 0 && blockingEntries.length < evaluatedEntries.length) {
        candidateEntries = blockingEntries;
        tacticalFilter = "block";
      }
    }
  }

  if (options.difficulty <= 1) {
    const rng = random();
    const chosenIndex = Math.min(candidateEntries.length - 1, Math.floor(rng * candidateEntries.length));

    return {
      column: candidateEntries[chosenIndex].column,
      debug: {
        patternAdjustments,
        rawScores,
        rng,
        selectionMode: "flat",
        tacticalFilter,
        temperature: null,
      },
    };
  }

  if (options.difficulty >= 10) {
    const maxScore = Math.max(...candidateEntries.map((entry) => entry.score));
    const bestEntries = candidateEntries.filter((entry) => entry.score === maxScore);
    const rng = bestEntries.length > 1 ? random() : null;
    const chosenIndex =
      bestEntries.length > 1 && rng !== null ? Math.min(bestEntries.length - 1, Math.floor(rng * bestEntries.length)) : 0;

    return {
      column: bestEntries[chosenIndex].column,
      debug: {
        patternAdjustments,
        rawScores,
        rng,
        selectionMode: "deterministic",
        tacticalFilter,
        temperature: null,
      },
    };
  }

  const temperature = practiceTemperature(options.difficulty);
  const logits = candidateEntries.map((entry) => {
    const patternAdjustment = patternAdjustments[entry.column] ?? 0;
    return (entry.score + patternAdjustment) / temperature;
  });
  const maxLogit = Math.max(...logits);
  const weights = logits.map((logit) => Math.exp(logit - maxLogit));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rng = random();
  let threshold = rng * totalWeight;

  for (let index = 0; index < candidateEntries.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return {
        column: candidateEntries[index].column,
        debug: {
          patternAdjustments,
          rawScores,
          rng,
          selectionMode: "softmax",
          tacticalFilter,
          temperature,
        },
      };
    }
  }

  return {
    column: candidateEntries[candidateEntries.length - 1].column,
    debug: {
      patternAdjustments,
      rawScores,
      rng,
      selectionMode: "softmax",
      tacticalFilter,
      temperature,
    },
  };
}
