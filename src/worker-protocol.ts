export type AnalyzeRequest = {
  requestId: number;
  sequence: string;
  type: "analyze";
  weak: boolean;
};

export type ClearCacheRequest = {
  requestId: number;
  type: "clear-cache";
};

export type WorkerRequest = AnalyzeRequest | ClearCacheRequest;

export type AnalysisSuccess = {
  bestColumns: number[];
  elapsedMs: number;
  nodeCount: number;
  ok: true;
  positionScore: number;
  requestId: number;
  scores: number[];
  type: "analysis";
};

export type AnalysisFailure = {
  error: string;
  ok: false;
  requestId: number;
  type: "analysis";
};

export type CacheCleared = {
  requestId: number;
  type: "cache-cleared";
};

export type WorkerResponse = AnalysisSuccess | AnalysisFailure | CacheCleared;
