/**
 * Automatic full-backup snapshots kept on this device (IndexedDB), separate
 * from the pre-sync backups so neither can push the other out.
 * Taken on the first launch of a new data format and before any permanent
 * clean-up (Recently Deleted items older than 30 days). Keeps the last 3.
 */
const DB_NAME = "home-inventory-snapshots";
const STORE = "snapshots";
const KEEP = 3;

export type Snapshot = { id: string; createdAt: string; reason: string; json: string; items: number };

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbp = null;
        reject(req.error);
      };
    });
  }
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        let out: T | undefined;
        if (req) req.onsuccess = () => (out = req.result);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const all = ((await tx<Snapshot[]>("readonly", (s) => s.getAll()).catch(() => [])) ?? []) as Snapshot[];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveSnapshot(reason: string, json: string, items: number): Promise<Snapshot> {
  const createdAt = new Date().toISOString();
  const snap: Snapshot = { id: `${createdAt}-${reason}`, createdAt, reason, json, items };
  await tx("readwrite", (s) => s.put(snap));
  const extra = (await listSnapshots()).slice(KEEP);
  if (extra.length) await tx("readwrite", (s) => extra.forEach((x) => s.delete(x.id)));
  return snap;
}

export const SNAPSHOT_REASON_LABEL: Record<string, string> = {
  "format-v6": "Before Count Update",
  "before-purge": "Before Clearing Recently Deleted",
};
