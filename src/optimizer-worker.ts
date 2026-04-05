import { columnMask } from "./connect4/constants";
import { Position } from "./connect4/position";

type OptimizerRequest = {
  sequence: string;
};

type OptimizerResponse = {
  output: string;
};

type ColumnAnalysis = {
  column: number;
  isNonLosing: boolean;
  isWinning: boolean;
  moveScore: number;
};

function rankColumns(columns: ColumnAnalysis[]): ColumnAnalysis[] {
  return [...columns].sort((left, right) => {
    if (left.isWinning !== right.isWinning) {
      return Number(right.isWinning) - Number(left.isWinning);
    }

    if (left.isNonLosing !== right.isNonLosing) {
      return Number(right.isNonLosing) - Number(left.isNonLosing);
    }

    if (left.moveScore !== right.moveScore) {
      return right.moveScore - left.moveScore;
    }

    const leftDistance = Math.abs(left.column - 3);
    const rightDistance = Math.abs(right.column - 3);
    return leftDistance - rightDistance || left.column - right.column;
  });
}

function maskToColumns(mask: bigint): number[] {
  const columns: number[] = [];

  for (let column = 0; column < 7; column += 1) {
    if ((mask & columnMask(column)) !== 0n) {
      columns.push(column);
    }
  }

  return columns;
}

self.addEventListener("message", (event: MessageEvent<OptimizerRequest>) => {
  const { sequence } = event.data;

  if (sequence.length === 0) {
    const response: OptimizerResponse = {
      output: JSON.stringify(
        {
          bestColumns: [],
          message: "No moves yet.",
          sequence,
        },
        null,
        2,
      ),
    };
    self.postMessage(response);
    return;
  }

  const position = new Position();
  const processedMoves = position.playSequence(sequence);

  if (processedMoves !== sequence.length) {
    const response: OptimizerResponse = {
      output: JSON.stringify(
        {
          error: `Sequence stopped being analyzable at move ${processedMoves + 1}.`,
          sequence,
        },
        null,
        2,
      ),
    };
    self.postMessage(response);
    return;
  }

  const playableColumns: number[] = [];
  const winningColumns: number[] = [];
  const possibleMoves = position.possible();

  for (let column = 0; column < 7; column += 1) {
    if (!position.canPlay(column)) {
      continue;
    }

    playableColumns.push(column + 1);
    if (position.isWinningMove(column)) {
      winningColumns.push(column + 1);
    }
  }

  let nonLosingColumns: number[] = [];
  if (!position.canWinNext()) {
    nonLosingColumns = maskToColumns(position.possibleNonLosingMoves());
  }

  const nonLosingColumnSet = new Set(nonLosingColumns);
  const rankedColumns = rankColumns(
    playableColumns.map((oneBasedColumn) => {
      const column = oneBasedColumn - 1;
      const move = possibleMoves & columnMask(column);
      return {
        column,
        isNonLosing: nonLosingColumnSet.size === 0 ? true : nonLosingColumnSet.has(column),
        isWinning: winningColumns.includes(oneBasedColumn),
        moveScore: move === 0n ? -1 : position.moveScore(move),
      };
    }),
  );

  const bestColumns =
    rankedColumns.length === 0
      ? []
      : rankedColumns
          .filter(
            (entry) =>
              entry.isWinning === rankedColumns[0].isWinning &&
              entry.isNonLosing === rankedColumns[0].isNonLosing &&
              entry.moveScore === rankedColumns[0].moveScore,
          )
          .map((entry) => entry.column + 1);

  const response: OptimizerResponse = {
    output: JSON.stringify(
      {
        bestColumns,
        mode: "heuristic",
        moveScores: rankedColumns.map((entry) => ({
          column: entry.column + 1,
          moveScore: entry.moveScore,
        })),
        nonLosingColumns: nonLosingColumns.map((column) => column + 1),
        playableColumns,
        rankedColumns: rankedColumns.map((entry) => entry.column + 1),
        sequence,
        winningColumns,
      },
      null,
      2,
    ),
  };

  self.postMessage(response);
});
