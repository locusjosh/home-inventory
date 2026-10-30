/**
 * Sync bookkeeping that must be written synchronously with app state:
 * per-field timestamps (for last-write-wins), tombstones, device id and the
 * pull cursor. Lives in localStorage next to the inventory itself.
 *
 * A stamp is [updatedAtMs, deviceId]. Bigger time wins; equal times fall back
 * to comparing device ids (bytewise), so every device picks the same winner.
 */
import type { InventoryItem, InventoryState } from "../types";
import { getSeedState } from "../storage";

export type Stamp = [number, string];
export type FieldMeta = Record<string, Stamp>;

export type SyncMeta = {
  v: 1;
  deviceId: string;
  /** Last stamp handed out; keeps local stamps strictly increasing. */
  clock: number;
  items: Record<string, FieldMeta>;
  itemTombs: Record<string, number>;
  purchaseTombs: Record<string, number>;
  receiptTombs: Record<string, number>;
  photoTombs: Record<string, number>;
  settings: FieldMeta;
  /** Account the cursor / uploads belong to. */
  userId: string | null;
  email: string | null;
  cursor: string | null;
  firstSyncDone: string[];
  lastSyncAt: number | null;
  /** sha256 → 1 for blobs already in this user's bucket folder. */
  uploaded: Record<string, 1>;
  /** Cloud photos not deleted: key → { sha, itemId, w, h }. */
  remotePhotos: Record<string, { sha: string; itemId: string; w?: number | null; h?: number | null }>;
  /** Local photo key → sha256 (computed once). */
  photoSha: Record<string, string>;
  /**
   * `lastSyncAt` as of the last sync completed by a links-aware build. When it
   * differs from `lastSyncAt`, an older build (one that drops `links`) synced in
   * between. Older builds keep this key untouched (getMeta spreads the stored object).
   */
  linksSyncAt?: number | null;
  /** `cursor` as last set by a links-aware build's pull (same purpose as linksSyncAt). */
  linksCursor?: string | null;
};

export const META_KEY = "home-inventory-sync-v1";

/** Item fields synced individually (everything except the id). */
export function itemFields(item: Partial<InventoryItem>): string[] {
  return Object.keys(item).filter((k) => k !== "id" && (item as Record<string, unknown>)[k] !== undefined);
}

export function cmpStamp(a: Stamp | undefined, b: Stamp | undefined): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  return a[1] === b[1] ? 0 : a[1] < b[1] ? -1 : 1;
}

/** Same value with object keys in sorted order (arrays keep their order). */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) o[k] = canonical((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}

/**
 * Value equality for sync: object key order is ignored. Postgres jsonb hands
 * objects back with its own key order (e.g. a link comes back as {url, label}),
 * so a plain JSON.stringify compare would see a change that isn't one.
 */
export const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function randomId() {
  const a = new Uint8Array(8);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(a);
  const hex = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === "0000000000000000" ? Math.random().toString(16).slice(2, 18) : hex;
}

function blankMeta(): SyncMeta {
  return {
    v: 1,
    deviceId: randomId(),
    clock: 0,
    items: {},
    itemTombs: {},
    purchaseTombs: {},
    receiptTombs: {},
    photoTombs: {},
    settings: {},
    userId: null,
    email: null,
    cursor: null,
    firstSyncDone: [],
    lastSyncAt: null,
    uploaded: {},
    remotePhotos: {},
    photoSha: {},
  };
}

let cache: SyncMeta | null = null;

export function getMeta(): SyncMeta {
  if (cache) return cache;
  let m: SyncMeta | null = null;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(META_KEY) : null;
    if (raw) m = { ...blankMeta(), ...(JSON.parse(raw) as SyncMeta) };
  } catch {
    m = null;
  }
  cache = m ?? blankMeta();
  return cache;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveMeta(now = false) {
  const write = () => {
    saveTimer = null;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(getMeta()));
    } catch (err) {
      console.warn("Could not save sync metadata", err);
    }
  };
  if (now) {
    if (saveTimer) clearTimeout(saveTimer);
    write();
  } else if (!saveTimer) {
    saveTimer = setTimeout(write, 0);
  }
}

export function nextStamp(): Stamp {
  const m = getMeta();
  const t = Math.max(Date.now(), m.clock + 1);
  m.clock = t;
  return [t, m.deviceId];
}

