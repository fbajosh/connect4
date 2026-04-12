export type PracticeGameResult = "win" | "loss" | "tie";
export type PracticeEventKind = "loss-undo" | "repeat-loss" | "reset" | "reset-while-losing";

export type PracticeGameStat = {
  completedAt: number;
  difficulty: number;
  gameDurationMs: number | null;
  id: string;
  kind: "game";
  moveCount: number;
  result: PracticeGameResult;
  usedAssist: boolean;
  usedUndo: boolean;
  winningDiscCount: number | null;
};

export type PracticeEventStat = {
  difficulty: number;
  id: string;
  kind: PracticeEventKind;
  occurredAt: number;
};

export type PracticeStatRecord = PracticeEventStat | PracticeGameStat;

export type PracticeStatsSummary = {
  averageGameTimeMs: number | null;
  averageLossLength: number | null;
  averageWinLength: number | null;
  biggestLoss: number | null;
  biggestWin: number | null;
  fastestWinMs: number | null;
  lostMultipleTimes: number;
  losses: number;
  lossesUndone: number;
  resetCount: number;
  resetsWhileLosing: number;
  ties: number;
  winRate: number | null;
  wins: number;
  winsWithoutAssist: number;
  winsWithoutUndo: number;
};

export type PracticeDifficultyStats = {
  lifetime: PracticeStatsSummary;
  today: PracticeStatsSummary;
};

export type PracticeGameResultMove = {
  aiDebug: unknown | null;
  column: number;
  moveNumber: number;
  player: "red" | "yellow";
  previousScore: number | null;
};

export type PracticeGameResultBlock = {
  appVersion: string;
  completedAt: number;
  completedAtIso: string;
  difficulty: number;
  finalBoard: string[][];
  finalRemaining: string;
  finalScoreShare: string;
  gameDurationMs: number | null;
  humanPlayer: "red" | "yellow";
  lowestAiDifficulty: number | null;
  mode: "training";
  moveCount: number;
  moves: PracticeGameResultMove[];
  practiceColor: string;
  previousRedScores: Array<number | null>;
  previousYellowScores: Array<number | null>;
  result: PracticeGameResult;
  schemaVersion: 1;
  selectedDifficulty: number;
  startedAt: number;
  startedAtIso: string;
  state: string;
  usedAssist: boolean;
  usedUndo: boolean;
  winDiscs: number | null;
  winner: "red" | "yellow" | null;
};

export type PracticeGameResultRecord = {
  completedAt: number;
  id: string;
  practiceStatId: string;
  result: PracticeGameResultBlock;
  startedAt: number;
};

const PRACTICE_STATS_STORAGE_KEY = "connect4-trainer-practice-stats";
const PRACTICE_GAME_RESULTS_STORAGE_KEY = "connect4-trainer-practice-game-results";

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
  const winningDiscCount =
    typeof candidate.winningDiscCount === "number" &&
    Number.isFinite(candidate.winningDiscCount) &&
    candidate.winningDiscCount >= 4
      ? candidate.winningDiscCount
      : null;

  return {
    completedAt: candidate.completedAt,
    difficulty: candidate.difficulty,
    gameDurationMs,
    id: candidate.id,
    kind: "game",
    moveCount: candidate.moveCount,
    result: candidate.result,
    usedAssist: candidate.usedAssist === true,
    usedUndo: candidate.usedUndo === true,
    winningDiscCount,
  };
}

function normalizePracticeEventStat(value: unknown): PracticeEventStat | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PracticeEventStat>;
  if (
    typeof candidate.difficulty !== "number" ||
    typeof candidate.id !== "string" ||
    typeof candidate.occurredAt !== "number" ||
    (candidate.kind !== "loss-undo" &&
      candidate.kind !== "repeat-loss" &&
      candidate.kind !== "reset" &&
      candidate.kind !== "reset-while-losing")
  ) {
    return null;
  }

  return {
    difficulty: candidate.difficulty,
    id: candidate.id,
    kind: candidate.kind,
    occurredAt: candidate.occurredAt,
  };
}

function normalizePracticeStatRecord(value: unknown): PracticeStatRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { kind?: unknown };
  if (candidate.kind === "loss-undo" || candidate.kind === "repeat-loss" || candidate.kind === "reset" || candidate.kind === "reset-while-losing") {
    return normalizePracticeEventStat(value);
  }

  return normalizePracticeGameStat(value);
}

export function readStoredPracticeStats(): PracticeStatRecord[] {
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
      .map((entry) => normalizePracticeStatRecord(entry))
      .filter((entry): entry is PracticeStatRecord => entry !== null);
  } catch {
    return [];
  }
}

