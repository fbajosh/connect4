import { BOARD_SIZE, COLUMN_ORDER, DEFAULT_TABLE_SIZE, INVALID_MOVE, MAX_SCORE, MIN_SCORE, WIDTH, columnMask } from "./constants.js";
import { MoveSorter } from "./move-sorter.js";
import { Position } from "./position.js";
import { TranspositionTable } from "./transposition-table.js";

export type SolveResult = {
  elapsedMs: number;
  nodeCount: number;
  score: number;
};

export type AnalysisResult = {
  bestColumns: number[];
  elapsedMs: number;
  nodeCount: number;
  positionScore: number;
  scores: number[];
};

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export class Solver {
  static readonly INVALID_MOVE = INVALID_MOVE;

  private nodeCount = 0;
  private readonly transTable: TranspositionTable;

  constructor(tableSize = DEFAULT_TABLE_SIZE) {
    this.transTable = new TranspositionTable(tableSize);
  }

  getNodeCount(): number {
    return this.nodeCount;
  }

  clearCache(): void {
    this.transTable.reset();
  }

  solve(position: Position, weak = false): number {
    if (position.canWinNext()) {
      return Math.trunc((BOARD_SIZE + 1 - position.nbMoves()) / 2);
    }

    let min = -Math.trunc((BOARD_SIZE - position.nbMoves()) / 2);
    let max = Math.trunc((BOARD_SIZE + 1 - position.nbMoves()) / 2);

    if (weak) {
      min = -1;
      max = 1;
    }

    while (min < max) {
      let med = min + Math.trunc((max - min) / 2);
      if (med <= 0 && Math.trunc(min / 2) < med) {
        med = Math.trunc(min / 2);
      } else if (med >= 0 && Math.trunc(max / 2) > med) {
        med = Math.trunc(max / 2);
      }

      const result = this.negamax(position, med, med + 1);
      if (result <= med) {
        max = result;
      } else {
        min = result;
      }
    }

    return min;
  }

  solveWithStats(position: Position, weak = false): SolveResult {
    this.nodeCount = 0;
    const startedAt = now();
    const score = this.solve(position, weak);
    return {
      elapsedMs: now() - startedAt,
      nodeCount: this.nodeCount,
      score,
    };
  }

  analyze(position: Position, weak = false): number[] {
    const scores = Array.from({ length: WIDTH }, () => INVALID_MOVE);

    for (let col = 0; col < WIDTH; col += 1) {
      if (!position.canPlay(col)) {
        continue;
      }

      if (position.isWinningMove(col)) {
        scores[col] = Math.trunc((BOARD_SIZE + 1 - position.nbMoves()) / 2);
        continue;
      }

      const nextPosition = position.clone();
      nextPosition.playCol(col);
      scores[col] = -this.solve(nextPosition, weak);
    }

    return scores;
  }

  analyzeWithStats(position: Position, weak = false): AnalysisResult {
    this.nodeCount = 0;
    const startedAt = now();
    const scores = this.analyze(position, weak);

    let positionScore = Number.NEGATIVE_INFINITY;
    const bestColumns: number[] = [];

    for (let col = 0; col < scores.length; col += 1) {
      const score = scores[col];
      if (score === INVALID_MOVE) {
        continue;
      }

      if (score > positionScore) {
        positionScore = score;
        bestColumns.length = 0;
        bestColumns.push(col);
      } else if (score === positionScore) {
        bestColumns.push(col);
      }
    }

    return {
      bestColumns,
      elapsedMs: now() - startedAt,
      nodeCount: this.nodeCount,
      positionScore: Number.isFinite(positionScore) ? positionScore : 0,
      scores,
    };
  }

  private negamax(position: Position, alpha: number, beta: number): number {
    if (alpha >= beta) {
      throw new Error("negamax() requires alpha < beta.");
    }
    if (position.canWinNext()) {
      throw new Error("negamax() does not support positions with an immediate win.");
    }

    this.nodeCount += 1;

    const possible = position.possibleNonLosingMoves();
    if (possible === 0n) {
      return -Math.trunc((BOARD_SIZE - position.nbMoves()) / 2);
    }

    if (position.nbMoves() >= BOARD_SIZE - 2) {
      return 0;
    }

    let min = -Math.trunc((BOARD_SIZE - 2 - position.nbMoves()) / 2);
    if (alpha < min) {
      alpha = min;
      if (alpha >= beta) {
        return alpha;
      }
    }

    let max = Math.trunc((BOARD_SIZE - 1 - position.nbMoves()) / 2);
    if (beta > max) {
      beta = max;
      if (alpha >= beta) {
        return beta;
      }
    }

    const key = position.key();
    const cachedValue = this.transTable.get(key);
    if (cachedValue !== 0) {
      if (cachedValue > MAX_SCORE - MIN_SCORE + 1) {
        min = cachedValue + 2 * MIN_SCORE - MAX_SCORE - 2;
        if (alpha < min) {
          alpha = min;
          if (alpha >= beta) {
            return alpha;
          }
        }
      } else {
        max = cachedValue + MIN_SCORE - 1;
        if (beta > max) {
          beta = max;
          if (alpha >= beta) {
            return beta;
          }
        }
      }
    }

    const moves = new MoveSorter();
    for (let index = WIDTH - 1; index >= 0; index -= 1) {
      const move = possible & columnMask(COLUMN_ORDER[index]);
      if (move !== 0n) {
        moves.add(move, position.moveScore(move));
      }
    }

    let nextMove = moves.getNext();
    while (nextMove !== 0n) {
      const nextPosition = position.clone();
      nextPosition.play(nextMove);
      const score = -this.negamax(nextPosition, -beta, -alpha);

      if (score >= beta) {
        this.transTable.put(key, score + MAX_SCORE - 2 * MIN_SCORE + 2);
        return score;
      }

      if (score > alpha) {
        alpha = score;
      }

      nextMove = moves.getNext();
    }

    this.transTable.put(key, alpha - MIN_SCORE + 1);
    return alpha;
  }
}
