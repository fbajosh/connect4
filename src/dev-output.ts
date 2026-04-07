import type { PracticeAiDebug } from "./practice-ai";

type ScoreHistory = Array<number | null>;

type DevOutputOptions = {
  assistsEnabled: boolean;
  optimizerOutput: string;
  practiceDifficulty: number | null;
  practiceAiDebug: PracticeAiDebug | null;
  previousRedScores: ScoreHistory;
  previousYellowScores: ScoreHistory;
  remaining: string;
  state: string;
  timer: string;
  undoUsed: boolean;
  winner: string | null;
};

function formatScoreHistory(scores: ScoreHistory): string {
  return scores.map((score) => (score === null ? "?" : String(score))).join(", ");
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

function formatDisplayScoreList(scores: Array<number | null>): string {
  return scores.map((score) => (score === null ? "-" : formatDisplayNumber(score))).join(", ");
}

export function buildDevOutput(options: DevOutputOptions): string {
  const lines = [`state: ${options.state}`];

  if (options.winner !== null) {
    lines.push(`winner: ${options.winner}`);
  } else if (options.optimizerOutput.length > 0) {
    lines.push(options.optimizerOutput);
  }

  lines.push(`remaining: ${options.remaining}`);
  lines.push(`timer: ${options.timer}`);
  lines.push(`Assists enabled: ${options.assistsEnabled ? "yes" : "no"}`);
  lines.push(`Undo used: ${options.undoUsed ? "yes" : "no"}`);

  if (options.practiceAiDebug !== null) {
    lines.push(`previous: ${formatDisplayScoreList(options.practiceAiDebug.previousMoves)}`);
    if (options.practiceAiDebug.selectionMode === "flat") {
      if (options.practiceDifficulty !== null) {
        lines.push(`temperature: flat (${options.practiceDifficulty})`);
      } else {
        lines.push("temperature: flat");
      }
    } else if (options.practiceAiDebug.selectionMode === "deterministic") {
      if (options.practiceDifficulty !== null) {
        lines.push(`temperature: deterministic (${options.practiceDifficulty})`);
      } else {
        lines.push("temperature: deterministic");
      }
    } else if (options.practiceDifficulty !== null && options.practiceAiDebug.temperature !== null) {
      lines.push(`temperature: ${options.practiceAiDebug.temperature.toFixed(3)} (${options.practiceDifficulty})`);
    } else if (options.practiceAiDebug.temperature !== null) {
      lines.push(`temperature: ${options.practiceAiDebug.temperature.toFixed(3)}`);
    } else {
      lines.push("temperature: -");
    }
    lines.push(`RNG: ${options.practiceAiDebug.rng === null ? "-" : options.practiceAiDebug.rng.toFixed(6)}`);
  }

  lines.push(`previous-red: ${formatScoreHistory(options.previousRedScores)}`);
  lines.push(`previous-yellow: ${formatScoreHistory(options.previousYellowScores)}`);
  return lines.join("\n");
}
