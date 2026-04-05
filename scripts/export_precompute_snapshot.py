#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export solved Connect 4 positions from SQLite into browser shard JSON files.",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("data/connect4_cache.sqlite3"),
        help="SQLite database path.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("src/public/precomputed"),
        help="Directory to write shard JSON files into.",
    )
    return parser.parse_args()


def shard_key(sequence: str) -> str:
    if not sequence:
        return "_root"
    return sequence[:2]


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for existing_file in args.output_dir.glob("*.json"):
        existing_file.unlink()

    connection = sqlite3.connect(f"file:{args.database}?mode=ro", uri=True)
    try:
        rows = connection.execute(
            """
            SELECT sequence, best_moves, scores_json, position_score, node_count, elapsed_ms
            FROM solved_positions
            ORDER BY depth, sequence
            """
        ).fetchall()
    finally:
        connection.close()

    shards: dict[str, dict[str, object]] = {}

    for sequence, best_moves, scores_json, position_score, node_count, elapsed_ms in rows:
        sequence = str(sequence)
        scores = json.loads(scores_json)
        shards.setdefault(shard_key(sequence), {})[sequence] = {
            "bestColumns": [int(column) for column in str(best_moves)],
            "bestMoves": str(best_moves),
            "elapsedMs": float(elapsed_ms),
            "nodeCount": int(node_count),
            "positionScore": int(position_score),
            "scores": scores,
            "sequence": sequence,
        }

    for key, payload in shards.items():
        output_path = args.output_dir / f"{key}.json"
        output_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    summary = {
        "database": str(args.database),
        "outputDir": str(args.output_dir),
        "shards": len(shards),
        "solvedPositions": len(rows),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
