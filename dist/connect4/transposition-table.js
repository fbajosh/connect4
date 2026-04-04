import { DEFAULT_TABLE_SIZE } from "./constants.js";
export class TranspositionTable {
    size;
    sizeBigInt;
    keys;
    values;
    constructor(size = DEFAULT_TABLE_SIZE){
        this.size = size;
        this.sizeBigInt = BigInt(size);
        this.keys = new BigUint64Array(size);
        this.values = new Uint8Array(size);
    }
    reset() {
        this.keys.fill(0n);
        this.values.fill(0);
    }
    put(key, value) {
        const index = Number(key % this.sizeBigInt);
        this.keys[index] = BigInt.asUintN(64, key);
        this.values[index] = value;
    }
    get(key) {
        const index = Number(key % this.sizeBigInt);
        return this.keys[index] === BigInt.asUintN(64, key) ? this.values[index] : 0;
    }
}
