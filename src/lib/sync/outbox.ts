/**
 * IndexedDB outbox: one entry per record that changed locally and hasn't been
 * confirmed by the server yet. Entries hold the record key + when it changed;
 * the payload is read from current local state at push time, so ten edits to
 * one item are one entry. Also stores the automatic pre-sync backups.
 */
const DB_NAME = "home-inventory-sync";
const OUTBOX = "outbox";
const BACKUPS = "backups";

export type OutboxEntry = { key: string; at: number };
export type BackupRecord = { id: string; createdAt: string; email: string | null; json: string };

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "key" });
        if (!db.objectStoreNames.contains(BACKUPS)) db.createObjectStore(BACKUPS, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        let result: T | undefined;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
const changed = () => listeners.forEach((l) => l());

let seq = 0;
export async function enqueue(keys: string[]) {
  if (!keys.length) return;
  const base = Date.now() * 1000;
  await run(OUTBOX, "readwrite", (s) => {
    for (const key of new Set(keys)) s.put({ key, at: base + (seq++ % 1000) } satisfies OutboxEntry);
  });
  changed();
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  return ((await run<OutboxEntry[]>(OUTBOX, "readonly", (s) => s.getAll()).catch(() => [])) ?? []) as OutboxEntry[];
}

export async function outboxCount(): Promise<number> {
  return ((await run<number>(OUTBOX, "readonly", (s) => s.count()).catch(() => 0)) ?? 0) as number;
}

/** Remove entries that were pushed — unless they changed again while the push was in flight. */
export async function ack(entries: OutboxEntry[]) {
  if (!entries.length) return;
  await run(OUTBOX, "readwrite", (s) => {
    for (const e of entries) {
      const g = s.get(e.key);
      g.onsuccess = () => {
        const cur = g.result as OutboxEntry | undefined;
        if (cur && cur.at === e.at) s.delete(e.key);
      };
    }
  });
  changed();
}

export async function saveBackup(rec: BackupRecord) {
  await run(BACKUPS, "readwrite", (s) => s.put(rec));
  // Keep the five most recent.
  const all = await listBackups();
  const extra = all.slice(5);
  if (extra.length) await run(BACKUPS, "readwrite", (s) => extra.forEach((b) => s.delete(b.id)));
  changed();
}

export async function listBackups(): Promise<BackupRecord[]> {
  const all = ((await run<BackupRecord[]>(BACKUPS, "readonly", (s) => s.getAll()).catch(() => [])) ?? []) as BackupRecord[];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
