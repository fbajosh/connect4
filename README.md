# Connect 4 Game Solver

This repository is now a browser-friendly TypeScript Connect 4 solver in [`src/`](./src).

It is a derivative of Pascal Pons' Connect 4 solver and remains under AGPL v3.

## TypeScript Web App

The web version keeps the same bitboard representation and negamax search, adapts the cache size for browser memory limits, and runs the solver inside a Web Worker so the UI stays responsive.

### Build

```bash
npm run build
```

This writes a static site to `dist/`.

### Preview Locally

```bash
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

### Deploy

Deploy the contents of `dist/` to any static host:

- GitHub Pages
- Netlify
- Cloudflare Pages
- Vercel static hosting

### Current Differences From The Native Solver

- No opening book is loaded in the web version.
- The transposition table is smaller than the original native build, so some positions will solve more slowly in the browser.

Read the associated [step by step tutorial to build a perfect Connect 4 AI](http://blog.gamesolver.org) for explanations.
