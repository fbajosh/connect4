# Connect 4 Game Solver

This repository is now a browser-friendly TypeScript Connect 4 project in [`src/`](./src).

It is a derivative of Pascal Pons' Connect 4 solver and remains under AGPL v3.

## TypeScript Web App

The project uses Vite for local development and production builds. Before each `dev` or `build`, it also compiles the browser solver from C++ to WASM.

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
2. exported snapshot shards from the native SQLite precompute database
3. exact C++ solver compiled to WASM and run on the visitor's device

When the browser has to solve a missing position itself, that result is written back into IndexedDB so the same user does not recompute it again.

Important limitation:

- a static browser app cannot write directly back into your server-side SQLite file
- the browser "write-back" target is therefore the user's local IndexedDB cache
- if you later want shared write-back into the central SQLite database, you will need a small API endpoint

### Export SQLite Results For Browser Lookup

The browser cannot read the live SQLite file directly. Instead, export the solved rows into static JSON shards:

```bash
npm run export:precomputed -- --database data/connect4_cache.sqlite3
```

That writes shard files under `src/public/precomputed/`, grouped by the first two sequence characters.

### Rebuild The Browser WASM Solver

If you change the C++ browser wrapper or vendored solver, rebuild the WASM artifacts:

```bash
npm run build:wasm
```

## Native Precompute

For exact cached opening solves, the recommended path is the native C++ wrapper in [`native/connect4_precompute.cpp`](./native/connect4_precompute.cpp). It uses a vendored copy of the original solver in [`native/solver/`](./native/solver) and stores frontier and solved results in SQLite.

### Build

```bash
make -C native
```

This writes the binary to `bin/connect4-precompute`.

### Run The Native Cache Builder

```bash
./bin/connect4-precompute \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8
```

Behavior:

- root-first traversal: `1`, `2`, ..., `7`, then `11`, ...
- only completed solved positions are written
- rerunning resumes from the existing SQLite `frontier`
- progress is printed to stderr before, during, and after each position

The native heartbeat shows:

- current sequence
- current depth
- current root move being analyzed
- elapsed time for the full run
- elapsed time for the current position
- node count
- nodes per second
- solved, expanded, and pending counts

To change or disable the heartbeat:

```bash
./bin/connect4-precompute \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8 \
  --heartbeat-seconds 2
```

### Solve One Position Natively

```bash
./bin/connect4-precompute --solve-sequence 445
```

### Optional Opening Book

If you have Pascal Pons' opening book file, you can load it:

```bash
./bin/connect4-precompute \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8 \
  --book /path/to/7x6.book
```

## Incremental Precompute

The easiest exact-cache workflow is a resumable SQLite database that you let grow over time.

The script in [`scripts/precompute_positions.py`](./scripts/precompute_positions.py):

- walks positions breadth-first by move depth
- solves exact move scores for each position it visits
- appends results into SQLite
- remembers unfinished frontier rows so the next run resumes where the last one stopped

### Run A Batch

```bash
python3 scripts/precompute_positions.py \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8
```

Run that and let it continue until you stop it. Each completed position is committed atomically into SQLite. If you interrupt the process while it is still solving a position, that in-progress position is not saved.

When you start it again, it resumes from the existing `frontier` table and continues with the next root-priority position. The script processes positions root-first (`1`, `2`, ..., `7`, then `11`, ...). That is the right order if you want the cache to help the most common early-game positions first, but it also means the first results are the slowest exact solves.

While it runs, the script prints live progress to stderr:

- current sequence being processed
- current depth
- current root move being analyzed
- elapsed time for the whole run
- elapsed time for the current position
- node count
- nodes per second
- solved count
- expanded count
- pending frontier count

The default heartbeat is every 5 seconds. To change or disable it:

```bash
python3 scripts/precompute_positions.py \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8 \
  --heartbeat-seconds 2
```

If you want a smaller controlled run for testing, set an explicit solved-position cap:

```bash
python3 scripts/precompute_positions.py \
  --database data/connect4_cache.sqlite3 \
  --max-depth 8 \
  --batch-size 10
```

### Solve One Position

```bash
python3 scripts/precompute_positions.py --solve-sequence 445
```

That prints exact scores for the given sequence without touching the database.

### Import Existing Results

If you already have solved opening positions, import them into the same SQLite cache before continuing the background run:

```bash
python3 scripts/precompute_positions.py \
  --database data/connect4_cache.sqlite3 \
  --import-file data/opening-seeds.jsonl \
  --batch-size 0
```

Accepted seed formats:

- JSONL with one record per line
- a JSON array of records
- a JSON object keyed by sequence

Minimal record format:

```json
{"sequence":"4","scores":[-1000,-1000,-1000,0,-1000,-1000,-1000]}
```

### Database Tables

- `solved_positions`: exact scores already computed
- `frontier`: queued positions that have been discovered but not expanded yet

Read the associated [step by step tutorial to build a perfect Connect 4 AI](http://blog.gamesolver.org) for explanations.
