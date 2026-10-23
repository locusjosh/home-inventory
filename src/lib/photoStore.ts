/**
 * User item photos live in IndexedDB (not localStorage — a single phone photo
 * would blow the ~5 MB quota). One record per photo, keyed by photo key (see
 * photoOrder.ts). Gallery order lives on the item (`photoOrder`) in app state.
 */
import { useEffect, useState } from "react";
import { blobToDataUrl, dataUrlToBlob } from "./imageFile";
import { isKeyForItem, itemIdOfKey } from "./photoOrder";

const DB_NAME = "home-inventory-photos";
const STORE = "photos";

/**
 * Bytes are stored as an ArrayBuffer (+ MIME type) rather than a Blob: WebKit
 * refuses Blob values in some IndexedDB contexts (private browsing, ephemeral
 * web views), while ArrayBuffers work everywhere.
 */
export type PhotoRecord = {
  id: string;
  itemId?: string;
  data: ArrayBuffer;
  type: string;
  updatedAt: string;
  width?: number;
  height?: number;
};

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

// ---- index of keys + url cache + change notifications ----------------------

const urlCache = new Map<string, string | null>();
const listeners = new Set<() => void>();
let index: Set<string> | null = null;
let indexPromise: Promise<Set<string>> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

// ---- sync hooks -------------------------------------------------------------
// Cloud sync listens for local saves/deletes (to queue uploads + tombstones) and
// can register photos that exist in the cloud but not yet on this device. Those
// show up in the index and are downloaded lazily the first time they're shown.

export type PhotoEvent = { type: "saved" | "deleted"; key: string };
type WriteOpts = { fromSync?: boolean };
const eventListeners = new Set<(e: PhotoEvent) => void>();
export function onPhotoEvent(fn: (e: PhotoEvent) => void) {
  eventListeners.add(fn);
  return () => void eventListeners.delete(fn);
}
function emit(e: PhotoEvent, opts?: WriteOpts) {
  if (opts?.fromSync) return;
  eventListeners.forEach((l) => {
    try {
      l(e);
    } catch (err) {
      console.error(err);
    }
  });
}

let remoteKeys = new Set<string>();
let remoteFetcher: ((key: string) => Promise<boolean>) | null = null;
const inflight = new Map<string, Promise<boolean>>();

/** Photo keys known to exist in the cloud (not deleted). Replaces the previous set. */
export function setRemotePhotoKeys(keys: Iterable<string>) {
  const next = new Set(keys);
  const same = next.size === remoteKeys.size && [...next].every((k) => remoteKeys.has(k));
  remoteKeys = next;
  if (!same) notify();
}
export function setRemotePhotoFetcher(fn: ((key: string) => Promise<boolean>) | null) {
  remoteFetcher = fn;
}
function fetchRemote(key: string) {
  if (!remoteFetcher) return;
  if (inflight.has(key)) return;
  const p = remoteFetcher(key)
    .catch(() => false)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
}

/** Keys stored on this device (no cloud-only keys). */
export function loadLocalIndex(): Promise<Set<string>> {
  return loadIndex();
}

export function hasLocalPhoto(key: string): boolean {
  return Boolean(index?.has(key));
}

export async function getPhotoRecord(key: string): Promise<PhotoRecord | null> {
  const rec = await tx<PhotoRecord>("readonly", (s) => s.get(key)).catch(() => undefined);
  return rec ?? null;
}

export async function listPhotoRecordsMeta(): Promise<Array<Pick<PhotoRecord, "id" | "itemId" | "width" | "height">>> {
  const all = (await tx<PhotoRecord[]>("readonly", (s) => s.getAll()).catch(() => [])) ?? [];
  return all.map((r) => ({ id: r.id, itemId: r.itemId, width: r.width, height: r.height }));
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

function dropUrl(key: string) {
  const u = urlCache.get(key);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(key);
}

export async function getPhotoUrl(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key) ?? null;
  const idx = await loadIndex();
  if (!idx.has(key)) {
    // Cloud-only photo: download in the background; listeners re-render when it lands.
    if (remoteKeys.has(key)) fetchRemote(key);
    return null;
  }
  const rec = await tx<PhotoRecord>("readonly", (s) => s.get(key)).catch(() => undefined);
  const blob = rec ? recordBlob(rec) : null;
  const url = blob ? URL.createObjectURL(blob) : null;
  urlCache.set(key, url);
  return url;
}

