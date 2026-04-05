function validScoreEntries(scores: number[]): Array<{ column: number; score: number }> {
  return scores
    .map((score, column) => ({ column, score }))
    .filter((entry) => entry.score !== -1000);
}

export function shiftSolverScoresToDisplay(scores: number[]): Array<number | null> {
  const shifted = Array.from({ length: scores.length }, () => null as number | null);
  const validEntries = validScoreEntries(scores);

  if (validEntries.length === 0) {
    return shifted;
  }

  const minScore = Math.min(...validEntries.map((entry) => entry.score));
  const offset = Math.max(0, -minScore);

  for (const entry of validEntries) {
    shifted[entry.column] = entry.score + offset;
  }

  return shifted;
}

export function formatShiftedScoreList(scores: number[]): string {
  return shiftSolverScoresToDisplay(scores)
    .map((score) => (score === null ? "-" : String(score)))
    .join(", ");
}
