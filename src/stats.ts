export type PracticeGameResult = "win" | "loss" | "tie";

export type PracticeGameStat = {
  completedAt: number;
  difficulty: number;
  gameDurationMs: number | null;
  id: string;
  moveCount: number;
  result: PracticeGameResult;
  usedUndo: boolean;
};

export type PracticeStatsSummary = {
  averageGameTimeMs: number | null;
  averageLossLength: number | null;
  averageWinLength: number | null;
  fastestWinMs: number | null;
  losses: number;
  ties: number;
  winRate: number | null;
  wins: number;
  winsWithoutUndo: number;
};

export type PracticeDifficultyStats = {
  lifetime: PracticeStatsSummary;
  today: PracticeStatsSummary;
};

const PRACTICE_STATS_STORAGE_KEY = "connect4-trainer-practice-stats";

function normalizePracticeGameStat(value: unknown): PracticeGameStat | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PracticeGameStat>;
  if (
    typeof candidate.completedAt !== "number" ||
    typeof candidate.difficulty !== "number" ||
    typeof candidate.id !== "string" ||
    typeof candidate.moveCount !== "number" ||
    (candidate.result !== "win" && candidate.result !== "loss" && candidate.result !== "tie")
  ) {
    return null;
  }

  const gameDurationMs =
    typeof candidate.gameDurationMs === "number" && Number.isFinite(candidate.gameDurationMs) && candidate.gameDurationMs >= 0
      ? candidate.gameDurationMs
      : null;

  return {
    completedAt: candidate.completedAt,
    difficulty: candidate.difficulty,
    gameDurationMs,
    id: candidate.id,
    moveCount: candidate.moveCount,
    result: candidate.result,
    usedUndo: candidate.usedUndo === true,
  };
}

export function readStoredPracticeStats(): PracticeGameStat[] {
  try {
    const raw = window.localStorage.getItem(PRACTICE_STATS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizePracticeGameStat(entry))
      .filter((entry): entry is PracticeGameStat => entry !== null);
  } catch {
    return [];
  }
}

function writeStoredPracticeStats(stats: PracticeGameStat[]): void {
  try {
    window.localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage failures; stats are optional.
  }
}

export function appendPracticeStat(stat: PracticeGameStat): PracticeGameStat[] {
  const nextStats = [...readStoredPracticeStats(), stat];
  writeStoredPracticeStats(nextStats);
  return nextStats;
}

export function removePracticeStatById(id: string): PracticeGameStat[] {
  const nextStats = readStoredPracticeStats().filter((entry) => entry.id !== id);
  writeStoredPracticeStats(nextStats);
  return nextStats;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizePracticeStats(stats: PracticeGameStat[]): PracticeStatsSummary {
  const wins = stats.filter((entry) => entry.result === "win");
  const losses = stats.filter((entry) => entry.result === "loss");
  const ties = stats.filter((entry) => entry.result === "tie");
  const timedGames = stats
    .map((entry) => entry.gameDurationMs)
    .filter((duration): duration is number => duration !== null);
  const timedWins = wins
    .map((entry) => entry.gameDurationMs)
    .filter((duration): duration is number => duration !== null);
  const totalGames = stats.length;

  return {
    averageGameTimeMs: average(timedGames),
    averageLossLength: average(losses.map((entry) => entry.moveCount)),
    averageWinLength: average(wins.map((entry) => entry.moveCount)),
    fastestWinMs: timedWins.length === 0 ? null : Math.min(...timedWins),
    losses: losses.length,
    ties: ties.length,
    winRate: totalGames === 0 ? null : (wins.length + 0.5 * ties.length) / totalGames,
    wins: wins.length,
    winsWithoutUndo: wins.filter((entry) => !entry.usedUndo).length,
  };
}

export function buildPracticeDifficultyStats(
  stats: PracticeGameStat[],
  difficulty: number,
  now = Date.now(),
): PracticeDifficultyStats {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const difficultyStats = stats.filter((entry) => entry.difficulty === difficulty);

  return {
    lifetime: summarizePracticeStats(difficultyStats),
    today: summarizePracticeStats(difficultyStats.filter((entry) => entry.completedAt >= cutoff)),
  };
}

export function createPracticeStatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
