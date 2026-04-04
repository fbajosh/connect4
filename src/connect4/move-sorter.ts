type MoveEntry = {
  move: bigint;
  score: number;
};

export class MoveSorter {
  private readonly entries: MoveEntry[] = [];

  add(move: bigint, score: number): void {
    let position = this.entries.length;
    this.entries.push({ move, score });

    for (; position > 0 && this.entries[position - 1].score > score; position -= 1) {
      this.entries[position] = this.entries[position - 1];
    }

    this.entries[position] = { move, score };
  }

  getNext(): bigint {
    return this.entries.pop()?.move ?? 0n;
  }

  reset(): void {
    this.entries.length = 0;
  }
}
