export const WIDTH = 7;
export const HEIGHT = 6;
export const EMPTY = 0;
export const RED = 1;
export const YELLOW = 2;
export const EMPTY_BOARD_SCORES = [-2, -1, 0, 1, 0, -1, -2];

export type CellValue = typeof EMPTY | typeof RED | typeof YELLOW;
export type PlayerValue = typeof RED | typeof YELLOW;
export type BoardState = CellValue[][];

export function createBoard(): BoardState {
  return Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => EMPTY as CellValue),
  );
}

export function playerClass(player: PlayerValue): "red" | "yellow" {
  return player === RED ? "red" : "yellow";
}

export function nextPlayer(player: PlayerValue): PlayerValue {
  return player === RED ? YELLOW : RED;
}

export function slotIndexFor(row: number, column: number): number {
  return (HEIGHT - 1 - row) * WIDTH + column;
}

export function isInBounds(row: number, column: number): boolean {
  return row >= 0 && row < HEIGHT && column >= 0 && column < WIDTH;
}

export function lowestOpenRow(board: BoardState, column: number): number | null {
  for (let row = 0; row < HEIGHT; row += 1) {
    if (board[row][column] === EMPTY) {
      return row;
    }
  }

  return null;
}

export function detectWinningMask(board: BoardState): {
  hasWinningRun: boolean;
  winningMask: boolean[][];
} {
  const winningMask = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => false),
  );
  const directions: Array<[columnStep: number, rowStep: number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let hasWinningRun = false;

  for (let row = 0; row < HEIGHT; row += 1) {
    for (let column = 0; column < WIDTH; column += 1) {
      const player = board[row][column];
      if (player === EMPTY) {
        continue;
      }

      for (const [columnStep, rowStep] of directions) {
        const previousRow = row - rowStep;
        const previousColumn = column - columnStep;
        if (isInBounds(previousRow, previousColumn) && board[previousRow][previousColumn] === player) {
          continue;
        }

        const run: Array<[row: number, column: number]> = [];
        let scanRow = row;
        let scanColumn = column;

        while (isInBounds(scanRow, scanColumn) && board[scanRow][scanColumn] === player) {
          run.push([scanRow, scanColumn]);
          scanRow += rowStep;
          scanColumn += columnStep;
        }

        if (run.length < 4) {
          continue;
        }

        hasWinningRun = true;
        for (const [runRow, runColumn] of run) {
          winningMask[runRow][runColumn] = true;
        }
      }
    }
  }

  return {
    hasWinningRun,
    winningMask,
  };
}
