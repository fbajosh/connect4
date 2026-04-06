export type GameMode = "training" | "freeplay";
export type FeatureKey = "bestMove" | "moveScores" | "gameScore";
export type PracticeColor = "red" | "yellow" | "alternate";
export type ThemeName = "light" | "dark" | "midnight" | "mogged" | "greece" | "grease";
export type StatsRange = "today" | "all-time";

export type PersistedUiState = {
  audioEnabled?: boolean;
  colorblindMode?: boolean;
  devMode?: boolean;
  modeMenuExpanded?: boolean;
  toolsMenuExpanded?: boolean;
  menuExpanded?: boolean;
  selectedMode?: GameMode;
  practiceColor?: PracticeColor;
  practiceDifficulty?: number;
  statsRange?: StatsRange;
  theme?: ThemeName;
  pinned?: Partial<Record<FeatureKey, boolean>>;
};

export type SolverSource = "local-cache" | "wasm";

export type OptimizerSuccessPayload = {
  bestColumns: number[];
  bestMoves: string;
  elapsedMs?: number;
  nodeCount?: number;
  positionScore: number;
  scores: number[];
  sequence: string;
  source?: SolverSource;
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
