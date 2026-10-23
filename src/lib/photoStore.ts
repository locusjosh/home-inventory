/**
 * User item photos live in IndexedDB (not localStorage — a single phone photo
 * would blow the ~5 MB quota). Keyed by item id. Bundled seed packshots stay in
 * `item.image`; a user photo always wins over them and is never touched by the
 * seed photo refresh.
 */
import { useEffect, useState } from "react";
import { blobToDataUrl, dataUrlToBlob } from "./imageFile";

const DB_NAME = "home-inventory-photos";
const STORE = "photos";

/**
 * Bytes are stored as an ArrayBuffer (+ MIME type) rather than a Blob: WebKit
 * refuses Blob values in some IndexedDB contexts (private browsing, ephemeral
 * web views), while ArrayBuffers work everywhere.
 */
export type PhotoRecord = { id: string; data: ArrayBuffer; type: string; updatedAt: string; width?: number; height?: number };

function recordBlob(rec: PhotoRecord & { blob?: Blob }): Blob | null {
  if (rec.data) return new Blob([rec.data], { type: rec.type || "image/jpeg" });
  return rec.blob ?? null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
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

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        let result: T | undefined;
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

// ---- in-memory cache + change notifications --------------------------------

const urlCache = new Map<string, string | null>();
const listeners = new Set<() => void>();
let index: Set<string> | null = null;
let indexPromise: Promise<Set<string>> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function loadIndex(): Promise<Set<string>> {
  if (index) return Promise.resolve(index);
  if (!indexPromise) {
    indexPromise = tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())
      .then((keys) => {
        index = new Set((keys ?? []).map(String));
        return index;
      })
      .catch(() => {
        index = new Set();
        return index;
      });
  }
  return indexPromise;
}

function dropUrl(id: string) {
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}

export async function getPhotoUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id) ?? null;
  const idx = await loadIndex();
  if (!idx.has(id)) return null;
  const rec = await tx<PhotoRecord>("readonly", (s) => s.get(id)).catch(() => undefined);
  const blob = rec ? recordBlob(rec) : null;
  const url = blob ? URL.createObjectURL(blob) : null;
  urlCache.set(id, url);
  return url;
}

export async function savePhoto(id: string, blob: Blob, meta: { width?: number; height?: number } = {}) {
  const rec: PhotoRecord = { id, data: await blob.arrayBuffer(), type: blob.type || "image/jpeg", updatedAt: new Date().toISOString(), ...meta };
  await tx("readwrite", (s) => s.put(rec));
  (await loadIndex()).add(id);
  dropUrl(id);
  notify();
}

export async function deletePhoto(id: string) {
  await tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
  (await loadIndex()).delete(id);
  dropUrl(id);
  notify();
}

export async function clearPhotos() {
  await tx("readwrite", (s) => s.clear()).catch(() => undefined);
  index = new Set();
  [...urlCache.keys()].forEach(dropUrl);
  notify();
}

export async function hasPhoto(id: string) {
  return (await loadIndex()).has(id);
}

/** For JSON backup: `{ [itemId]: "data:image/jpeg;base64,…" }`. */
export async function exportPhotos(): Promise<Record<string, string>> {
  const all = (await tx<PhotoRecord[]>("readonly", (s) => s.getAll()).catch(() => [])) ?? [];
  const out: Record<string, string> = {};
  for (const r of all) {
    const b = recordBlob(r);
    if (b) out[r.id] = await blobToDataUrl(b);
  }
  return out;
}

/** Restore from backup: replaces all user photos with the ones in the file. */
export async function importPhotos(photos: Record<string, string> | undefined | null, validIds?: Set<string>) {
  await clearPhotos();
  if (!photos || typeof photos !== "object") return 0;
  let n = 0;
  for (const [id, dataUrl] of Object.entries(photos)) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue;
    if (validIds && !validIds.has(id)) continue;
    const blob = await dataUrlToBlob(dataUrl);
    const rec: PhotoRecord = { id, data: await blob.arrayBuffer(), type: blob.type || "image/jpeg", updatedAt: new Date().toISOString() };
    await tx("readwrite", (s) => s.put(rec));
    (await loadIndex()).add(id);
    n++;
  }
  notify();
  return n;
}

/** React hook: object URL of the user photo for `id`, or null. Re-renders on change. */
export function useUserPhoto(id: string | undefined | null): { url: string | null; ready: boolean } {
  const [state, setState] = useState<{ url: string | null; ready: boolean }>(() =>
    id && urlCache.has(id) ? { url: urlCache.get(id) ?? null, ready: true } : { url: null, ready: !id }
  );
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = () =>
      getPhotoUrl(id)
        .then((url) => alive && setState({ url, ready: true }))
        .catch(() => alive && setState({ url: null, ready: true }));
    void load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [id]);
  return state;
}
