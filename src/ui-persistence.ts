import type { GameMode, PersistedUiState } from "./app-types";

const UI_STATE_STORAGE_KEY = "connect4-trainer-ui-state";

export function readPersistedUiState(): PersistedUiState {
  try {
    const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PersistedUiState;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function writePersistedUiState(state: PersistedUiState): void {
  try {
    window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures; the UI still works without persistence.
  }
}

export function modeLabel(mode: GameMode): string {
  if (mode === "practice") {
    return "Practice";
  }

  if (mode === "freeplay") {
    return "Freeplay";
  }

  return "Training";
}

export function titleForMode(mode: GameMode): string {
  return `Connect 4 Trainer - ${modeLabel(mode)}`;
}
