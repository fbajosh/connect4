export const WIDTH = 7;
export const HEIGHT = 6;
export const BOARD_SIZE = WIDTH * HEIGHT;
export const MIN_SCORE = -(BOARD_SIZE / 2) + 3;
export const MAX_SCORE = Math.trunc((BOARD_SIZE + 1) / 2) - 3;
export const INVALID_MOVE = -1000;

// Smaller than the native solver so it fits comfortably in a browser tab.
export const DEFAULT_TABLE_SIZE = 2_097_169;

export const COLUMN_ORDER = Array.from({ length: WIDTH }, (_, index) => {
  const direction = 1 - 2 * (index % 2);
  return Math.trunc(WIDTH / 2) + direction * Math.trunc((index + 1) / 2);
});

function buildBottomMask(): bigint {
  let mask = 0n;
  for (let col = 0; col < WIDTH; col += 1) {
    mask |= 1n << BigInt(col * (HEIGHT + 1));
  }
  return mask;
}

export const BOTTOM_MASK = buildBottomMask();
export const BOARD_MASK = BOTTOM_MASK * ((1n << BigInt(HEIGHT)) - 1n);

export function topMaskCol(col: number): bigint {
  return 1n << BigInt((HEIGHT - 1) + col * (HEIGHT + 1));
}

export function bottomMaskCol(col: number): bigint {
  return 1n << BigInt(col * (HEIGHT + 1));
}

export function columnMask(col: number): bigint {
  return ((1n << BigInt(HEIGHT)) - 1n) << BigInt(col * (HEIGHT + 1));
}
