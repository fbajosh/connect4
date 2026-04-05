export type SolverRecord = {
  bestColumns: number[];
  bestMoves: string;
  elapsedMs?: number;
  nodeCount?: number;
  positionScore: number;
  scores: number[];
  sequence: string;
  source?: "local-cache" | "precomputed" | "wasm";
};

const CACHE_DB_NAME = "connect4-solver-cache";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "solutions";
const PRECOMPUTED_ROOT = `${import.meta.env.BASE_URL}precomputed`;

let databasePromise: Promise<IDBDatabase | null> | null = null;
const shardPromiseCache = new Map<string, Promise<Map<string, SolverRecord>>>();

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) {
    return databasePromise;
  }

  if (!canUseIndexedDb()) {
    databasePromise = Promise.resolve(null);
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE_NAME)) {
        database.createObjectStore(CACHE_STORE_NAME, { keyPath: "sequence" });
      }
    });

    request.addEventListener("success", () => {
      resolve(request.result);
    });

    request.addEventListener("error", () => {
      reject(request.error ?? new Error("Unable to open optimizer cache."));
    });
  }).catch(() => null);

  return databasePromise;
}

function shardKey(sequence: string): string {
  if (sequence.length === 0) {
    return "_root";
  }

  return sequence.slice(0, 2);
}

async function loadShard(sequence: string): Promise<Map<string, SolverRecord>> {
  const key = shardKey(sequence);
  const cachedPromise = shardPromiseCache.get(key);
  if (cachedPromise) {
    return cachedPromise;
  }

  const shardPromise = (async () => {
    const response = await fetch(`${PRECOMPUTED_ROOT}/${key}.json`, { cache: "force-cache" });
    if (!response.ok) {
      return new Map<string, SolverRecord>();
    }

    const payload = (await response.json()) as Record<string, Omit<SolverRecord, "source">>;
    return new Map<string, SolverRecord>(
      Object.entries(payload).map(([entrySequence, record]) => [
        entrySequence,
        {
          ...record,
          source: "precomputed",
        },
      ]),
    );
  })().catch(() => new Map<string, SolverRecord>());

  shardPromiseCache.set(key, shardPromise);
  return shardPromise;
}

function normalizeRecord(record: SolverRecord, source: SolverRecord["source"]): SolverRecord {
  return {
    ...record,
    bestColumns: [...record.bestColumns],
    scores: [...record.scores],
    source,
  };
}

export async function getCachedSolverRecord(sequence: string): Promise<SolverRecord | null> {
  const database = await openDatabase();

  let localRecord: SolverRecord | null = null;
  if (database) {
    localRecord = await new Promise<SolverRecord | null>((resolve, reject) => {
      const transaction = database.transaction(CACHE_STORE_NAME, "readonly");
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.get(sequence);

      request.addEventListener("success", () => {
        const result = request.result as SolverRecord | undefined;
        resolve(result ? normalizeRecord(result, "local-cache") : null);
      });

      request.addEventListener("error", () => {
        reject(request.error ?? new Error("Unable to read local solver cache."));
      });
    }).catch(() => null);
  }

  if (localRecord) {
    return localRecord;
  }

  const shard = await loadShard(sequence);
  const precomputedRecord = shard.get(sequence);
  return precomputedRecord ? normalizeRecord(precomputedRecord, "precomputed") : null;
}

export async function putCachedSolverRecord(record: SolverRecord): Promise<void> {
  const database = await openDatabase();
  if (!database) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CACHE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const request = store.put({
      ...record,
      source: undefined,
    });

    request.addEventListener("success", () => {
      resolve();
    });

    request.addEventListener("error", () => {
      reject(request.error ?? new Error("Unable to write local solver cache."));
    });
  }).catch(() => undefined);
}
