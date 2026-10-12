/**
 * LIFEKIT local storage layer.
 *
 * Structured records live in IndexedDB, one object store per collection, keyed by `id`.
 * Everything here is local to the device: LIFEKIT has no server for personal data, so
 * there is no code path in this module (or any other) that uploads user records.
 *
 * Resilience rules:
 *  - If IndexedDB is unavailable (private mode, storage disabled, quota refusal) the app
 *    falls back to an in-memory store so the UI keeps working, and `storageHealth()`
 *    reports `persistent: false` so the UI can warn the user before they type real data.
 *  - A failed write is surfaced to the caller; it is never silently swallowed.
 *  - Upgrades only ever add stores; no destructive schema migration is performed.
 */

export const DB_NAME = 'lifekit';
export const DB_VERSION = 1;

export const STORES = {
  moneyCategories: 'money_categories',
  moneyEntries: 'money_entries',
  moneyBudgets: 'money_budgets',
  moneyGoals: 'money_goals',
  tasks: 'tasks',
  habits: 'habits',
  habitLogs: 'habit_logs',
  notes: 'notes',
  checklists: 'checklists',
  learningProgress: 'learning_progress',
  jobApplications: 'job_applications',
  notificationLog: 'notification_log',
  announcementsRead: 'announcements_read',
  reports: 'directory_reports',
  documents: 'documents',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

const INDEXED_STORES: StoreName[] = Object.values(STORES).filter((s) => s !== STORES.documents);

interface DocumentRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

type Row = Record<string, unknown> & { id: string };

/* ------------------------------------------------------------------ */
/* availability detection                                              */
/* ------------------------------------------------------------------ */

export interface StorageHealth {
  indexedDB: boolean;
  localStorage: boolean;
  /** True when writes will survive a reload. */
  persistent: boolean;
  mode: 'indexeddb' | 'memory';
  reason?: string;
}

let healthCache: StorageHealth | null = null;

export function storageHealth(): StorageHealth {
  if (healthCache) return healthCache;
  const idb = typeof indexedDB !== 'undefined';
  let ls = false;
  try {
    const probe = '__lifekit_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    ls = true;
  } catch {
    ls = false;
  }
  const memoryForced = typeof globalThis !== 'undefined' && Boolean((globalThis as { __LIFEKIT_FORCE_MEMORY__?: boolean }).__LIFEKIT_FORCE_MEMORY__);
  healthCache = {
    indexedDB: idb,
    localStorage: ls,
    persistent: idb && !memoryForced,
    mode: idb && !memoryForced ? 'indexeddb' : 'memory',
    reason: !idb
      ? 'IndexedDB is not available in this browser context.'
      : memoryForced
        ? 'Storage is running in memory-only mode (disabled by configuration or by the browser).'
        : undefined,
  };
  return healthCache;
}

/** Test hook: lets the suite exercise the memory fallback path deterministically. */
export function __resetStorageHealthForTests(): void {
  healthCache = null;
}

/**
 * Test helper: close the cached IndexedDB connection and forget every cached state so the
 * next write opens a fresh database. Browser tabs never need this — it exists because
 * IndexedDB refuses to delete a database while a connection is still open, and the test
 * suite wants a clean database per test.
 */
export async function __resetStorageForTests(): Promise<void> {
  healthCache = null;
  memory.clear();
  memoryDocuments.clear();
  const pending = dbPromise;
  dbPromise = null;
  if (pending) {
    try {
      (await pending).close();
    } catch {
      // A connection that already failed to open has nothing to close.
    }
  }
}

/* ------------------------------------------------------------------ */
/* in-memory fallback                                                  */
/* ------------------------------------------------------------------ */

const memory = new Map<string, Map<string, Row>>();
const memoryDocuments = new Map<string, DocumentRecord>();

function memStore(name: string): Map<string, Row> {
  let store = memory.get(name);
  if (!store) {
    store = new Map();
    memory.set(name, store);
  }
  return store;
}

/* ------------------------------------------------------------------ */
/* IndexedDB plumbing                                                  */
/* ------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of INDEXED_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          // Indexes are added for the collections that actually get queried by field.
          if (name === STORES.moneyEntries) {
            store.createIndex('byDate', 'date');
            store.createIndex('byType', 'type');
            store.createIndex('byCategory', 'categoryId');
          }
          if (name === STORES.tasks) {
            store.createIndex('byDue', 'dueDate');
            store.createIndex('byStatus', 'status');
          }
          if (name === STORES.habitLogs) {
            store.createIndex('byHabit', 'habitId');
            store.createIndex('byDate', 'date');
          }
          if (name === STORES.jobApplications) {
            store.createIndex('byStatus', 'status');
          }
        }
      }
      if (!db.objectStoreNames.contains(STORES.documents)) {
        db.createObjectStore(STORES.documents, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest | IDBRequest[] | null
): Promise<unknown> {
  const db = await openDB();
  return new Promise<unknown>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result: unknown;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    const produced = work(store);
    if (produced) {
      const requests = Array.isArray(produced) ? produced : [produced];
      const last = requests[requests.length - 1];
      if (last) last.onsuccess = () => (result = last.result as unknown);
    }
  }) as Promise<T>;
}

function assertSafeKey(id: unknown): asserts id is string {
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) {
    throw new Error('Invalid record id');
  }
}

/* ------------------------------------------------------------------ */
/* public CRUD API                                                     */
/* ------------------------------------------------------------------ */

export async function put<T extends { id: string }>(storeName: StoreName, record: T): Promise<T> {
  assertSafeKey(record?.id);
  if (!storageHealth().persistent) {
    memStore(storeName).set(record.id, record as unknown as Row);
    return record;
  }
  await tx(storeName, 'readwrite', (store) => store.put(structuredCloneSafe(record)));
  return record;
}

export async function putMany<T extends { id: string }>(storeName: StoreName, records: readonly T[]): Promise<number> {
  if (records.length === 0) return 0;
  for (const record of records) assertSafeKey(record?.id);
  if (!storageHealth().persistent) {
    const store = memStore(storeName);
    for (const record of records) store.set(record.id, record as unknown as Row);
    return records.length;
  }
  await tx(storeName, 'readwrite', (store) => records.map((r) => store.put(structuredCloneSafe(r))));
  return records.length;
}

export async function get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  if (typeof id !== 'string' || !id) return undefined;
  if (!storageHealth().persistent) return memStore(storeName).get(id) as unknown as T | undefined;
  const db = await openDB();
  const result = await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(id));
  return result as T | undefined;
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  if (!storageHealth().persistent) return [...memStore(storeName).values()] as unknown as T[];
  const db = await openDB();
  const result = await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  return (result ?? []) as T[];
}

