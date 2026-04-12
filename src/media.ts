import type { ThemeName } from "./app-types";

export type SoundEffectKey = "board-reset" | "disc-drop" | "lose" | "mogg" | "tie" | "undo" | "win";

type ThemeMusicKey = "greece" | "grease" | "mogged";
type ThemeMusicSource = "mid" | "ogg" | "mp3";
type ThemeMusicState = {
  audio: HTMLAudioElement;
  source: ThemeMusicSource;
};
type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
type NavigatorWithAudioSession = Navigator & {
  audioSession?: {
    type: AudioSessionType;
  };
};

const loadedThemeFonts = new Set<ThemeName>();

function themeFontHref(theme: ThemeName): string | null {
  if (theme === "greece") {
    return "https://fonts.googleapis.com/css2?family=Caesar+Dressing&display=swap";
  }

  if (theme === "grease") {
    return "https://fonts.googleapis.com/css2?family=Atomic+Age&display=swap";
  }

  return null;
}

export function ensureThemeFont(theme: ThemeName): void {
  if (loadedThemeFonts.has(theme)) {
    return;
  }

  const href = themeFontHref(theme);
  if (!href) {
    loadedThemeFonts.add(theme);
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
  loadedThemeFonts.add(theme);
}

function isThemeMusicKey(theme: ThemeName): theme is ThemeMusicKey {
  return theme === "greece" || theme === "grease" || theme === "mogged";
}

function preferredThemeMusicSource(theme: ThemeMusicKey): ThemeMusicSource {
  if (theme === "mogged") {
    return "mp3";
  }

  const probe = document.createElement("audio");
  const midiSupport =
    probe.canPlayType("audio/midi") ||
    probe.canPlayType("audio/x-midi") ||
    probe.canPlayType("audio/mid");

  return midiSupport ? "mid" : "ogg";
}

function themeMusicUrl(theme: ThemeMusicKey, source: ThemeMusicSource): string {
  const baseName = theme === "mogged" ? "appmogged-music" : `${theme}-music`;
  return `${import.meta.env.BASE_URL}${baseName}.${source}`;
}

function soundEffectUrl(effect: SoundEffectKey): string {
  return `${import.meta.env.BASE_URL}${effect}.mp3`;
}

function requestAmbientAudioSession(): void {
  const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
  if (!audioSession) {
    return;
  }

  try {
    audioSession.type = "ambient";
  } catch {
    // The Audio Session API is experimental and may reject unsupported types.
  }
}

function themeMusicStartOffset(theme: ThemeMusicKey, source: ThemeMusicSource): number {
  if (theme === "grease" && source === "ogg") {
    return 11;
  }

  return 0;
}

export function createAudioController() {
  const themeMusicAudio = new Map<ThemeMusicKey, ThemeMusicState>();
  const soundEffectAudio = new Map<SoundEffectKey, HTMLAudioElement>();
  let hasBoardInteraction = false;

  requestAmbientAudioSession();

  function switchThemeMusicSource(
    state: ThemeMusicState,
    theme: ThemeMusicKey,
    source: ThemeMusicSource,
  ): void {
    if (state.source === source) {
      return;
    }

    state.source = source;
    state.audio.pause();
    state.audio.currentTime = 0;
    state.audio.src = themeMusicUrl(theme, source);
    state.audio.load();
  }

  function primeThemeMusicPosition(state: ThemeMusicState, theme: ThemeMusicKey): void {
    const offset = themeMusicStartOffset(theme, state.source);
    if (offset <= 0) {
      return;
    }

    if (!state.audio.paused || state.audio.currentTime > 0.25) {
      return;
    }

    const seekToOffset = () => {
      try {
        state.audio.currentTime = offset;
      } catch {
        // Ignore seek failures; playback can still proceed from the start.
      }
    };

    if (state.audio.readyState >= 1) {
      seekToOffset();
      return;
    }

    state.audio.addEventListener("loadedmetadata", seekToOffset, { once: true });
  }

  function ensureThemeMusicAudio(theme: ThemeMusicKey): ThemeMusicState {
    const existingAudio = themeMusicAudio.get(theme);
    if (existingAudio) {
      return existingAudio;
    }

    const source = preferredThemeMusicSource(theme);
    const audio = new Audio(themeMusicUrl(theme, source));
    audio.loop = true;
    audio.volume = 0.45;
    audio.preload = "auto";

    const state: ThemeMusicState = {
      audio,
      source,
    };

    audio.addEventListener("error", () => {
      if (state.source !== "mid") {
        return;
      }

      switchThemeMusicSource(state, theme, "ogg");
    });

    themeMusicAudio.set(theme, state);
    return state;
  }

  function playThemeMusic(theme: ThemeMusicKey): void {
    if (theme === "mogged" && !hasBoardInteraction) {
      return;
    }

    requestAmbientAudioSession();
    const state = ensureThemeMusicAudio(theme);
    primeThemeMusicPosition(state, theme);

    void state.audio.play().catch((error: unknown) => {
      if (state.source === "mid" && error instanceof DOMException && error.name === "NotSupportedError") {
        switchThemeMusicSource(state, theme, "ogg");
        primeThemeMusicPosition(state, theme);
        void state.audio.play().catch(() => {
          // Background playback may still be blocked or unsupported.
        });
      }
    });
  }

  function ensureSoundEffectAudio(effect: SoundEffectKey): HTMLAudioElement {
    const existingAudio = soundEffectAudio.get(effect);
    if (existingAudio) {
      return existingAudio;
    }

    const audio = new Audio(soundEffectUrl(effect));
    audio.preload = "auto";
    audio.volume = 0.72;
    soundEffectAudio.set(effect, audio);
    return audio;
  }

  return {
    noteBoardInteraction(): boolean {
      const isFirstInteraction = !hasBoardInteraction;
      hasBoardInteraction = true;
      return isFirstInteraction;
    },
    pauseAll(): void {
      for (const { audio } of themeMusicAudio.values()) {
        audio.pause();
        audio.currentTime = 0;
      }

      for (const audio of soundEffectAudio.values()) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
    playSoundEffect(effect: SoundEffectKey, audioEnabled: boolean): void {
      if (!audioEnabled) {
        return;
      }

      requestAmbientAudioSession();
      const audio = ensureSoundEffectAudio(effect);
      audio.pause();
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Playback may be blocked or unsupported.
      });
    },
    syncThemeAudio(
      theme: ThemeName,
      options: { allowPlayback: boolean; audioEnabled: boolean },
    ): void {
      for (const [musicTheme, state] of themeMusicAudio) {
        if (musicTheme !== theme) {
          state.audio.pause();
          state.audio.currentTime = 0;
        }
      }

      if (!options.audioEnabled || !options.allowPlayback || !isThemeMusicKey(theme)) {
        return;
      }

      playThemeMusic(theme);
    },
  };
}
