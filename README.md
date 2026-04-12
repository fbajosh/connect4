# Connect 4 Trainer

Connect 4 Trainer is the live Connect 4 training app at [`appmogged.com/connect4`](https://appmogged.com/connect4), part of the Appmogged fleet at [`appmogged.com`](https://appmogged.com). Its sister app is Minesweeper Trainer at [`appmogged.com/minesweeper`](https://appmogged.com/minesweeper).

This repository is support material for the active website: a place to inspect how the app works, review implementation details, track behavior, and credit the solver work it builds on. The site itself is the primary way to use the app.

This project builds on two upstream solver efforts:

- Pascal Pons' Connect 4 solver
- Benjamin Rall's Rust/WebAssembly solver package [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai), which powers the in-browser exact solve path used here

Please keep both projects credited when reusing or modifying this codebase.

## What It Does

- `Training` mode combines solver-backed analysis with live play against a configurable AI. You can pick player color, switch between fixed color and alternating starts, and set AI difficulty from `1` to `10`.
- Training tools include `Best Move`, `Move Scores`, and `Performance Comparison`. These can stay pinned on or be pulsed temporarily while you play.
- The training AI uses exact solver scores plus temperature-based sampling and an extra pattern-bias layer so lower difficulties feel less mechanical.
- Tactical AI filtering prioritizes immediate wins, blocks immediate opponent wins, avoids moves that give away forced wins when possible, and still tries to block one threat in lose-lose positions where every move remains losing.
- `Freeplay` mode removes the AI and keeps the board available for two human players.
- A built-in `Statistics` modal tracks training results per difficulty with both `Today` and `Lifetime` summaries.
- Tracked metrics include wins, losses, ties, win rate, average win length, average loss length, wins without undo, wins without assist, average game time, and fastest win.
- Training stats are recorded against the lowest AI difficulty that actually played during the game, not just the slider value at the end.
- A per-game timer starts on the first human move, ignores undo, pauses on finish, and resets on board reset.
- Winning discs get an animated sheen so the completed line is easier to spot.
- Finished games can be reset by double-tapping the board, and the interface includes compact mobile-landscape layout handling for both the board and modal views.
- Icon-only controls expose hover tooltips and accessible labels.
- Sound effects and theme music are controlled in-app. Where the browser supports the experimental Audio Session API, the app asks for ambient audio behavior so it can mix more politely with background audio.
- UI preferences, menu state, and training stats persist locally with `localStorage`, while solved positions are cached in IndexedDB.
- The About modal includes instructions, credits, and a build version stamped during deploy.

## Developer Panel

The developer panel is intended for diagnostics and reproducible game reports from the live site.

- It shows the current app version, route mode, move sequence, practice color, effective player color, difficulty, remaining solved line estimate, score share, timer, winner, win-disc count, assist use, undo use, solver output, raw previous scores, pattern adjustments, temperature, tactical filter, RNG, and per-color score history.
- The down-arrow button copies the full developer output.
- The up-arrow button imports either a plain game-state sequence or a full developer output block.
- If full developer output import fails, the app falls back to importing only the game state from the pasted text when it can.

## How It Works

The browser UI is written in TypeScript. Exact client-side solving uses the Rust/WebAssembly package `connect-four-ai-wasm` from Benjamin Rall's [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai). The exact package version used by this repo is vendored locally under [`vendor/connect-four-ai-wasm`](./vendor/connect-four-ai-wasm) so the active app can be rebuilt from the checked-in solver package.

All exact solve work in the shipped web app runs on the visitor's device, not on an Appmogged server. Solved positions are cached in the browser for reuse.

Runtime flow:

1. the UI posts the current move sequence to [`src/optimizer-worker.ts`](./src/optimizer-worker.ts)
2. the worker checks browser-local IndexedDB via [`src/optimizer-cache.ts`](./src/optimizer-cache.ts)
3. on a cache miss, the worker runs the Rust/WASM solver on the visitor's device
4. solved positions are written back to IndexedDB for future reuse

Production builds emit a static PWA app shell, route entry pages, a service worker, a web app manifest, and install icons. After the first successful online load, the installed app can run offline using cached same-origin assets.

## Source Map

- [`src/landing.ts`](./src/landing.ts): DOM wiring, board interaction, mode switching, animations, developer import/export
- [`src/game-rules.ts`](./src/game-rules.ts): shared board constants, turn helpers, win detection
- [`src/practice-ai.ts`](./src/practice-ai.ts): training AI move selection, difficulty temperature, tactical filtering, and pattern-bias logic
- [`src/dev-output.ts`](./src/dev-output.ts): developer panel formatting
- [`src/stats.ts`](./src/stats.ts): persisted training stats and per-difficulty aggregation
- [`src/pwa.ts`](./src/pwa.ts): production service worker registration and cache refresh
- [`src/media.ts`](./src/media.ts): sound effects, theme music control, and browser audio-session hints
- [`src/ui-persistence.ts`](./src/ui-persistence.ts): persisted UI/tool/menu state
- [`src/optimizer-worker.ts`](./src/optimizer-worker.ts): background solver bridge
- [`src/optimizer-cache.ts`](./src/optimizer-cache.ts): IndexedDB cache layer
- [`vendor/connect-four-ai-wasm`](./vendor/connect-four-ai-wasm): vendored Rust/WASM solver package consumed by the app

## Notes

- There is no active legacy C++ or TypeScript solver path left in this repo.
- Installed-app offline support covers the built app shell, routes, audio, icons, images, and solver assets after the first successful online load.
- Google-hosted fonts may fall back offline unless they are self-hosted in a future revision.
- The public production path is `/connect4/`; route entry pages cover `/connect4/training`, `/connect4/freeplay`, and the legacy `/connect4/practice` alias.

## Credits

- Pascal Pons for the original Connect 4 solver work that inspired this project
- Benjamin Rall for the Rust/WASM solver implementation used by this web app: [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai)
