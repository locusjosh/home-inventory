/**
 * Local store for count sessions + the count log (localStorage key
 * `home-inventory-counts-v1`). Kept apart from the inventory state on purpose:
 * older app versions never read or write this key, and nothing here can touch
 * items, photos, purchases or receipts.
 *
 * Sessions use the same per-field last-write-wins stamps as items (so two
 * devices counting different items merge cleanly), with one exception: the
 * status only moves forward (see STATUS_RANK). Log entries are append-only.
 */
import { lwwMerge, nextStamp, type FieldMeta } from "../sync/meta";
import {
  STATUS_RANK,
  type CountEntry,
  type CountLine,
  type CountSession,
  type CountStatus,
} from "./model";

export const COUNTS_KEY = "home-inventory-counts-v1";

type SessionRec = { data: Record<string, unknown>; meta: FieldMeta };
type Store = {
  v: 1;
  sessions: Record<string, SessionRec>;
  entries: Record<string, CountEntry>;
  /** Pull cursor for the two count tables (separate from the item cursor). */
  cursor: string | null;
  /** Account the cursor belongs to. */
  userId: string | null;
};

const blank = (): Store => ({ v: 1, sessions: {}, entries: {}, cursor: null, userId: null });

let cache: Store | null = null;
let version = 0;
const listeners = new Set<() => void>();
let changeHook: ((keys: string[]) => void) | null = null;

function load(): Store {
  if (cache) return cache;
  let s: Store | null = null;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(COUNTS_KEY) : null;
    if (raw) s = { ...blank(), ...(JSON.parse(raw) as Store) };
  } catch {
    s = null;
  }
  cache = s ?? blank();
  return cache;
}

function save() {
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(load()));
  } catch (err) {
    console.warn("Could not save count data", err);
  }
  version++;
  sessionCache = null;
  listeners.forEach((l) => l());
}

/** The sync engine registers here to queue changed keys for upload. */
export function setCountsChangeHook(fn: (keys: string[]) => void) {
  changeHook = fn;
}
const queue = (keys: string[]) => {
  if (keys.length) changeHook?.(keys);
};

