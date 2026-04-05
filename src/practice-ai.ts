import type { PracticeColor } from "./app-types";

type PlayerMap = {
  red: number;
  yellow: number;
};

export type PracticeAiDebug = {
  rng: number;
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
  return 1 + ((10 - difficulty) / 9) * 7;
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

  const temperature = practiceTemperature(options.difficulty);
  const logits = validEntries.map((entry) => entry.score / temperature);
  const maxLogit = Math.max(...logits);
  const weights = logits.map((logit) => Math.exp(logit - maxLogit));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rng = (options.random ?? Math.random)();
  let threshold = rng * totalWeight;

  for (let index = 0; index < validEntries.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return {
        column: validEntries[index].column,
        debug: { rng },
      };
    }
  }

  return {
    column: validEntries[validEntries.length - 1].column,
    debug: { rng },
  };
}
