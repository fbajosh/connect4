import type { OptimizerSuccessPayload } from "./app-types";

export type SolverRecord = OptimizerSuccessPayload;

const CACHE_DB_NAME = "connect4-solver-cache";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "solutions";

let databasePromise: Promise<IDBDatabase | null> | null = null;

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

  return null;
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
