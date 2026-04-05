#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/src/generated"
CACHE_DIR="$ROOT_DIR/.emscripten-cache"

mkdir -p "$OUT_DIR" "$CACHE_DIR"

EM_CACHE="$CACHE_DIR" \
em++ \
  -std=c++17 \
  -O3 \
  "$ROOT_DIR/native/connect4_wasm.cpp" \
  "$ROOT_DIR/native/solver/Solver.cpp" \
  -I"$ROOT_DIR/native/solver" \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_connect4_analyze_json"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall"]' \
  -o "$OUT_DIR/connect4-solver.js"