function writeStoredPracticeStats(stats: PracticeStatRecord[]): void {
  try {
    window.localStorage.setItem(PRACTICE_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage failures; stats are optional.
  }
}

export function appendPracticeStat(stat: PracticeStatRecord): PracticeStatRecord[] {
  const nextStats = [...readStoredPracticeStats(), stat];
  writeStoredPracticeStats(nextStats);
  return nextStats;
}

export function removePracticeStatById(id: string): { nextStats: PracticeStatRecord[]; removedStat: PracticeStatRecord | null } {
  const existingStats = readStoredPracticeStats();
  let removedStat: PracticeStatRecord | null = null;
  const nextStats = existingStats.filter((entry) => {
    if (entry.id !== id) {
      return true;
    }

    removedStat = entry;
    return false;
  });
  writeStoredPracticeStats(nextStats);
  return {
    nextStats,
    removedStat,
  };
}

function normalizePracticeGameResultRecord(value: unknown): PracticeGameResultRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PracticeGameResultRecord>;
  if (
    typeof candidate.completedAt !== "number" ||
    typeof candidate.id !== "string" ||
    typeof candidate.practiceStatId !== "string" ||
    typeof candidate.startedAt !== "number" ||
    !candidate.result ||
    typeof candidate.result !== "object"
  ) {
    return null;
  }

  return {
    completedAt: candidate.completedAt,
    id: candidate.id,
    practiceStatId: candidate.practiceStatId,
    result: candidate.result as PracticeGameResultBlock,
    startedAt: candidate.startedAt,
  };
}

export function readStoredPracticeGameResults(): PracticeGameResultRecord[] {
  try {
    const raw = window.localStorage.getItem(PRACTICE_GAME_RESULTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizePracticeGameResultRecord(entry))
      .filter((entry): entry is PracticeGameResultRecord => entry !== null);
  } catch {
    return [];
  }
}

function writeStoredPracticeGameResults(results: PracticeGameResultRecord[]): void {
  try {
    window.localStorage.setItem(PRACTICE_GAME_RESULTS_STORAGE_KEY, JSON.stringify(results));
  } catch {
    // Ignore storage failures; result history is optional.
  }
}

export function appendPracticeGameResult(result: PracticeGameResultRecord): PracticeGameResultRecord[] {
  const nextResults = [...readStoredPracticeGameResults(), result];
  writeStoredPracticeGameResults(nextResults);
  return nextResults;
}

export function removePracticeGameResultByStatId(practiceStatId: string): PracticeGameResultRecord[] {
  const nextResults = readStoredPracticeGameResults().filter((entry) => entry.practiceStatId !== practiceStatId);
  writeStoredPracticeGameResults(nextResults);
  return nextResults;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizePracticeStats(stats: PracticeStatRecord[]): PracticeStatsSummary {
  const games = stats.filter((entry): entry is PracticeGameStat => entry.kind === "game");
  const wins = games.filter((entry) => entry.result === "win");
  const losses = games.filter((entry) => entry.result === "loss");
  const ties = games.filter((entry) => entry.result === "tie");
  const winSizes = wins
    .map((entry) => entry.winningDiscCount)
    .filter((count): count is number => count !== null);
  const lossSizes = losses
    .map((entry) => entry.winningDiscCount)
    .filter((count): count is number => count !== null);
  const timedGames = games
    .map((entry) => entry.gameDurationMs)
    .filter((duration): duration is number => duration !== null);
  const timedWins = wins
    .map((entry) => entry.gameDurationMs)
    .filter((duration): duration is number => duration !== null);
  const totalGames = games.length;

  return {
    averageGameTimeMs: average(timedGames),
    averageLossLength: average(losses.map((entry) => entry.moveCount)),
    averageWinLength: average(wins.map((entry) => entry.moveCount)),
    biggestLoss: lossSizes.length === 0 ? null : Math.max(...lossSizes),
    biggestWin: winSizes.length === 0 ? null : Math.max(...winSizes),
    fastestWinMs: timedWins.length === 0 ? null : Math.min(...timedWins),
    lostMultipleTimes: stats.filter((entry) => entry.kind === "repeat-loss").length,
    losses: losses.length,
    lossesUndone: stats.filter((entry) => entry.kind === "loss-undo").length,
    resetCount: stats.filter((entry) => entry.kind === "reset").length,
    resetsWhileLosing: stats.filter((entry) => entry.kind === "reset-while-losing").length,
    ties: ties.length,
    winRate: totalGames === 0 ? null : (wins.length + 0.5 * ties.length) / totalGames,
    wins: wins.length,
    winsWithoutAssist: wins.filter((entry) => !entry.usedUndo && !entry.usedAssist).length,
    winsWithoutUndo: wins.filter((entry) => !entry.usedUndo).length,
  };
}

function statRecordedAt(stat: PracticeStatRecord): number {
  return stat.kind === "game" ? stat.completedAt : stat.occurredAt;
}

export function buildPracticeDifficultyStats(
  stats: PracticeStatRecord[],
  difficulty: number,
  now = Date.now(),
): PracticeDifficultyStats {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const difficultyStats = stats.filter((entry) => entry.difficulty === difficulty);

  return {
    lifetime: summarizePracticeStats(difficultyStats),
    today: summarizePracticeStats(difficultyStats.filter((entry) => statRecordedAt(entry) >= cutoff)),
  };
}

export function createPracticeStatId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