/**
 * First run with sync code: stamp what's already on the device. Fields still
 * equal to the starter data get time 0 (anything real beats them); fields the
 * user changed before sync existed get time 1 (they beat starter data but lose
 * to any edit made after this version shipped). Starter items the user deleted
 * become tombstones so another device's untouched copy can't bring them back.
 */
export function ensureBaseline(state: InventoryState) {
  const m = getMeta();
  if (Object.keys(m.items).length || Object.keys(m.itemTombs).length) return;
  const seed = new Map(getSeedState().items.map((i) => [i.id, i]));
  const here = new Set<string>();
  for (const item of state.items) {
    here.add(item.id);
    const s = seed.get(item.id) as Record<string, unknown> | undefined;
    const fm: FieldMeta = {};
    for (const f of itemFields(item)) {
      fm[f] = s && same(s[f], (item as Record<string, unknown>)[f]) ? [0, ""] : [1, m.deviceId];
    }
    m.items[item.id] = fm;
  }
  for (const id of seed.keys()) if (!here.has(id)) m.itemTombs[id] = 1;
  saveMeta(true);
}

export type ChangeMode = "edit" | "import" | "reset";

/** Outbox keys: "item:<id>", "purchase:<id>", "receipt:<id>", "photo:<key>", "settings". */
export type OutboxKey = string;

/**
 * Diff two app states, stamp every changed field with a fresh local stamp and
 * return the outbox keys to push. Deletions become tombstones only for normal
 * edits — restoring a backup or resetting never deletes anything in the cloud.
 */
export function recordLocalChanges(prev: InventoryState | null, next: InventoryState, mode: ChangeMode): OutboxKey[] {
  const m = getMeta();
  const keys: OutboxKey[] = [];
  const prevItems = new Map((prev?.items ?? []).map((i) => [i.id, i]));

  if (mode === "reset") {
    // Local-only: everything goes back to starter data with time-0 stamps, and
    // the next sync re-downloads the cloud copy (which wins every field).
    m.items = {};
    for (const item of next.items) {
      const fm: FieldMeta = {};
      for (const f of itemFields(item)) fm[f] = [0, ""];
      m.items[item.id] = fm;
    }
    m.cursor = null;
    saveMeta(true);
    return keys;
  }

  for (const item of next.items) {
    const p = prevItems.get(item.id) as Record<string, unknown> | undefined;
    const cur = item as Record<string, unknown>;
    const fm = (m.items[item.id] ??= {});
    let changed = false;
    const fields = new Set([...itemFields(item), ...(p ? itemFields(p as Partial<InventoryItem>) : [])]);
    for (const f of fields) {
      if (!p || !same(p[f], cur[f])) {
        fm[f] = nextStamp();
        changed = true;
      } else if (!fm[f]) {
        fm[f] = [0, ""];
      }
    }
    if (changed) keys.push(`item:${item.id}`);
    prevItems.delete(item.id);
  }
  if (mode === "edit") {
    for (const id of prevItems.keys()) {
      m.itemTombs[id] = nextStamp()[0];
      keys.push(`item:${id}`);
    }
  }

  const diffList = <T extends { id: string }>(a: T[] | undefined, b: T[] | undefined, kind: "purchase" | "receipt", tombs: Record<string, number>) => {
    const before = new Map((a ?? []).map((x) => [x.id, x]));
    for (const x of b ?? []) {
      const old = before.get(x.id);
      if (!old || !same(old, x)) keys.push(`${kind}:${x.id}`);
      before.delete(x.id);
    }
    if (mode === "edit") {
      for (const id of before.keys()) {
        tombs[id] = Date.now();
        keys.push(`${kind}:${id}`);
      }
    }
  };
  diffList(prev?.purchases, next.purchases, "purchase", m.purchaseTombs);
  diffList(prev?.receipts, next.receipts, "receipt", m.receiptTombs);

  saveMeta(true);
  return keys;
}

/** Every record currently on the device — used for the first sync of an account. */
export function allLocalKeys(state: InventoryState, photoKeys: Iterable<string>): OutboxKey[] {
  const m = getMeta();
  return [
    ...state.items.map((i) => `item:${i.id}`),
    ...Object.keys(m.itemTombs).map((id) => `item:${id}`),
    ...(state.purchases ?? []).map((p) => `purchase:${p.id}`),
    ...Object.keys(m.purchaseTombs).map((id) => `purchase:${id}`),
    ...(state.receipts ?? []).map((r) => `receipt:${r.id}`),
    ...Object.keys(m.receiptTombs).map((id) => `receipt:${id}`),
    ...[...photoKeys].map((k) => `photo:${k}`),
    ...Object.keys(m.photoTombs).map((k) => `photo:${k}`),
    "settings",
  ];
}

