export type GameMode = "training" | "practice" | "freeplay";
export type FeatureKey = "bestMove" | "moveScores" | "gameScore" | "devMode";
export type PracticeColor = "red" | "yellow" | "alternate";

export type PersistedUiState = {
  modeMenuExpanded?: boolean;
  toolsMenuExpanded?: boolean;
  menuExpanded?: boolean;
  selectedMode?: GameMode;
  practiceColor?: PracticeColor;
  practiceDifficulty?: number;
  pinned?: Partial<Record<FeatureKey, boolean>>;
};

export type OptimizerSuccessPayload = {
  bestColumns: number[];
  bestMoves: string;
  elapsedMs?: number;
  nodeCount?: number;
  positionScore: number;
  scores: number[];
  sequence: string;
  source?: "local-cache" | "wasm";
};

export type OptimizerErrorPayload = {
  error: string;
  invalidAtMove?: number;
  sequence: string;
};

export type OptimizerWorkerResponse = {
  output: string;
  payload: OptimizerSuccessPayload | OptimizerErrorPayload;
};
