import type { PracticeColor } from "./app-types";

type PlayerMap = {
  red: number;
  yellow: number;
};

export type PracticeAiDebug = {
  previousMoves: Array<number | null>;
  rng: number | null;
  selectionMode: "flat" | "softmax" | "deterministic";
  temperature: number | null;
};

type ChoosePracticeAiColumnOptions = {
  difficulty: number;
  isColumnPlayable: (column: number) => boolean;
  random?: () => number;
  scores: number[];
};

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

  if (difficulty <= 5) {
    return 6 - difficulty;
  }

  return 1 - (difficulty - 5) * 0.2;
}

function shiftValuesToZero(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const minValue = Math.min(...values);
  const offset = Math.max(0, -minValue);
  return values.map((value) => value + offset);
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

  if (options.difficulty <= 1) {
    const rng = random();
    const chosenIndex = Math.min(validEntries.length - 1, Math.floor(rng * validEntries.length));

    return {
      column: validEntries[chosenIndex].column,
      debug: {
        previousMoves: setDisplayMoves(
          options.scores.length,
          validColumns,
          validColumns.map(() => 0),
        ),
        rng,
        selectionMode: "flat",
        temperature: null,
      },
    };
  }

  if (options.difficulty >= 10) {
    const maxScore = Math.max(...validEntries.map((entry) => entry.score));
    const bestEntries = validEntries.filter((entry) => entry.score === maxScore);
    const rng = bestEntries.length > 1 ? random() : null;
    const chosenIndex =
      bestEntries.length > 1 && rng !== null ? Math.min(bestEntries.length - 1, Math.floor(rng * bestEntries.length)) : 0;

    return {
      column: bestEntries[chosenIndex].column,
      debug: {
        previousMoves: setDisplayMoves(
          options.scores.length,
          validColumns,
          validEntries.map((entry) => (entry.score === maxScore ? 1 : 0)),
        ),
        rng,
        selectionMode: "deterministic",
        temperature: null,
      },
    };
  }

  const temperature = practiceTemperature(options.difficulty);
  const logits = validEntries.map((entry) => entry.score / temperature);
  const shiftedLogits = shiftValuesToZero(logits);
  const previousMoves = setDisplayMoves(options.scores.length, validColumns, shiftedLogits);
  const maxLogit = Math.max(...logits);
  const weights = logits.map((logit) => Math.exp(logit - maxLogit));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rng = random();
  let threshold = rng * totalWeight;

  for (let index = 0; index < validEntries.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return {
        column: validEntries[index].column,
        debug: {
          previousMoves,
          rng,
          selectionMode: "softmax",
          temperature,
        },
      };
    }
  }

  return {
    column: validEntries[validEntries.length - 1].column,
    debug: {
      previousMoves,
      rng,
      selectionMode: "softmax",
      temperature,
    },
  };
}
