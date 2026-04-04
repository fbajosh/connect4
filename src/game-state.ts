import { BOARD_SIZE, HEIGHT, WIDTH } from "./connect4/constants.js";

export type Disc = 0 | 1 | 2;
export type Player = 1 | 2;

export type ParsedGame = {
  board: Disc[][];
  currentPlayer: Player;
  heights: number[];
  isDraw: boolean;
  nextWinningColumns: number[];
  sequence: string;
  winner: Disc;
};

type ParseSuccess = {
  game: ParsedGame;
  ok: true;
};

type ParseFailure = {
  error: string;
  ok: false;
};

function makeBoard(): Disc[][] {
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => 0 as Disc));
}

function otherPlayer(player: Player): Player {
  return player === 1 ? 2 : 1;
}

function countDirection(board: Disc[][], startCol: number, startRow: number, colStep: number, rowStep: number, player: Player): number {
  let count = 0;
  let col = startCol;
  let row = startRow;

  while (col >= 0 && col < WIDTH && row >= 0 && row < HEIGHT && board[row][col] === player) {
    count += 1;
    col += colStep;
    row += rowStep;
  }

  return count;
}

function hasFour(board: Disc[][], col: number, row: number, player: Player): boolean {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;

  return directions.some(([colStep, rowStep]) => {
    const total =
      countDirection(board, col, row, colStep, rowStep, player) +
      countDirection(board, col, row, -colStep, -rowStep, player) -
      1;
    return total >= 4;
  });
}

function computeWinningColumns(board: Disc[][], heights: number[], player: Player): number[] {
  const winningColumns: number[] = [];

  for (let col = 0; col < WIDTH; col += 1) {
    const row = heights[col];
    if (row >= HEIGHT) {
      continue;
    }

    board[row][col] = player;
    const isWinningMove = hasFour(board, col, row, player);
    board[row][col] = 0;

    if (isWinningMove) {
      winningColumns.push(col);
    }
  }

  return winningColumns;
}

export function parseSequence(sequence: string): ParseSuccess | ParseFailure {
  const board = makeBoard();
  const heights = Array.from({ length: WIDTH }, () => 0);

  let currentPlayer: Player = 1;
  let winner: Disc = 0;

  for (let moveIndex = 0; moveIndex < sequence.length; moveIndex += 1) {
    const col = Number(sequence[moveIndex]) - 1;

    if (!Number.isInteger(col) || col < 0 || col >= WIDTH) {
      return { error: `Move ${moveIndex + 1} is not a valid column. Use digits 1 through 7.`, ok: false };
    }

    if (winner !== 0) {
      return { error: `Move ${moveIndex + 1} happens after the game is already over.`, ok: false };
    }

    const row = heights[col];
    if (row >= HEIGHT) {
      return { error: `Move ${moveIndex + 1} tries to play into a full column.`, ok: false };
    }

    board[row][col] = currentPlayer;
    heights[col] += 1;

    if (hasFour(board, col, row, currentPlayer)) {
      winner = currentPlayer;
    }

    currentPlayer = otherPlayer(currentPlayer);
  }

  const isDraw = winner === 0 && sequence.length === BOARD_SIZE;
  const nextWinningColumns = winner === 0 && !isDraw ? computeWinningColumns(board, heights, currentPlayer) : [];

  return {
    game: {
      board,
      currentPlayer,
      heights,
      isDraw,
      nextWinningColumns,
      sequence,
      winner,
    },
    ok: true,
  };
}
