import type { GameMode, PersistedUiState, ThemeName } from "./app-types";

const UI_STATE_STORAGE_KEY = "connect4-trainer-ui-state";
const MODE_SEGMENTS: Record<GameMode, string> = {
  training: "training",
  practice: "practice",
  freeplay: "freeplay",
};

function normalizedBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  return baseUrl.replace(/\/+$/, "");
}

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

export function isThemeName(value: string): value is ThemeName {
  return value === "light" || value === "dark" || value === "midnight" || value === "mogged";
}

export function pathForMode(mode: GameMode): string {
  const basePath = normalizedBasePath();
  return `${basePath}/${MODE_SEGMENTS[mode]}`;
}

export function modeForPathname(pathname: string): GameMode | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const basePath = normalizedBasePath();
  const relativePath =
    basePath && normalizedPath.startsWith(`${basePath}/`)
      ? normalizedPath.slice(basePath.length + 1)
      : normalizedPath === basePath
        ? ""
        : normalizedPath.replace(/^\/+/, "");

  if (relativePath === MODE_SEGMENTS.training) {
    return "training";
  }

  if (relativePath === MODE_SEGMENTS.practice) {
    return "practice";
  }

  if (relativePath === MODE_SEGMENTS.freeplay) {
    return "freeplay";
  }

  return null;
}
