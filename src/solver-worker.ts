import { Position } from "./connect4/position.js";
import { Solver } from "./connect4/solver.js";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol.js";

declare const self: DedicatedWorkerGlobalScope;

const solver = new Solver();

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "clear-cache") {
    solver.clearCache();
    const response: WorkerResponse = {
      requestId: message.requestId,
      type: "cache-cleared",
    };
    self.postMessage(response);
    return;
  }

  const position = new Position();
  const processedMoves = position.playSequence(message.sequence);

  if (processedMoves !== message.sequence.length) {
    const response: WorkerResponse = {
      error: `The solver only accepts non-terminal positions. The sequence stops being analyzable at move ${processedMoves + 1}.`,
      ok: false,
      requestId: message.requestId,
      type: "analysis",
    };
    self.postMessage(response);
    return;
  }

  const result = solver.analyzeWithStats(position, message.weak);
  const response: WorkerResponse = {
    ...result,
    ok: true,
    requestId: message.requestId,
    type: "analysis",
  };
  self.postMessage(response);
});
