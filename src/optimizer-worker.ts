import initRustSolver, { Position, Solver } from "connect-four-ai-wasm";
import { getCachedSolverRecord, putCachedSolverRecord, type SolverRecord } from "./optimizer-cache";

type OptimizerRequest = {
  sequence: string;
};

type OptimizerResponse = {
  output: string;
  payload: SolverRecord | WasmErrorPayload;
};

type WasmErrorPayload = {
  error: string;
  invalidAtMove?: number;
  sequence: string;
};

let solverModulePromise: Promise<void> | null = null;

function getSolverModule(): Promise<void> {
  if (!solverModulePromise) {
    solverModulePromise = initRustSolver();
  }

  return solverModulePromise;
}

function formatOutput(payload: SolverRecord | WasmErrorPayload): string {
  if ("error" in payload) {
    return `error: ${payload.error}`;
  }

  return `best: ${payload.bestColumns.join(", ")}\nmoves: ${payload.scores.join(", ")}`;
}

async function solveWithWasm(sequence: string): Promise<SolverRecord | WasmErrorPayload> {
  let position: Position | null = null;
  let solver: Solver | null = null;

  try {
    await getSolverModule();

    position = Position.fromMoves(sequence);
    solver = new Solver();
    const startedAt = performance.now();
    const rawScores = solver.getAllMoveScores(position);
    const elapsedMs = performance.now() - startedAt;

    const scores = rawScores.map((score) => (score === null ? -1000 : Number(score)));
    const playableScores = scores.filter((score) => score !== -1000);
    const positionScore = playableScores.length === 0 ? 0 : Math.max(...playableScores);
    const bestColumns =
      playableScores.length === 0
        ? []
        : scores
            .map((score, index) => ({ score, index }))
            .filter((entry) => entry.score === positionScore)
            .map((entry) => entry.index + 1);

    const record: SolverRecord = {
      bestColumns,
      bestMoves: bestColumns.join(""),
      elapsedMs,
      positionScore,
      scores,
      sequence,
      source: "wasm",
    };

    await putCachedSolverRecord(record);
    return record;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unexpected Rust solver error.",
      sequence,
    };
  } finally {
    solver?.free();
    position?.free();
  }
}

async function handleRequest({ sequence }: OptimizerRequest): Promise<void> {
  try {
    const cachedRecord = await getCachedSolverRecord(sequence);
    const payload = cachedRecord ?? (await solveWithWasm(sequence));
    const response: OptimizerResponse = {
      output: formatOutput(payload),
      payload,
    };
    self.postMessage(response);
  } catch (error) {
    const payload = {
      error: error instanceof Error ? error.message : "Unexpected optimizer error.",
      sequence,
    } satisfies WasmErrorPayload;
    const response: OptimizerResponse = {
      output: formatOutput(payload),
      payload,
    };
    self.postMessage(response);
  }
}

self.addEventListener("message", (event: MessageEvent<OptimizerRequest>) => {
  void handleRequest(event.data);
});
