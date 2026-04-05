# Connect 4 Trainer

This repository is now a browser-friendly TypeScript Connect 4 project in [`src/`](./src).

This project builds on two upstream solver efforts:

- Pascal Pons' Connect 4 solver
- Benjamin Rall's Rust/WebAssembly solver package [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai), which powers the in-browser exact solve path used here

Please keep both projects credited when reusing or modifying this codebase.

## TypeScript Web App

The project uses Vite for local development and production builds. The browser UI is written in TypeScript, while exact client-side solving uses the Rust/WebAssembly package `connect-four-ai-wasm` from Benjamin Rall's [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai).

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

## Browser Solver

The web app now resolves solver results in this order:

1. browser-local IndexedDB cache
2. exact Rust solver with its embedded opening book, compiled to WASM and run on the visitor's device

When the browser has to solve a missing position itself, that result is written back into IndexedDB so the same user does not recompute it again.

## Credits

- Pascal Pons for the original Connect 4 solver work that inspired this project
- Benjamin Rall for the Rust/WASM solver implementation used by this web app: [`connect-four-ai`](https://github.com/benjaminrall/connect-four-ai)
