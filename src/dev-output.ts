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
  version: string;
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

function formatRoundedTenthsList(scores: Array<number | null>): string {
  return scores.map((score) => (score === null ? "-" : score.toFixed(1))).join(", ");
}

function extractOutputField(output: string, prefix: string): string {
  const normalizedOutput = output.trim().toLowerCase();
  if (!normalizedOutput) {
    return "";
  }

  for (const line of normalizedOutput.split("\n")) {
    if (line.startsWith(`${prefix}:`)) {
      return line.slice(prefix.length + 1).trim();
    }
  }

  return "";
}

export function buildDevOutput(options: DevOutputOptions): string {
  const optimizerOutput = options.optimizerOutput.trim().toLowerCase();
  const best = extractOutputField(optimizerOutput, "best");
  const moves = extractOutputField(optimizerOutput, "moves");
  const error = extractOutputField(optimizerOutput, "error");
  let status = extractOutputField(optimizerOutput, "status");
  if (!status && optimizerOutput && !best && !moves && !error) {
    status = optimizerOutput;
  }

  const scores = options.practiceAiDebug ? formatDisplayScoreList(options.practiceAiDebug.rawScores) : "";
  const patternAdjust = options.practiceAiDebug
    ? formatRoundedTenthsList(options.practiceAiDebug.patternAdjustments)
    : "";
  let temperature = "";
  if (options.practiceAiDebug !== null) {
    if (options.practiceAiDebug.selectionMode === "flat") {
      temperature =
        options.practiceDifficulty !== null ? `flat (${options.practiceDifficulty})` : "flat";
    } else if (options.practiceAiDebug.selectionMode === "deterministic") {
      temperature =
        options.practiceDifficulty !== null ? `deterministic (${options.practiceDifficulty})` : "deterministic";
    } else if (options.practiceDifficulty !== null && options.practiceAiDebug.temperature !== null) {
      temperature = `${options.practiceAiDebug.temperature.toFixed(3)} (${options.practiceDifficulty})`;
    } else if (options.practiceAiDebug.temperature !== null) {
      temperature = options.practiceAiDebug.temperature.toFixed(3);
    } else {
      temperature = "-";
    }
  }
  const rng = options.practiceAiDebug?.rng === null || options.practiceAiDebug === null
    ? ""
    : options.practiceAiDebug.rng.toFixed(6);

  const lines = [
    `version: ${options.version}`,
    `state: ${options.state}`,
    `winner: ${options.winner ?? ""}`,
    `status: ${status}`,
    `best: ${best}`,
    `moves: ${moves}`,
    `error: ${error}`,
    `remaining: ${options.remaining.toLowerCase()}`,
  ];

  lines.push(`timer: ${options.timer}`);
  lines.push(`assists enabled: ${options.assistsEnabled ? "yes" : "no"}`);
  lines.push(`undo used: ${options.undoUsed ? "yes" : "no"}`);
  lines.push(`scores: ${scores}`);
  lines.push(`pattern_adjust: ${patternAdjust}`);
  lines.push(`temperature: ${temperature}`);
  lines.push(`rng: ${rng}`);
  lines.push(`previous-red: ${formatScoreHistory(options.previousRedScores)}`);
  lines.push(`previous-yellow: ${formatScoreHistory(options.previousYellowScores)}`);
  return lines.join("\n");
}
