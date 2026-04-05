#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import threading
import time
from array import array
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path


WIDTH = 7
HEIGHT = 6
BOARD_SIZE = WIDTH * HEIGHT
INVALID_MOVE = -1000
MIN_SCORE = -(BOARD_SIZE // 2) + 3
MAX_SCORE = ((BOARD_SIZE + 1) // 2) - 3
DEFAULT_TABLE_SIZE = 2_097_169
MASK_64 = (1 << 64) - 1

COLUMN_ORDER = [WIDTH // 2 + (1 - 2 * (index % 2)) * ((index + 1) // 2) for index in range(WIDTH)]
BOTTOM_MASK = sum(1 << (column * (HEIGHT + 1)) for column in range(WIDTH))
BOARD_MASK = BOTTOM_MASK * ((1 << HEIGHT) - 1)


def column_mask(column: int) -> int:
    return ((1 << HEIGHT) - 1) << (column * (HEIGHT + 1))


def bottom_mask_col(column: int) -> int:
    return 1 << (column * (HEIGHT + 1))


def top_mask_col(column: int) -> int:
    return 1 << ((HEIGHT - 1) + column * (HEIGHT + 1))


class Position:
    __slots__ = ("current_position", "mask", "moves")

    def __init__(self) -> None:
        self.current_position = 0
        self.mask = 0
        self.moves = 0

    def clone(self) -> "Position":
        copy = Position()
        copy.current_position = self.current_position
        copy.mask = self.mask
        copy.moves = self.moves
        return copy

    def play(self, move: int) -> None:
        self.current_position ^= self.mask
        self.mask |= move
        self.moves += 1

    def play_col(self, column: int) -> None:
        self.play((self.mask + bottom_mask_col(column)) & column_mask(column))

    def play_sequence(self, sequence: str) -> int:
        for index, raw_column in enumerate(sequence):
            column = ord(raw_column) - ord("1")
            if column < 0 or column >= WIDTH or not self.can_play(column) or self.is_winning_move(column):
                return index
            self.play_col(column)
        return len(sequence)

    def can_play(self, column: int) -> bool:
        return (self.mask & top_mask_col(column)) == 0

    def can_win_next(self) -> bool:
        return (self.winning_position() & self.possible()) != 0

    def nb_moves(self) -> int:
        return self.moves

    def key(self) -> int:
        return self.current_position + self.mask

    def possible(self) -> int:
        return (self.mask + BOTTOM_MASK) & BOARD_MASK

    def winning_position(self) -> int:
        return self.compute_winning_position(self.current_position, self.mask)

    def opponent_winning_position(self) -> int:
        return self.compute_winning_position(self.current_position ^ self.mask, self.mask)

    def is_winning_move(self, column: int) -> bool:
        return (self.winning_position() & self.possible() & column_mask(column)) != 0

    def possible_non_losing_moves(self) -> int:
        if self.can_win_next():
            raise ValueError("possible_non_losing_moves() requires a position without an immediate win.")

        possible_mask = self.possible()
        opponent_win = self.opponent_winning_position()
        forced_moves = possible_mask & opponent_win

        if forced_moves != 0:
            if (forced_moves & (forced_moves - 1)) != 0:
                return 0
            possible_mask = forced_moves

        return possible_mask & ~(opponent_win >> 1)

    def move_score(self, move: int) -> int:
        return self.popcount(self.compute_winning_position(self.current_position | move, self.mask))

    @staticmethod
    def popcount(mask: int) -> int:
        count = 0
        current_mask = mask
        while current_mask:
            current_mask &= current_mask - 1
            count += 1
        return count

    @staticmethod
    def compute_winning_position(position: int, mask: int) -> int:
        result = (position << 1) & (position << 2) & (position << 3)

        horizontal_step = HEIGHT + 1
        partial = (position << horizontal_step) & (position << (2 * horizontal_step))
        result |= partial & (position << (3 * horizontal_step))
        result |= partial & (position >> horizontal_step)
        partial = (position >> horizontal_step) & (position >> (2 * horizontal_step))
        result |= partial & (position << horizontal_step)
        result |= partial & (position >> (3 * horizontal_step))

        diagonal_down_step = HEIGHT
        partial = (position << diagonal_down_step) & (position << (2 * diagonal_down_step))
        result |= partial & (position << (3 * diagonal_down_step))
        result |= partial & (position >> diagonal_down_step)
        partial = (position >> diagonal_down_step) & (position >> (2 * diagonal_down_step))
        result |= partial & (position << diagonal_down_step)
        result |= partial & (position >> (3 * diagonal_down_step))

        diagonal_up_step = HEIGHT + 2
        partial = (position << diagonal_up_step) & (position << (2 * diagonal_up_step))
        result |= partial & (position << (3 * diagonal_up_step))
        result |= partial & (position >> diagonal_up_step)
        partial = (position >> diagonal_up_step) & (position >> (2 * diagonal_up_step))
        result |= partial & (position << diagonal_up_step)
        result |= partial & (position >> (3 * diagonal_up_step))

        return result & (BOARD_MASK ^ mask)


class MoveSorter:
    __slots__ = ("entries",)

    def __init__(self) -> None:
        self.entries: list[tuple[int, int]] = []

    def add(self, move: int, score: int) -> None:
        position = len(self.entries)
        self.entries.append((score, move))
        while position > 0 and self.entries[position - 1][0] > score:
            self.entries[position] = self.entries[position - 1]
            position -= 1
        self.entries[position] = (score, move)

    def get_next(self) -> int:
        return 0 if not self.entries else self.entries.pop()[1]


class TranspositionTable:
    __slots__ = ("keys", "size", "values")

    def __init__(self, size: int = DEFAULT_TABLE_SIZE) -> None:
        self.size = size
        self.keys = array("Q", [0]) * size
        self.values = bytearray(size)

    def get(self, key: int) -> int:
        index = key % self.size
        packed = key & MASK_64
        return self.values[index] if self.keys[index] == packed else 0

    def put(self, key: int, value: int) -> None:
        index = key % self.size
        self.keys[index] = key & MASK_64
        self.values[index] = value


@dataclass
class SolveRecord:
    sequence: str
    depth: int
    best_moves: str
    scores: list[int]
    position_score: int
    node_count: int
    elapsed_ms: float


@dataclass
class ProgressSnapshot:
    current_depth: int = 0
    current_move_column: int = 0
    current_move_index: int = 0
    current_sequence: str = ""
    expanded_this_run: int = 0
    legal_move_count: int = 0
    node_count: int = 0
    pending: int = 0
    row_started_at: float = 0.0
    solved_this_run: int = 0
    working: bool = False


class ProgressReporter:
    def __init__(self, heartbeat_seconds: float) -> None:
        self.heartbeat_seconds = max(heartbeat_seconds, 0.0)
        self.started_at = time.perf_counter()
        self.snapshot = ProgressSnapshot()
        self.lock = threading.Lock()
        self.node_count_getter: Callable[[], int] | None = None
        self.stop_event = threading.Event()
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        if self.heartbeat_seconds <= 0:
            return

        self.thread = threading.Thread(target=self._run, name="progress-reporter", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread is not None:
            self.thread.join()

    def attach_node_counter(self, getter: Callable[[], int]) -> None:
        with self.lock:
            self.node_count_getter = getter

    def begin_row(self, sequence: str, depth: int, solved_this_run: int, expanded_this_run: int, pending: int) -> None:
        with self.lock:
            self.snapshot.current_depth = depth
            self.snapshot.current_move_column = 0
            self.snapshot.current_move_index = 0
            self.snapshot.current_sequence = sequence
            self.snapshot.expanded_this_run = expanded_this_run
            self.snapshot.legal_move_count = 0
            self.snapshot.node_count = 0
            self.snapshot.pending = pending
            self.snapshot.row_started_at = time.perf_counter()
            self.snapshot.solved_this_run = solved_this_run
            self.snapshot.working = True

        self._emit("Starting")

    def begin_move(self, column: int, move_index: int, legal_move_count: int) -> None:
        with self.lock:
            self.snapshot.current_move_column = column
            self.snapshot.current_move_index = move_index
            self.snapshot.legal_move_count = legal_move_count

    def finish_row(self, solved_this_run: int, expanded_this_run: int, pending: int) -> None:
        with self.lock:
            self.snapshot.expanded_this_run = expanded_this_run
            self.snapshot.pending = pending
            self.snapshot.solved_this_run = solved_this_run
            if self.node_count_getter is not None:
                self.snapshot.node_count = self.node_count_getter()

        self._emit("Completed")

        with self.lock:
            self.snapshot.working = False

    def interrupt_row(self, pending: int) -> None:
        with self.lock:
            self.snapshot.pending = pending

        self._emit("Interrupted")

        with self.lock:
            self.snapshot.working = False

    def _run(self) -> None:
        while not self.stop_event.wait(self.heartbeat_seconds):
            with self.lock:
                if not self.snapshot.working:
                    continue
            self._emit("Heartbeat")

    def _emit(self, event: str) -> None:
        with self.lock:
            if self.node_count_getter is not None:
                self.snapshot.node_count = self.node_count_getter()
            snapshot = ProgressSnapshot(
                current_depth=self.snapshot.current_depth,
                current_move_column=self.snapshot.current_move_column,
                current_move_index=self.snapshot.current_move_index,
                current_sequence=self.snapshot.current_sequence,
                expanded_this_run=self.snapshot.expanded_this_run,
                legal_move_count=self.snapshot.legal_move_count,
                node_count=self.snapshot.node_count,
                pending=self.snapshot.pending,
                row_started_at=self.snapshot.row_started_at,
                solved_this_run=self.snapshot.solved_this_run,
                working=self.snapshot.working,
            )

        total_elapsed = time.perf_counter() - self.started_at
        row_elapsed = 0.0 if snapshot.row_started_at == 0 else time.perf_counter() - snapshot.row_started_at
        sequence_label = "<root>" if snapshot.current_sequence == "" else snapshot.current_sequence
        nodes_per_second = 0.0 if row_elapsed <= 0 else snapshot.node_count / row_elapsed
        move_label = "-"
        if snapshot.legal_move_count > 0 and snapshot.current_move_index > 0 and snapshot.current_move_column > 0:
            move_label = (
                f"{snapshot.current_move_index}/{snapshot.legal_move_count}"
                f"(col={snapshot.current_move_column})"
            )
        print(
            (
                f"[{total_elapsed:8.1f}s] {event}: "
                f"sequence={sequence_label} "
                f"depth={snapshot.current_depth} "
                f"move={move_label} "
                f"rowElapsed={row_elapsed:7.1f}s "
                f"nodes={snapshot.node_count} "
                f"nps={nodes_per_second:9.0f} "
                f"solved={snapshot.solved_this_run} "
                f"expanded={snapshot.expanded_this_run} "
                f"pending={snapshot.pending}"
            ),
            file=sys.stderr,
            flush=True,
        )


class Solver:
    def __init__(
        self,
        table_size: int = DEFAULT_TABLE_SIZE,
        move_progress_callback: Callable[[int, int, int], None] | None = None,
    ) -> None:
        self.node_count = 0
        self.move_progress_callback = move_progress_callback
        self.trans_table = TranspositionTable(table_size)

    def solve(self, position: Position) -> int:
        if position.can_win_next():
            return (BOARD_SIZE + 1 - position.nb_moves()) // 2

        minimum = -(BOARD_SIZE - position.nb_moves()) // 2
        maximum = (BOARD_SIZE + 1 - position.nb_moves()) // 2

        while minimum < maximum:
            median = minimum + (maximum - minimum) // 2
            if median <= 0 and minimum // 2 < median:
                median = minimum // 2
            elif median >= 0 and maximum // 2 > median:
                median = maximum // 2

            result = self.negamax(position, median, median + 1)
            if result <= median:
                maximum = result
            else:
                minimum = result

        return minimum

    def analyze(self, position: Position) -> list[int]:
        scores = [INVALID_MOVE] * WIDTH
        playable_columns = [column for column in range(WIDTH) if position.can_play(column)]
        legal_move_count = len(playable_columns)

        for move_index, column in enumerate(playable_columns, start=1):
            if self.move_progress_callback is not None:
                self.move_progress_callback(column + 1, move_index, legal_move_count)

            if position.is_winning_move(column):
                scores[column] = (BOARD_SIZE + 1 - position.nb_moves()) // 2
                continue

            next_position = position.clone()
            next_position.play_col(column)
            scores[column] = -self.solve(next_position)

        return scores

    def solve_record(self, sequence: str) -> SolveRecord:
        position = Position()
        processed_moves = position.play_sequence(sequence)
        if processed_moves != len(sequence):
            raise ValueError(f"Sequence becomes invalid at move {processed_moves + 1}: {sequence}")

        self.node_count = 0
        started_at = time.perf_counter()
        scores = self.analyze(position)
        elapsed_ms = (time.perf_counter() - started_at) * 1000

        best_moves, position_score = derive_best_moves(scores)

        return SolveRecord(
            sequence=sequence,
            depth=len(sequence),
            best_moves=best_moves,
            scores=scores,
            position_score=position_score,
            node_count=self.node_count,
            elapsed_ms=elapsed_ms,
        )

    def negamax(self, position: Position, alpha: int, beta: int) -> int:
        if alpha >= beta:
            raise ValueError("negamax() requires alpha < beta.")
        if position.can_win_next():
            raise ValueError("negamax() does not support positions with an immediate win.")

        self.node_count += 1

        possible = position.possible_non_losing_moves()
        if possible == 0:
            return -(BOARD_SIZE - position.nb_moves()) // 2

        if position.nb_moves() >= BOARD_SIZE - 2:
            return 0

        minimum = -(BOARD_SIZE - 2 - position.nb_moves()) // 2
        if alpha < minimum:
            alpha = minimum
            if alpha >= beta:
                return alpha

        maximum = (BOARD_SIZE - 1 - position.nb_moves()) // 2
        if beta > maximum:
            beta = maximum
            if alpha >= beta:
                return beta

        key = position.key()
        cached_value = self.trans_table.get(key)
        if cached_value != 0:
            if cached_value > MAX_SCORE - MIN_SCORE + 1:
                minimum = cached_value + 2 * MIN_SCORE - MAX_SCORE - 2
                if alpha < minimum:
                    alpha = minimum
                    if alpha >= beta:
                        return alpha
            else:
                maximum = cached_value + MIN_SCORE - 1
                if beta > maximum:
                    beta = maximum
                    if alpha >= beta:
                        return beta

        moves = MoveSorter()
        for order_index in range(WIDTH - 1, -1, -1):
            move = possible & column_mask(COLUMN_ORDER[order_index])
            if move != 0:
                moves.add(move, position.move_score(move))

        next_move = moves.get_next()
        while next_move != 0:
            next_position = position.clone()
            next_position.play(next_move)
            score = -self.negamax(next_position, -beta, -alpha)

            if score >= beta:
                self.trans_table.put(key, score + MAX_SCORE - 2 * MIN_SCORE + 2)
                return score

            if score > alpha:
                alpha = score

            next_move = moves.get_next()

        self.trans_table.put(key, alpha - MIN_SCORE + 1)
        return alpha


def enumerate_children(sequence: str) -> list[str]:
    position = Position()
    processed_moves = position.play_sequence(sequence)
    if processed_moves != len(sequence):
        raise ValueError(f"Sequence becomes invalid at move {processed_moves + 1}: {sequence}")

    children: list[str] = []
    for column in range(WIDTH):
        if position.can_play(column) and not position.is_winning_move(column):
            children.append(sequence + str(column + 1))
    return children


def connect_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute("PRAGMA synchronous=NORMAL;")
    return connection


def derive_best_moves(scores: list[int]) -> tuple[str, int]:
    valid_scores = [(index, score) for index, score in enumerate(scores) if score != INVALID_MOVE]
    if not valid_scores:
        return "", 0

    position_score = max(score for _, score in valid_scores)
    best_moves = "".join(str(index + 1) for index, score in valid_scores if score == position_score)
    return best_moves, position_score


def normalize_import_record(raw_record: object) -> SolveRecord:
    if not isinstance(raw_record, dict):
        raise ValueError("Imported records must be JSON objects.")

    if "sequence" not in raw_record:
        raise ValueError("Imported records must include a sequence field.")
    if "scores" not in raw_record:
        raise ValueError("Imported records must include a scores field.")

    sequence = str(raw_record["sequence"])
    scores = [int(score) for score in raw_record["scores"]]
    if len(scores) != WIDTH:
        raise ValueError(f"Sequence {sequence!r} has {len(scores)} scores; expected {WIDTH}.")

    position = Position()
    processed_moves = position.play_sequence(sequence)
    if processed_moves != len(sequence):
        raise ValueError(f"Imported sequence becomes invalid at move {processed_moves + 1}: {sequence}")

    best_moves, position_score = derive_best_moves(scores)

    return SolveRecord(
        sequence=sequence,
        depth=len(sequence),
        best_moves=best_moves,
        scores=scores,
        position_score=position_score,
        node_count=int(raw_record.get("node_count", 0)),
        elapsed_ms=float(raw_record.get("elapsed_ms", 0)),
    )


def load_import_records(path: Path) -> list[SolveRecord]:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if not stripped:
        return []

    def build_records(payload: object) -> list[SolveRecord]:
        if isinstance(payload, list):
            return [normalize_import_record(item) for item in payload]

        if isinstance(payload, dict):
            if "sequence" in payload:
                return [normalize_import_record(payload)]

            records: list[SolveRecord] = []
            for sequence, value in payload.items():
                if isinstance(value, dict):
                    record = {"sequence": sequence, **value}
                else:
                    record = {"sequence": sequence, "scores": value}
                records.append(normalize_import_record(record))
            return records

        raise ValueError("Import file must be JSON, JSONL, or a JSON object keyed by sequence.")

    if stripped[0] in "[{":
        try:
            return build_records(json.loads(text))
        except json.JSONDecodeError:
            pass

    return [normalize_import_record(json.loads(line)) for line in text.splitlines() if line.strip()]


def init_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS frontier (
          sequence TEXT PRIMARY KEY,
          depth INTEGER NOT NULL,
          expanded INTEGER NOT NULL DEFAULT 0,
          discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS frontier_pending_idx
          ON frontier(expanded, depth, sequence);

        CREATE TABLE IF NOT EXISTS solved_positions (
          sequence TEXT PRIMARY KEY,
          depth INTEGER NOT NULL,
          best_moves TEXT NOT NULL,
          scores_json TEXT NOT NULL,
          position_score INTEGER NOT NULL,
          node_count INTEGER NOT NULL,
          elapsed_ms REAL NOT NULL,
          solved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    connection.execute(
        "INSERT OR IGNORE INTO frontier (sequence, depth, expanded) VALUES (?, ?, 0)",
        ("", 0),
    )
    connection.commit()


def import_records(connection: sqlite3.Connection, records: list[SolveRecord]) -> int:
    imported = 0
    for record in records:
        store_record(connection, record)
        connection.execute(
            "INSERT OR IGNORE INTO frontier (sequence, depth, expanded) VALUES (?, ?, 0)",
            (record.sequence, record.depth),
        )
        imported += 1
    connection.commit()
    return imported


def next_frontier_row(connection: sqlite3.Connection, max_depth: int) -> tuple[str, int] | None:
    row = connection.execute(
        """
        SELECT sequence, depth
        FROM frontier
        WHERE expanded = 0 AND depth <= ?
        ORDER BY depth, sequence
        LIMIT 1
        """,
        (max_depth,),
    ).fetchone()
    return None if row is None else (str(row[0]), int(row[1]))


def already_solved(connection: sqlite3.Connection, sequence: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM solved_positions WHERE sequence = ? LIMIT 1",
        (sequence,),
    ).fetchone()
    return row is not None


def store_children(connection: sqlite3.Connection, sequence: str, depth: int, max_depth: int) -> int:
    if depth >= max_depth:
        return 0

    children = enumerate_children(sequence)
    connection.executemany(
        "INSERT OR IGNORE INTO frontier (sequence, depth, expanded) VALUES (?, ?, 0)",
        ((child, depth + 1) for child in children),
    )
    return len(children)


def store_record(connection: sqlite3.Connection, record: SolveRecord) -> None:
    connection.execute(
        """
        INSERT OR REPLACE INTO solved_positions (
          sequence, depth, best_moves, scores_json, position_score, node_count, elapsed_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.sequence,
            record.depth,
            record.best_moves,
            json.dumps(record.scores),
            record.position_score,
            record.node_count,
            record.elapsed_ms,
        ),
    )


def mark_expanded(connection: sqlite3.Connection, sequence: str) -> None:
    connection.execute("UPDATE frontier SET expanded = 1 WHERE sequence = ?", (sequence,))


def frontier_stats(connection: sqlite3.Connection) -> tuple[int, int]:
    pending = int(connection.execute("SELECT COUNT(*) FROM frontier WHERE expanded = 0").fetchone()[0])
    solved = int(connection.execute("SELECT COUNT(*) FROM solved_positions").fetchone()[0])
    return pending, solved


def run_batch(
    connection: sqlite3.Connection,
    solver: Solver,
    batch_size: int,
    max_depth: int,
    progress_reporter: ProgressReporter,
    solve_root: bool,
) -> dict[str, int | float | bool]:
    solved_this_run = 0
    expanded_this_run = 0
    discovered_this_run = 0
    interrupted = False
    progress_reporter.attach_node_counter(lambda: solver.node_count)
    progress_reporter.start()

    try:
        while batch_size <= 0 or solved_this_run < batch_size:
            frontier_row = next_frontier_row(connection, max_depth)
            if frontier_row is None:
                break

            sequence, depth = frontier_row
            pending_before, _ = frontier_stats(connection)
            progress_reporter.begin_row(
                sequence=sequence,
                depth=depth,
                solved_this_run=solved_this_run,
                expanded_this_run=expanded_this_run,
                pending=pending_before,
            )

            row_solved = 0
            row_discovered = 0

            try:
                if (solve_root or sequence != "") and not already_solved(connection, sequence):
                    record = solver.solve_record(sequence)
                    store_record(connection, record)
                    row_solved = 1

                row_discovered = store_children(connection, sequence, depth, max_depth)
                mark_expanded(connection, sequence)
                connection.commit()
            except KeyboardInterrupt:
                connection.rollback()
                interrupted = True
                pending_after_interrupt, _ = frontier_stats(connection)
                progress_reporter.interrupt_row(pending=pending_after_interrupt)
                break

            solved_this_run += row_solved
            discovered_this_run += row_discovered
            expanded_this_run += 1
            pending_after, _ = frontier_stats(connection)
            progress_reporter.finish_row(
                solved_this_run=solved_this_run,
                expanded_this_run=expanded_this_run,
                pending=pending_after,
            )
    finally:
        progress_reporter.stop()

    pending, solved_total = frontier_stats(connection)
    return {
        "discovered": discovered_this_run,
        "expanded": expanded_this_run,
        "interrupted": interrupted,
        "pending": pending,
        "solved": solved_total,
        "solvedThisRun": solved_this_run,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Incrementally precompute exact Connect 4 move results into SQLite.",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("data/connect4_cache.sqlite3"),
        help="SQLite database path.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=0,
        help="Number of unsolved positions to solve in this run. Use 0 to keep going until finished or interrupted.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=8,
        help="Expand and solve positions up to this ply depth.",
    )
    parser.add_argument(
        "--table-size",
        type=int,
        default=DEFAULT_TABLE_SIZE,
        help="Transposition table size used by the Python solver.",
    )
    parser.add_argument(
        "--import-file",
        type=Path,
        help="Optional JSON or JSONL seed file to import into SQLite before solving.",
    )
    parser.add_argument(
        "--heartbeat-seconds",
        type=float,
        default=5.0,
        help="Print a live heartbeat this often while a position is being solved. Use 0 to disable heartbeats.",
    )
    parser.add_argument(
        "--solve-root",
        action="store_true",
        help="Also solve the empty root position instead of only expanding it.",
    )
    parser.add_argument(
        "--solve-sequence",
        type=str,
        help="Solve one specific sequence and print the JSON result instead of touching the database.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    progress_reporter = ProgressReporter(args.heartbeat_seconds)
    solver = Solver(
        table_size=args.table_size,
        move_progress_callback=progress_reporter.begin_move,
    )

    if args.batch_size < 0:
        raise ValueError("--batch-size must be 0 or greater.")
    if args.heartbeat_seconds < 0:
        raise ValueError("--heartbeat-seconds must be 0 or greater.")

    if args.solve_sequence is not None:
        progress_reporter.attach_node_counter(lambda: solver.node_count)
        progress_reporter.start()
        progress_reporter.begin_row(
            sequence=args.solve_sequence,
            depth=len(args.solve_sequence),
            solved_this_run=0,
            expanded_this_run=0,
            pending=0,
        )
        try:
            record = solver.solve_record(args.solve_sequence)
            progress_reporter.finish_row(solved_this_run=1, expanded_this_run=0, pending=0)
        except KeyboardInterrupt:
            progress_reporter.interrupt_row(pending=0)
            raise
        finally:
            progress_reporter.stop()

        print(json.dumps(asdict(record), indent=2))
        return

    connection = connect_database(args.database)
    try:
        init_database(connection)
        imported = 0
        if args.import_file is not None:
            imported = import_records(connection, load_import_records(args.import_file))
            print(f"Imported {imported} seed positions into {args.database}.", file=sys.stderr, flush=True)
        stats = run_batch(
            connection=connection,
            solver=solver,
            batch_size=args.batch_size,
            max_depth=args.max_depth,
            progress_reporter=progress_reporter,
            solve_root=args.solve_root,
        )
    finally:
        connection.close()

    print(
        json.dumps(
            {
                "database": str(args.database),
                "batchSize": args.batch_size,
                "imported": imported,
                "maxDepth": args.max_depth,
                **stats,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
