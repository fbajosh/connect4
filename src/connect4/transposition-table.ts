import { DEFAULT_TABLE_SIZE } from "./constants";

export class TranspositionTable {
  private readonly sizeBigInt: bigint;
  private readonly keys: BigUint64Array;
  private readonly values: Uint8Array;

  constructor(private readonly size = DEFAULT_TABLE_SIZE) {
    this.sizeBigInt = BigInt(size);
    this.keys = new BigUint64Array(size);
    this.values = new Uint8Array(size);
  }

  reset(): void {
    this.keys.fill(0n);
    this.values.fill(0);
  }

  put(key: bigint, value: number): void {
    const index = Number(key % this.sizeBigInt);
    this.keys[index] = BigInt.asUintN(64, key);
    this.values[index] = value;
  }

  get(key: bigint): number {
    const index = Number(key % this.sizeBigInt);
    return this.keys[index] === BigInt.asUintN(64, key) ? this.values[index] : 0;
  }
}
