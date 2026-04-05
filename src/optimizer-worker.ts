import createConnect4SolverModule from "./generated/connect4-solver.js";
import solverWasmUrl from "./generated/connect4-solver.wasm?url";
import { getCachedSolverRecord, putCachedSolverRecord, type SolverRecord } from "./optimizer-cache";

type OptimizerRequest = {
  sequence: string;
};

type OptimizerResponse = {
  output: string;
  payload: SolverRecord | WasmErrorPayload;
};

type WasmSuccessPayload = {
  bestColumns: number[];
  bestMoves: string;
  elapsedMs?: number;
  message?: string;
  nodeCount?: number;
  positionScore: number;
  scores: number[];
  sequence: string;
};

type WasmErrorPayload = {
  error: string;
  invalidAtMove?: number;
  sequence: string;
};

let solverModulePromise: ReturnType<typeof createConnect4SolverModule> | null = null;

function getSolverModule(): ReturnType<typeof createConnect4SolverModule> {
  if (!solverModulePromise) {
    solverModulePromise = createConnect4SolverModule({
      locateFile: (path) => {
        if (path.endsWith(".wasm")) {
          return solverWasmUrl;
        }

        return path;
      },
    });
  }

  return solverModulePromise;
}

function formatOutput(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function normalizeWasmRecord(payload: WasmSuccessPayload): SolverRecord {
  return {
    bestColumns: [...payload.bestColumns],
    bestMoves: payload.bestMoves,
    elapsedMs: payload.elapsedMs,
    nodeCount: payload.nodeCount,
    positionScore: payload.positionScore,
    scores: [...payload.scores],
    sequence: payload.sequence,
    source: "wasm",
  };
}

async function solveWithWasm(sequence: string): Promise<SolverRecord | WasmErrorPayload> {
  const solverModule = await getSolverModule();
  const rawResult = solverModule.ccall("connect4_analyze_json", "string", ["string"], [sequence]);
  if (typeof rawResult !== "string") {
    throw new Error("Unexpected solver response.");
  }

  const parsed = JSON.parse(rawResult) as WasmSuccessPayload | WasmErrorPayload;
  if ("error" in parsed) {
    return parsed;
  }

  const record = normalizeWasmRecord(parsed);
  await putCachedSolverRecord(record);
  return record;
}

async function resolveOptimizerPayload(sequence: string): Promise<SolverRecord | WasmErrorPayload> {
  if (sequence.length === 0) {
    return {
      bestColumns: [4],
      bestMoves: "4",
      positionScore: 0,
      scores: [],
      sequence,
      source: "precomputed",
    };
  }

  const cachedRecord = await getCachedSolverRecord(sequence);
  if (cachedRecord) {
    return cachedRecord;
  }

  return solveWithWasm(sequence);
}

async function handleRequest({ sequence }: OptimizerRequest): Promise<void> {
  try {
    const payload = await resolveOptimizerPayload(sequence);
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