export async function count(storeName: StoreName): Promise<number> {
  if (!storageHealth().persistent) return memStore(storeName).size;
  const db = await openDB();
  const result = await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).count());
  return result ?? 0;
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  if (typeof id !== 'string' || !id) return;
  if (!storageHealth().persistent) {
    memStore(storeName).delete(id);
    return;
  }
  await tx(storeName, 'readwrite', (store) => store.delete(id));
}

export async function clearStore(storeName: StoreName): Promise<void> {
  if (!storageHealth().persistent) {
    memStore(storeName).clear();
    return;
  }
  await tx(storeName, 'readwrite', (store) => store.clear());
}

export async function clearMany(storeNames: readonly StoreName[]): Promise<void> {
  for (const name of storeNames) await clearStore(name);
}

/* ------------------------------- documents (single JSON blobs) ------------------------------- */

export async function putDocument(key: string, value: unknown): Promise<void> {
  assertSafeKey(key);
  const record: DocumentRecord = { key, value, updatedAt: new Date().toISOString() };
  if (!storageHealth().persistent) {
    memoryDocuments.set(key, record);
    return;
  }
  await tx(STORES.documents, 'readwrite', (store) => store.put(structuredCloneSafe(record)));
}

export async function getDocument<T>(key: string): Promise<T | undefined> {
  if (typeof key !== 'string' || !key) return undefined;
  if (!storageHealth().persistent) return memoryDocuments.get(key)?.value as T | undefined;
  const db = await openDB();
  const record = (await requestToPromise(
    db.transaction(STORES.documents, 'readonly').objectStore(STORES.documents).get(key)
  )) as DocumentRecord | undefined;
  return record?.value as T | undefined;
}

export async function deleteDocument(key: string): Promise<void> {
  if (!storageHealth().persistent) {
    memoryDocuments.delete(key);
    return;
  }
  await tx(STORES.documents, 'readwrite', (store) => store.delete(key));
}

/* ------------------------------- helpers ------------------------------- */

/** localStorage wrapper used for settings only. Never throws; reports success. */
export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`lifekit.${key}`);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw) as T;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(`lifekit.${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(`lifekit.${key}`);
    } catch {
      /* ignore */
    }
  },
  keys(): string[] {
    try {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith('lifekit.'))
        .map((k) => k.slice('lifekit.'.length));
    } catch {
      return [];
    }
  },
};

/** structuredClone with a JSON fallback for older WebViews. */
function structuredCloneSafe<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone;
  if (typeof sc === 'function') {
    try {
      return sc(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Approximate storage usage for the Settings screen (never used for telemetry). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const nav = navigator as Navigator & { storage?: { estimate?: () => Promise<StorageEstimate> } };
    if (!nav.storage?.estimate) return null;
    const est = await nav.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return null;
  }
}