export type LwwResult = {
  data: Record<string, unknown>;
  meta: FieldMeta;
  /** Local side had at least one field newer than the remote side. */
  localNewer: boolean;
  /** Remote side changed at least one local field. */
  remoteChanged: boolean;
};

/** Same algorithm as public.lww_merge() in the SQL migration. */
export function lwwMerge(
  localData: Record<string, unknown>,
  localMeta: FieldMeta,
  remoteData: Record<string, unknown>,
  remoteMeta: FieldMeta
): LwwResult {
  const data: Record<string, unknown> = { ...localData };
  const meta: FieldMeta = { ...localMeta };
  let localNewer = false;
  let remoteChanged = false;
  const fields = new Set([...Object.keys(localMeta), ...Object.keys(remoteMeta), ...Object.keys(localData)]);
  for (const f of fields) {
    const c = cmpStamp(remoteMeta[f], localMeta[f] ?? (f in localData ? [0, ""] : undefined));
    if (c > 0) {
      meta[f] = remoteMeta[f];
      const had = f in data;
      if (f in remoteData) {
        if (!had || !same(data[f], remoteData[f])) remoteChanged = true;
        data[f] = remoteData[f];
      } else if (had) {
        delete data[f];
        remoteChanged = true;
      }
    } else if (c < 0) {
      localNewer = true;
    }
  }
  return { data, meta, localNewer, remoteChanged };
}

/**
 * Startup repair for links pulled by an older build. Builds without `links`
 * drop the value locally but keep the cloud's stamp (as they must, see below),
 * so after updating, equal stamps would stop the value ever being re-applied.
 *
 * Acts only when an older build may have pulled since this build last did
 * (`lastSyncAt`/`cursor` moved without this build: `linksSyncAt`/`linksCursor`
 * differ), so it runs once after an update and again only if an old cached
 * build synced in between. Then, for items that have a `links`
 * stamp but no `links` value, it forgets just that one stamp and clears the
 * pull cursor so the next pull re-reads every row and re-applies the cloud
 * value (a real deletion simply comes back as a deletion). It never touches
 * items that have links, other fields, tombstones or the outbox, and pushes
 * nothing. Any local change made under this build was pushed by the older
 * build before its sync completed, so no newer local edit is lost.
 * Returns how many stamps were cleared.
 */
export function repairDroppedLinks(state: InventoryState): number {
  const m = getMeta();
  if (m.linksSyncAt === m.lastSyncAt && m.linksCursor === m.cursor) return 0;
  let n = 0;
  for (const item of state.items) {
    const fm = m.items[item.id];
    if (fm?.links && item.links === undefined) {
      delete fm.links;
      n++;
    }
  }
  if (n) m.cursor = null;
  m.linksSyncAt = m.lastSyncAt;
  m.linksCursor = m.cursor;
  saveMeta(true);
  return n;
}

/**
 * Stamps for a local item, filling any field that has none with time 0.
 *
 * DO NOT trim this (or `meta.items[id]`) to the fields this app version knows.
 * Stamps for fields we don't know (e.g. `links` on a build that predates it)
 * must be kept and pushed unchanged: the server only overwrites or deletes a
 * field when the pushed stamp is strictly newer, so an equal stamp with no
 * value leaves the cloud copy alone. Trimming would let a future version's
 * fields be wiped by an older one. Guarded by tests/links.test.ts
 * ("sync meta keeps unknown-field stamps").
 */
export function itemMeta(item: InventoryItem): FieldMeta {
  const m = getMeta();
  const fm = { ...(m.items[item.id] ?? {}) };
  for (const f of itemFields(item)) if (!fm[f]) fm[f] = [0, ""];
  return fm;
}

export function itemData(item: InventoryItem): Record<string, unknown> {
  const d = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
  delete d.id;
  return d;
}

/** Test hook: forget the cached copy (e.g. after another tab wrote it). */
export function _resetMetaCache() {
  cache = null;
}
