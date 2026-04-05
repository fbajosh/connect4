# Connect 4 Trainer

This is a browser-first Connect 4 training app built with TypeScript and Vite.

This project builds on two upstream solver efforts:

- Pascal Pons' Connect 4 solver
- Benjamin Rall's Rust/WebAssembly solver package [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai), which powers the in-browser exact solve path used here

Please keep both projects credited when reusing or modifying this codebase.

## What It Does

- `Training` mode shows solver-backed hints, move scores, game score, and developer output.
- `Practice` mode lets a player face a solver-driven AI with configurable side and difficulty.
- `Freeplay` mode removes AI and training overlays so two humans can use the board directly.
- UI tool state and menu state persist across reloads with `localStorage`.

## Architecture

The project uses Vite for local development and production builds. The browser UI is written in TypeScript, while exact client-side solving uses the Rust/WebAssembly package `connect-four-ai-wasm` from Benjamin Rall's [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai). The exact package version used by this repo is vendored locally under [`vendor/connect-four-ai-wasm`](./vendor/connect-four-ai-wasm) so future builds do not depend on npm availability.

Runtime flow:

1. the UI posts the current move sequence to [`src/optimizer-worker.ts`](./src/optimizer-worker.ts)
2. the worker checks browser-local IndexedDB via [`src/optimizer-cache.ts`](./src/optimizer-cache.ts)
3. on a cache miss, the worker runs the Rust/WASM solver on the visitor's device
4. solved positions are written back to IndexedDB for future reuse

Main source files:

- [`src/landing.ts`](./src/landing.ts): DOM wiring, board interaction, mode switching, animations
- [`src/game-rules.ts`](./src/game-rules.ts): shared board constants, turn helpers, win detection
- [`src/practice-ai.ts`](./src/practice-ai.ts): Practice-mode AI move selection and temperature logic
- [`src/dev-output.ts`](./src/dev-output.ts): Dev panel formatting and score-bar math
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

## Credits

- Pascal Pons for the original Connect 4 solver work that inspired this project
- Benjamin Rall for the Rust/WASM solver implementation used by this web app: [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai)
