type ScoreHistory = Array<number | null>;

type DevOutputOptions = {
  optimizerOutput: string;
  practiceRng: number | null;
  previousRedScores: ScoreHistory;
  previousYellowScores: ScoreHistory;
  state: string;
  winner: string | null;
};

function formatScoreHistory(scores: ScoreHistory): string {
  return scores.map((score) => (score === null ? "?" : String(score))).join(", ");
}

function averageScore(scores: ScoreHistory): number {
  const validScores = scores.filter((score): score is number => typeof score === "number");
  if (validScores.length === 0) {
    return 0;
  }

  return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
}

function formatAverageScore(scores: ScoreHistory): string {
  const average = averageScore(scores);
  return Number.isInteger(average) ? String(average) : average.toFixed(2);
}

export function scoreBarRedShare(
  previousRedScores: ScoreHistory,
  previousYellowScores: ScoreHistory,
): number {
  const totalRed = averageScore(previousRedScores);
  const totalYellow = averageScore(previousYellowScores);
  const denominator = 2 * (Math.abs(totalRed) + Math.abs(totalYellow));

  if (denominator === 0) {
    return 0.5;
  }

  const numerator = Math.abs(totalRed) + totalRed + Math.abs(totalYellow) - totalYellow;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function buildDevOutput(options: DevOutputOptions): string {
  const lines = [`state: ${options.state}`];

  if (options.winner !== null) {
    lines.push(`winner: ${options.winner}`);
  } else if (options.optimizerOutput.length > 0) {
    lines.push(options.optimizerOutput);
  }

  if (options.practiceRng !== null) {
    lines.push(`RNG: ${options.practiceRng.toFixed(6)}`);
  }

  lines.push(`total-red: ${formatAverageScore(options.previousRedScores)}`);
  lines.push(`total-yellow: ${formatAverageScore(options.previousYellowScores)}`);
  lines.push(`previous-red: ${formatScoreHistory(options.previousRedScores)}`);
  lines.push(`previous-yellow: ${formatScoreHistory(options.previousYellowScores)}`);
  return lines.join("\n");
}