async function putRecord(key: string, blob: Blob, meta: { width?: number; height?: number } = {}) {
  const rec: PhotoRecord = {
    id: key,
    itemId: itemIdOfKey(key),
    data: await blob.arrayBuffer(),
    type: blob.type || "image/jpeg",
    updatedAt: new Date().toISOString(),
    ...meta,
  };
  await tx("readwrite", (s) => s.put(rec));
  (await loadIndex()).add(key);
  dropUrl(key);
}

export async function savePhoto(
  key: string,
  blob: Blob,
  meta: { width?: number; height?: number } = {},
  opts?: WriteOpts
) {
  await putRecord(key, blob, meta);
  notify();
  emit({ type: "saved", key }, opts);
}

export async function deletePhoto(key: string, opts?: WriteOpts) {
  await tx("readwrite", (s) => s.delete(key)).catch(() => undefined);
  (await loadIndex()).delete(key);
  if (opts?.fromSync) remoteKeys.delete(key);
  dropUrl(key);
  notify();
  emit({ type: "deleted", key }, opts);
}

export async function deletePhotosForItem(itemId: string, opts?: WriteOpts) {
  const idx = await loadIndex();
  const keys = [...new Set([...idx, ...remoteKeys])].filter((k) => isKeyForItem(k, itemId));
  if (!keys.length) return;
  await tx("readwrite", (s) => {
    keys.forEach((k) => s.delete(k));
  }).catch(() => undefined);
  keys.forEach((k) => {
    idx.delete(k);
    remoteKeys.delete(k);
    dropUrl(k);
  });
  notify();
  keys.forEach((k) => emit({ type: "deleted", key: k }, opts));
}

export async function clearPhotos() {
  await tx("readwrite", (s) => s.clear()).catch(() => undefined);
  index = new Set();
  indexPromise = Promise.resolve(index);
  [...urlCache.keys()].forEach(dropUrl);
  notify();
}

/** For JSON backup: `{ [photoKey]: "data:image/jpeg;base64,…" }`. Order lives on items[].photoOrder. */
export async function exportPhotos(): Promise<Record<string, string>> {
  const all = (await tx<PhotoRecord[]>("readonly", (s) => s.getAll()).catch(() => [])) ?? [];
  const out: Record<string, string> = {};
  for (const r of all) {
    const b = recordBlob(r);
    if (b) out[r.id] = await blobToDataUrl(b);
  }
  return out;
}

/**
 * Restore from backup: replaces all user photos with the ones in the file.
 * Accepts both formats — v4 (keyed by bare item id, one photo per item) and
 * v5 (keyed by photo key). Photos for items not in the backup are skipped.
 */
export async function importPhotos(photos: Record<string, string> | undefined | null, validItemIds?: Set<string>) {
  await clearPhotos();
  if (!photos || typeof photos !== "object") return 0;
  let n = 0;
  for (const [key, dataUrl] of Object.entries(photos)) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue;
    if (validItemIds && !validItemIds.has(itemIdOfKey(key))) continue;
    await putRecord(key, await dataUrlToBlob(dataUrl));
    emit({ type: "saved", key });
    n++;
  }
  notify();
  return n;
}

/** Set of photo keys in IndexedDB (null until loaded). Re-renders on change. */
export function usePhotoIndex(): Set<string> | null {
  const [loaded, setLoaded] = useState<Set<string> | null>(() => (index ? new Set([...index, ...remoteKeys]) : null));
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void loadIndex().then((s) => {
        if (alive) setLoaded(new Set([...s, ...remoteKeys]));
      });
    refresh();
    listeners.add(refresh);
    return () => {
      alive = false;
      listeners.delete(refresh);
    };
  }, []);
  return loaded;
}

/** Object URLs for the given keys. `loaded` once every key has been looked up. */
export function usePhotoUrls(keys: string[]): { urls: Record<string, string>; loaded: boolean } {
  const sig = keys.join("|");
  const [state, setState] = useState<{ sig: string; urls: Record<string, string> }>(() => {
    const o: Record<string, string> = {};
    let all = true;
    for (const k of keys) {
      const u = urlCache.get(k);
      if (u) o[k] = u;
      else all = false;
    }
    return { sig: all ? sig : "\u0000", urls: o };
  });
  useEffect(() => {
    let alive = true;
    const ks = sig ? sig.split("|") : [];
    const load = async () => {
      const o: Record<string, string> = {};
      for (const k of ks) {
        const u = await getPhotoUrl(k).catch(() => null);
        if (u) o[k] = u;
      }
      if (alive) setState({ sig: ks.join("|"), urls: o });
    };
    void load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [sig]);
  return { urls: state.urls, loaded: state.sig === sig };
}
