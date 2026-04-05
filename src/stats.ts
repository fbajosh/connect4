import type { StatsRange } from "./app-types";

export type PracticeGameResult = "win" | "loss";

export type PracticeGameStat = {
  completedAt: number;
  difficulty: number;
  id: string;
  moveCount: number;
  result: PracticeGameResult;
};

export type PracticeStatsRow = {
  averageLossLength: number | null;
  averageWinLength: number | null;
  difficulty: number;
  losses: number;
  winRate: number | null;
  wins: number;
};

const PRACTICE_STATS_STORAGE_KEY = "connect4-trainer-practice-stats";

function isPracticeGameStat(value: unknown): value is PracticeGameStat {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PracticeGameStat>;
  return (
    typeof candidate.completedAt === "number" &&
    typeof candidate.difficulty === "number" &&
    typeof candidate.id === "string" &&
    typeof candidate.moveCount === "number" &&
    (candidate.result === "win" || candidate.result === "loss")
  );
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

    return parsed.filter(isPracticeGameStat);
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

export function buildPracticeStatsRows(
  stats: PracticeGameStat[],
  range: StatsRange,
  now = Date.now(),
): PracticeStatsRow[] {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const filteredStats = range === "today" ? stats.filter((entry) => entry.completedAt >= cutoff) : stats;

  return Array.from({ length: 10 }, (_, index) => {
    const difficulty = index + 1;
    const entries = filteredStats.filter((entry) => entry.difficulty === difficulty);
    const wins = entries.filter((entry) => entry.result === "win");
    const losses = entries.filter((entry) => entry.result === "loss");
    const totalGames = entries.length;

    return {
      averageLossLength:
        losses.length === 0
          ? null
          : losses.reduce((sum, entry) => sum + entry.moveCount, 0) / losses.length,
      averageWinLength:
        wins.length === 0 ? null : wins.reduce((sum, entry) => sum + entry.moveCount, 0) / wins.length,
      difficulty,
      losses: losses.length,
      winRate: totalGames === 0 ? null : wins.length / totalGames,
      wins: wins.length,
    };
  });
}

export function createPracticeStatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
