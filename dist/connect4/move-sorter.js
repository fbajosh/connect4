export class MoveSorter {
    entries = [];
    add(move, score) {
        let position = this.entries.length;
        this.entries.push({
            move,
            score
        });
        for(; position > 0 && this.entries[position - 1].score > score; position -= 1){
            this.entries[position] = this.entries[position - 1];
        }
        this.entries[position] = {
            move,
            score
        };
    }
    getNext() {
        return this.entries.pop()?.move ?? 0n;
    }
    reset() {
        this.entries.length = 0;
    }
}