export function subscribeCounts(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const countsVersion = () => version;

// ------------------------------------------------------------ conversion ---

const LINE = "line:";

function toSession(id: string, d: Record<string, unknown>): CountSession {
  const lines: Record<string, CountLine> = {};
  for (const [k, v] of Object.entries(d)) if (k.startsWith(LINE) && v && typeof v === "object") lines[k.slice(LINE.length)] = v as CountLine;
  return {
    id,
    status: (d.status as CountStatus) ?? "active",
    scope: (d.scope as CountSession["scope"]) ?? { kind: "all" },
    itemIds: Array.isArray(d.itemIds) ? (d.itemIds as string[]) : [],
    expected: (d.expected as Record<string, number>) ?? {},
    lines,
    pos: typeof d.pos === "number" ? d.pos : 0,
    startedAt: String(d.startedAt ?? new Date(0).toISOString()),
    endedAt: (d.endedAt as string | null) ?? null,
    deviceId: String(d.deviceId ?? ""),
    deviceLabel: String(d.deviceLabel ?? ""),
    totals: (d.totals as CountSession["totals"]) ?? null,
  };
}

function flatten(s: Partial<CountSession>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "id" || v === undefined) continue;
    if (k === "lines") {
      for (const [itemId, line] of Object.entries(v as Record<string, CountLine>)) out[LINE + itemId] = line;
    } else out[k] = v;
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ----------------------------------------------------------------- reads ---

let sessionCache: CountSession[] | null = null;
/** All sessions, newest first. */
export function listSessions(): CountSession[] {
  if (sessionCache) return sessionCache;
  const st = load();
  sessionCache = Object.entries(st.sessions)
    .map(([id, r]) => toSession(id, r.data))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return sessionCache;
}

export function getSession(id: string): CountSession | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

/** The count in progress (most recent active or in review), if any. */
export function activeSession(): CountSession | null {
  return listSessions().find((s) => s.status === "active" || s.status === "reviewing") ?? null;
}

/** All log entries, newest first. */
export function listEntries(): CountEntry[] {
  return Object.values(load().entries).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

// ---------------------------------------------------------------- writes ---

export function createSession(s: CountSession) {
  const st = load();
  const data = flatten(s);
  const meta: FieldMeta = {};
  for (const k of Object.keys(data)) meta[k] = nextStamp();
  st.sessions[s.id] = { data, meta };
  save();
  queue([`count:${s.id}`]);
}

/** Change some session fields (only fields whose value really changed get a new stamp). */
export function patchSession(id: string, patch: Partial<CountSession>) {
  const st = load();
  const rec = st.sessions[id];
  if (!rec) return;
  const flat = flatten(patch);
  let changed = false;
  for (const [k, v] of Object.entries(flat)) {
    if (k === "status" && STATUS_RANK[v as CountStatus] < STATUS_RANK[(rec.data.status as CountStatus) ?? "active"]) {
      // Allowed locally only for review → active ("Keep Counting"); never out of a finished state.
      if (!(rec.data.status === "reviewing" && v === "active")) continue;
    }
    if (same(rec.data[k], v)) continue;
    rec.data[k] = v;
    rec.meta[k] = nextStamp();
    changed = true;
  }
  if (!changed) return;
  save();
  queue([`count:${id}`]);
}

export function setLine(sessionId: string, itemId: string, line: Omit<CountLine, "at">, pos?: number) {
  patchSession(sessionId, { lines: { [itemId]: { ...line, at: Date.now() } }, ...(pos != null ? { pos } : {}) });
}

export function addEntries(entries: CountEntry[]) {
  if (!entries.length) return;
  const st = load();
  for (const e of entries) if (!st.entries[e.id]) st.entries[e.id] = e;
  save();
  queue(entries.map((e) => `centry:${e.id}`));
}

/** Merge count data from a backup file (never replaces or removes anything already here). */
export function importCounts(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const d = data as { sessions?: Array<{ id: string; data: Record<string, unknown>; meta: FieldMeta }>; entries?: CountEntry[] };
  const st = load();
  const keys: string[] = [];
  for (const r of Array.isArray(d.sessions) ? d.sessions : []) {
    if (!r?.id || !r.data) continue;
    if (mergeSessionRow(r.id, r.data, r.meta ?? {})) keys.push(`count:${r.id}`);
  }
  for (const e of Array.isArray(d.entries) ? d.entries : []) {
    if (!e?.id || !e.itemId || st.entries[e.id]) continue;
    st.entries[e.id] = e;
    keys.push(`centry:${e.id}`);
  }
  if (keys.length) {
    save();
    queue(keys);
  }
  return keys.length;
}

/** For backup files (format v6). */
export function exportCounts() {
  const st = load();
  return {
    sessions: Object.entries(st.sessions).map(([id, r]) => ({ id, data: r.data, meta: r.meta })),
    entries: Object.values(st.entries),
  };
}

// ------------------------------------------------------------------ sync ---

/** Merge one remote/imported session row. Returns true when local had something newer. */
function mergeSessionRow(id: string, rData: Record<string, unknown>, rMetaIn: FieldMeta): boolean {
  const st = load();
  const local = st.sessions[id];
  if (!local) {
    st.sessions[id] = { data: { ...rData }, meta: { ...rMetaIn } };
    return false;
  }
  const rMeta = { ...rMetaIn };
  const lMeta = { ...local.meta };
  const lr = STATUS_RANK[(local.data.status as CountStatus) ?? "active"] ?? 0;
  const rr = STATUS_RANK[(rData.status as CountStatus) ?? "active"] ?? 0;
  if ("status" in rData) {
    if (rr < lr) delete rMeta.status;
    else if (rr > lr) lMeta.status = [0, ""];
  }
  const res = lwwMerge(local.data, lMeta, rData, rMeta);
  // Keep the stronger local status stamp if remote's status was ignored.
  if (rr < lr && local.meta.status) res.meta.status = local.meta.status;
  st.sessions[id] = { data: res.data, meta: res.meta };
  return res.localNewer || (rr < lr && "status" in rData);
}

export type RemoteRow = Record<string, unknown> & { id: string; updated_at: string };

/** Apply pulled rows. Returns keys that should be pushed again (local was newer). */
export function applyRemoteCounts(counts: RemoteRow[], entries: RemoteRow[]): string[] {
  const st = load();
  const repush: string[] = [];
  let changed = false;
  for (const r of counts) {
    if (r.deleted) continue;
    const before = JSON.stringify(st.sessions[r.id] ?? null);
    if (mergeSessionRow(r.id, (r.data ?? {}) as Record<string, unknown>, (r.meta ?? {}) as FieldMeta)) repush.push(`count:${r.id}`);
    if (JSON.stringify(st.sessions[r.id]) !== before) changed = true;
  }
  for (const r of entries) {
    if (r.deleted || st.entries[r.id]) continue;
    const e = r.data as CountEntry;
    if (!e || !e.itemId) continue;
    st.entries[r.id] = { ...e, id: r.id };
    changed = true;
  }
  if (changed) save();
  else if (repush.length) save();
  return repush;
}

export function countsCursor(userId: string): string | null {
  const st = load();
  if (st.userId !== userId) {
    st.userId = userId;
    st.cursor = null;
    save();
  }
  return st.cursor;
}
export function setCountsCursor(cursor: string | null) {
  const st = load();
  st.cursor = cursor;
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(st));
  } catch {
    /* ignore */
  }
}

/** Every count record on this device (first sync of an account). */
export function allCountKeys(): string[] {
  const st = load();
  return [...Object.keys(st.sessions).map((id) => `count:${id}`), ...Object.keys(st.entries).map((id) => `centry:${id}`)];
}

export function sessionRowForPush(id: string) {
  const r = load().sessions[id];
  return r ? { id, data: r.data, meta: r.meta } : null;
}
export function entryRowForPush(id: string) {
  const e = load().entries[id];
  return e ? { id, item_id: e.itemId, session_id: e.sessionId, data: e } : null;
}

/** Test hook: forget the cached copy. */
export function _resetCountsCache() {
  cache = null;
  sessionCache = null;
}
