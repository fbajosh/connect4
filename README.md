# Connect 4 Trainer

This is a browser-first Connect 4 training app built with TypeScript and Vite.

This project builds on two upstream solver efforts:

- Pascal Pons' Connect 4 solver
- Benjamin Rall's Rust/WebAssembly solver package [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai), which powers the in-browser exact solve path used here

Please keep both projects credited when reusing or modifying this codebase.

## What It Does

- `Training` mode combines solver-backed analysis with live play against a configurable AI. You can pick player color, switch between fixed color and alternating starts, and set AI difficulty from `1` to `10`.
- Training tools include `Best Move`, `Move Scores`, and `Performance Comparison`. These can stay pinned on or be pulsed temporarily while you play.
- The training AI uses exact solver scores plus temperature-based sampling and an extra pattern-bias layer so lower difficulties feel less mechanical.
- `Freeplay` mode removes the AI and keeps the board available for two human players.
- A built-in `Statistics` modal tracks training results per difficulty with both `Today` and `Lifetime` summaries.
- Tracked metrics include wins, losses, ties, win rate, average win length, average loss length, wins without undo, wins without assist, average game time, and fastest win.
- Training stats are recorded against the lowest AI difficulty that actually played during the game, not just the slider value at the end.
- A per-game timer starts on the first human move, ignores undo, and resets on finish or board reset.
- The developer panel can import/export board state and shows raw solver scores, pattern adjustments, timer state, assist usage, and undo usage.
- Finished games can be reset by double-tapping the board, and the interface includes compact mobile-landscape layout handling for both the board and modal views.
- The About modal includes instructions, credits, and a build version stamped during deploy.
- UI preferences, menu state, and training stats persist locally with `localStorage`, while solved positions are cached in IndexedDB.

## Architecture

The project uses Vite for local development and production builds. The browser UI is written in TypeScript, while exact client-side solving uses the Rust/WebAssembly package `connect-four-ai-wasm` from Benjamin Rall's [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai). The exact package version used by this repo is vendored locally under [`vendor/connect-four-ai-wasm`](./vendor/connect-four-ai-wasm) so future builds do not depend on npm availability.

Production builds also emit a web app manifest, service worker, and installable icon set so the site can run as an installed PWA or Home Screen web app. After the first successful online load, the installed app can run fully offline using cached same-origin assets.

Runtime flow:

1. the UI posts the current move sequence to [`src/optimizer-worker.ts`](./src/optimizer-worker.ts)
2. the worker checks browser-local IndexedDB via [`src/optimizer-cache.ts`](./src/optimizer-cache.ts)
3. on a cache miss, the worker runs the Rust/WASM solver on the visitor's device
4. solved positions are written back to IndexedDB for future reuse

Main source files:

- [`src/landing.ts`](./src/landing.ts): DOM wiring, board interaction, mode switching, animations
- [`src/game-rules.ts`](./src/game-rules.ts): shared board constants, turn helpers, win detection
- [`src/practice-ai.ts`](./src/practice-ai.ts): training AI move selection, difficulty temperature, and pattern-bias logic
- [`src/dev-output.ts`](./src/dev-output.ts): Dev panel formatting and score-bar math
- [`src/stats.ts`](./src/stats.ts): persisted training stats and per-difficulty aggregation
- [`src/pwa.ts`](./src/pwa.ts): production service worker registration
- [`src/media.ts`](./src/media.ts): sound effects and theme music control
- [`src/ui-persistence.ts`](./src/ui-persistence.ts): persisted UI/tool/menu state
- [`src/optimizer-worker.ts`](./src/optimizer-worker.ts): background solver bridge
- [`src/optimizer-cache.ts`](./src/optimizer-cache.ts): IndexedDB cache layer
- [`vendor/connect-four-ai-wasm`](./vendor/connect-four-ai-wasm): vendored Rust/WASM solver package consumed by the app

### Install

```bash
npm install
```

### Live Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

This writes a static site to `dist/`.

The production build includes:

- route entry pages for `training`, `freeplay`, and the legacy `practice` alias
- a generated service worker for offline use
- `manifest.webmanifest` and install icons for PWA / Home Screen installs

### Preview Locally

```bash
npm run preview
```

Vite prints the preview URL in the terminal.

### Deploy

Deploy the contents of `dist/` to any static host:

- GitHub Pages
- Netlify
- Cloudflare Pages
- Vercel static hosting

This repo also includes a GitHub Actions workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) that can build the site on GitHub and sync `dist/` to a VM over SSH.

#### GitHub Actions VM Deploy

The workflow runs on pushes to `main` and on manual dispatch. It keeps the VM address and SSH key out of the public YAML by loading them from GitHub Actions secrets.

The production build is configured for deployment at `/connect4/`. If the public URL path changes, update [`vite.config.mjs`](./vite.config.mjs).

The deploy workflow also stamps a build version in `YYMMDD.hhmmss` UTC format, which is shown inside the Credits tab of the About modal.

Create a `production` environment in GitHub and add these secrets there:

- `DEPLOY_SSH_HOST`: VM hostname or IP address
- `DEPLOY_SSH_USER`: SSH user for deployment
- `DEPLOY_SSH_PORT`: optional SSH port, for example `22`
- `DEPLOY_SSH_KEY`: private key for the deploy user
- `DEPLOY_SSH_KNOWN_HOSTS`: the VM's `known_hosts` line
- `DEPLOY_TARGET_DIR`: absolute directory on the VM that should receive `dist/`

Recommended setup:

1. Generate a dedicated deploy keypair on your machine with `ssh-keygen -t ed25519 -f ~/.ssh/connect4_deploy`.
2. Add the public key to the deploy user's `~/.ssh/authorized_keys` on the VM.
3. Capture the server host key locally with `ssh-keyscan -H your-vm-host`.
4. Save the private key and `ssh-keyscan` output in the GitHub environment secrets above.
5. Point `DEPLOY_TARGET_DIR` at the directory served by your web server, for example `/var/www/connect4`.

The workflow uses `rsync --delete`, so the target directory should be reserved for this site's built files.

## Notes

- All exact solve work in the shipped web app runs on the end user's device, not on your server.
- There is no active legacy C++ or TypeScript solver path left in this repo.
- The Rust/WASM solver package is vendored locally, so installs do not depend on the upstream npm package staying online.
- A production build writes a static site to `dist/`.
- The production build also emits route entry pages for `/connect4/training`, `/connect4/freeplay`, and the legacy `/connect4/practice` alias so direct loads work on static hosts without additional rewrites.
- Installed-app offline support covers the built app shell, routes, audio, icons, images, and solver assets after the first successful online load.
- Google-hosted fonts may fall back offline unless they are self-hosted in a future revision.

## Credits

- Pascal Pons for the original Connect 4 solver work that inspired this project
- Benjamin Rall for the Rust/WASM solver implementation used by this web app: [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai)
