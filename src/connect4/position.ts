import { BOARD_MASK, BOTTOM_MASK, HEIGHT, WIDTH, bottomMaskCol, columnMask, topMaskCol } from "./constants.js";

export class Position {
  private currentPosition = 0n;
  private mask = 0n;
  private moves = 0;

  clone(): Position {
    const copy = new Position();
    copy.currentPosition = this.currentPosition;
    copy.mask = this.mask;
    copy.moves = this.moves;
    return copy;
  }

  play(move: bigint): void {
    this.currentPosition ^= this.mask;
    this.mask |= move;
    this.moves += 1;
  }

  playSequence(sequence: string): number {
    for (let index = 0; index < sequence.length; index += 1) {
      const col = Number(sequence[index]) - 1;
      if (!Number.isInteger(col) || col < 0 || col >= WIDTH || !this.canPlay(col) || this.isWinningMove(col)) {
        return index;
      }
      this.playCol(col);
    }
    return sequence.length;
  }

  canWinNext(): boolean {
    return (this.winningPosition() & this.possible()) !== 0n;
  }

  nbMoves(): number {
    return this.moves;
  }

  key(): bigint {
    return this.currentPosition + this.mask;
  }

  possibleNonLosingMoves(): bigint {
    if (this.canWinNext()) {
      throw new Error("possibleNonLosingMoves() expects a position without an immediate win.");
    }

    let possibleMask = this.possible();
    const opponentWin = this.opponentWinningPosition();
    const forcedMoves = possibleMask & opponentWin;

    if (forcedMoves !== 0n) {
      if ((forcedMoves & (forcedMoves - 1n)) !== 0n) {
        return 0n;
      }
      possibleMask = forcedMoves;
    }

    return possibleMask & ~(opponentWin >> 1n);
  }

  moveScore(move: bigint): number {
    return Position.popcount(Position.computeWinningPosition(this.currentPosition | move, this.mask));
  }

  canPlay(col: number): boolean {
    return (this.mask & topMaskCol(col)) === 0n;
  }

  playCol(col: number): void {
    this.play((this.mask + bottomMaskCol(col)) & columnMask(col));
  }

  isWinningMove(col: number): boolean {
    return (this.winningPosition() & this.possible() & columnMask(col)) !== 0n;
  }

  winningPosition(): bigint {
    return Position.computeWinningPosition(this.currentPosition, this.mask);
  }

  opponentWinningPosition(): bigint {
    return Position.computeWinningPosition(this.currentPosition ^ this.mask, this.mask);
  }

  possible(): bigint {
    return (this.mask + BOTTOM_MASK) & BOARD_MASK;
  }

  static popcount(mask: bigint): number {
    let count = 0;
    let currentMask = mask;
    while (currentMask !== 0n) {
      currentMask &= currentMask - 1n;
      count += 1;
    }
    return count;
  }

  static computeWinningPosition(position: bigint, mask: bigint): bigint {
    let result = (position << 1n) & (position << 2n) & (position << 3n);

    const horizontalStep = BigInt(HEIGHT + 1);
    let partial = (position << horizontalStep) & (position << (2n * horizontalStep));
    result |= partial & (position << (3n * horizontalStep));
    result |= partial & (position >> horizontalStep);
    partial = (position >> horizontalStep) & (position >> (2n * horizontalStep));
    result |= partial & (position << horizontalStep);
    result |= partial & (position >> (3n * horizontalStep));

    const diagonalDownStep = BigInt(HEIGHT);
    partial = (position << diagonalDownStep) & (position << (2n * diagonalDownStep));
    result |= partial & (position << (3n * diagonalDownStep));
    result |= partial & (position >> diagonalDownStep);
    partial = (position >> diagonalDownStep) & (position >> (2n * diagonalDownStep));
    result |= partial & (position << diagonalDownStep);
    result |= partial & (position >> (3n * diagonalDownStep));

    const diagonalUpStep = BigInt(HEIGHT + 2);
    partial = (position << diagonalUpStep) & (position << (2n * diagonalUpStep));
    result |= partial & (position << (3n * diagonalUpStep));
    result |= partial & (position >> diagonalUpStep);
    partial = (position >> diagonalUpStep) & (position >> (2n * diagonalUpStep));
    result |= partial & (position << diagonalUpStep);
    result |= partial & (position >> (3n * diagonalUpStep));

    return result & (BOARD_MASK ^ mask);
  }
}
