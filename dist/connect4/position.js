import { BOARD_MASK, BOTTOM_MASK, HEIGHT, WIDTH, bottomMaskCol, columnMask, topMaskCol } from "./constants.js";
export class Position {
    currentPosition = 0n;
    mask = 0n;
    moves = 0;
    clone() {
        const copy = new Position();
        copy.currentPosition = this.currentPosition;
        copy.mask = this.mask;
        copy.moves = this.moves;
        return copy;
    }
    play(move) {
        this.currentPosition ^= this.mask;
        this.mask |= move;
        this.moves += 1;
    }
    playSequence(sequence) {
        for(let index = 0; index < sequence.length; index += 1){
            const col = Number(sequence[index]) - 1;
            if (!Number.isInteger(col) || col < 0 || col >= WIDTH || !this.canPlay(col) || this.isWinningMove(col)) {
                return index;
            }
            this.playCol(col);
        }
        return sequence.length;
    }
    canWinNext() {
        return (this.winningPosition() & this.possible()) !== 0n;
    }
    nbMoves() {
        return this.moves;
    }
    key() {
        return this.currentPosition + this.mask;
    }
    possibleNonLosingMoves() {
        if (this.canWinNext()) {
            throw new Error("possibleNonLosingMoves() expects a position without an immediate win.");
        }
        let possibleMask = this.possible();
        const opponentWin = this.opponentWinningPosition();
        const forcedMoves = possibleMask & opponentWin;
        if (forcedMoves !== 0n) {
            if ((forcedMoves & forcedMoves - 1n) !== 0n) {
                return 0n;
            }
            possibleMask = forcedMoves;
        }
        return possibleMask & ~(opponentWin >> 1n);
    }
    moveScore(move) {
        return Position.popcount(Position.computeWinningPosition(this.currentPosition | move, this.mask));
    }
    canPlay(col) {
        return (this.mask & topMaskCol(col)) === 0n;
    }
    playCol(col) {
        this.play(this.mask + bottomMaskCol(col) & columnMask(col));
    }
    isWinningMove(col) {
        return (this.winningPosition() & this.possible() & columnMask(col)) !== 0n;
    }
    winningPosition() {
        return Position.computeWinningPosition(this.currentPosition, this.mask);
    }
    opponentWinningPosition() {
        return Position.computeWinningPosition(this.currentPosition ^ this.mask, this.mask);
    }
    possible() {
        return this.mask + BOTTOM_MASK & BOARD_MASK;
    }
    static popcount(mask) {
        let count = 0;
        let currentMask = mask;
        while(currentMask !== 0n){
            currentMask &= currentMask - 1n;
            count += 1;
        }
        return count;
    }
    static computeWinningPosition(position, mask) {
        let result = position << 1n & position << 2n & position << 3n;
        const horizontalStep = BigInt(HEIGHT + 1);
        let partial = position << horizontalStep & position << 2n * horizontalStep;
        result |= partial & position << 3n * horizontalStep;
        result |= partial & position >> horizontalStep;
        partial = position >> horizontalStep & position >> 2n * horizontalStep;
        result |= partial & position << horizontalStep;
        result |= partial & position >> 3n * horizontalStep;
        const diagonalDownStep = BigInt(HEIGHT);
        partial = position << diagonalDownStep & position << 2n * diagonalDownStep;
        result |= partial & position << 3n * diagonalDownStep;
        result |= partial & position >> diagonalDownStep;
        partial = position >> diagonalDownStep & position >> 2n * diagonalDownStep;
        result |= partial & position << diagonalDownStep;
        result |= partial & position >> 3n * diagonalDownStep;
        const diagonalUpStep = BigInt(HEIGHT + 2);
        partial = position << diagonalUpStep & position << 2n * diagonalUpStep;
        result |= partial & position << 3n * diagonalUpStep;
        result |= partial & position >> diagonalUpStep;
        partial = position >> diagonalUpStep & position >> 2n * diagonalUpStep;
        result |= partial & position << diagonalUpStep;
        result |= partial & position >> 3n * diagonalUpStep;
        return result & (BOARD_MASK ^ mask);
    }
}
