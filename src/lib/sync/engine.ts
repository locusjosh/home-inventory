/**
 * Offline-first cloud sync (Supabase).
 *
 * Every change is saved locally first (localStorage / IndexedDB as before) and
 * its record key is queued in the IndexedDB outbox. A sync run pushes the
 * outbox through one RPC (sync_push — the server merges per field), then pulls
 * everything changed since the last cursor and merges it into local state.
 *
 * Runs on app open, when the app becomes visible, when the network comes back,
 * on a Realtime postgres_changes ping, after local edits (debounced) and on
 * Sync Now. Without config (src/lib/supabaseConfig.ts) none of this loads.
 */
import type { RealtimeChannel, Session, SupabaseClient } from "@supabase/supabase-js";
import type { InventoryItem, InventoryState, Purchase, ReceiptRecord } from "../types";
import { normalizeItem, normalizePurchase, normalizeReceipt } from "../storage";
import { supabaseAnonKey, supabaseUrl, syncConfigured } from "../supabaseConfig";
import {
  deletePhoto,
  deletePhotosForItem,
  getPhotoRecord,
  hasLocalPhoto,
  listPhotoRecordsMeta,
  loadLocalIndex,
  onPhotoEvent,
  savePhoto,
  setRemotePhotoFetcher,
  setRemotePhotoKeys,
} from "../photoStore";
import { itemIdOfKey } from "../photoOrder";
import { buildBackupJson } from "../backup";
import {
  allLocalKeys,
  ensureBaseline,
  getMeta,
  itemData,
  itemMeta,
  lwwMerge,
  nextStamp,
  recordLocalChanges,
  saveMeta,
  type ChangeMode,
  type FieldMeta,
} from "./meta";
import { ack, enqueue, listBackups, listOutbox, onOutboxChange, outboxCount, saveBackup, type OutboxEntry } from "./outbox";
import { readSettings, writeSettings, type SyncedSettings } from "./settings";
import {
  allCountKeys,
  applyRemoteCounts,
  countsCursor,
  entryRowForPush,
  sessionRowForPush,
  setCountsChangeHook,
  setCountsCursor,
  type RemoteRow,
} from "../counts/store";

export const PHOTO_BUCKET = "item-photos";
const TABLES = ["items", "purchases", "receipts", "photos", "settings"] as const;
/** Count sessions + count log (migration 0003). Synced separately so a project without them still syncs everything else. */
const COUNT_TABLES = ["counts", "count_entries"] as const;
const isCountKey = (k: string) => k.startsWith("count:") || k.startsWith("centry:");
/** Set when the cloud project doesn't have the count tables yet: count changes stay queued on this device. */
let countsCloudMissing = false;

// Count sessions / log entries queue themselves through this hook.
setCountsChangeHook((keys) => {
  if (!syncConfigured) return;
  void enqueue(keys).then(() => syncSoon(1500));
});

// ---------------------------------------------------------------- status ---

export type SyncPhase = "off" | "starting" | "signed-out" | "idle" | "syncing" | "offline" | "error";
export type SyncStatus = {
  configured: boolean;
  phase: SyncPhase;
  email: string | null;
  pending: number;
  lastSyncAt: number | null;
  error: string | null;
};

let status: SyncStatus = {
  configured: syncConfigured,
  phase: syncConfigured ? "starting" : "off",
  email: null,
  pending: 0,
  lastSyncAt: null,
  error: null,
};
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}
export function getSyncStatus() {
  return status;
}
export function subscribeSyncStatus(fn: () => void) {
  statusListeners.add(fn);
  return () => void statusListeners.delete(fn);
}

// ---------------------------------------------------------------- client ---

let clientPromise: Promise<SupabaseClient> | null = null;
function getClient(): Promise<SupabaseClient> {
  if (!syncConfigured) return Promise.reject(new Error("Sync is not set up"));
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "home-inventory-auth",
        },
      })
    );
  }
  return clientPromise;
}

// ---------------------------------------------------------------- bridge ---

type Bridge = {
  getState(): InventoryState | null;
  /** Replace app state with a merged version (saved, rendered, not re-queued). */
  applyRemote(next: InventoryState): void;
};
let bridge: Bridge | null = null;
let started = false;
let session: Session | null = null;
let channel: RealtimeChannel | null = null;
let countsChannel: RealtimeChannel | null = null;

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/** Called by InventoryProvider once local state is loaded. */
export function initSync(b: Bridge) {
  bridge = b;
  const state = b.getState();
  if (state) ensureBaseline(state);
  if (!syncConfigured || started || typeof window === "undefined") return;
  started = true;

  const m = getMeta();
  setStatus({ email: m.email, lastSyncAt: m.lastSyncAt });
  setRemotePhotoKeys(Object.keys(m.remotePhotos));
  setRemotePhotoFetcher(downloadPhoto);
  onPhotoEvent(onLocalPhotoEvent);
  onOutboxChange(() => void refreshPending());
  void refreshPending();

  window.addEventListener("online", () => syncSoon(0));
  window.addEventListener("offline", () => {
    if (session) setStatus({ phase: "offline" });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncSoon(0);
  });

  void getClient()
    .then(async (c) => {
      c.auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_OUT") {
          session = null;
          stopRealtime();
          setStatus({ phase: "signed-out", error: null });
        } else if (s) {
          session = s;
        }
      });
      const { data } = await c.auth.getSession();
      if (data.session) {
        onSignedIn(data.session);
        syncSoon(0);
      } else {
        setStatus({ phase: "signed-out" });
      }
    })
    .catch((err) => setStatus({ phase: "error", error: plainError(err) }));

  (window as unknown as { __hiSync?: unknown }).__hiSync = { syncNow, getSyncStatus, getMeta, outboxCount, countsCloudMissing: () => countsCloudMissing };
}

async function refreshPending() {
  if (!syncConfigured) return;
  // While the cloud has no count tables, queued count changes aren't "pending" in the user's sense.
  const n = countsCloudMissing ? (await listOutbox()).filter((e) => !isCountKey(e.key)).length : await outboxCount();
  if (n !== status.pending) setStatus({ pending: n });
}

/** Hook for InventoryProvider.persist: stamp + queue whatever changed. */
export function noteLocalChange(prev: InventoryState | null, next: InventoryState, mode: ChangeMode = "edit") {
  const keys = recordLocalChanges(prev, next, mode);
  if (!syncConfigured) return;
  if (mode === "reset") {
    syncSoon(500);
    return;
  }
  if (keys.length) void enqueue(keys).then(() => syncSoon(1500));
}

/** Hook for synced settings (appearance, voice replies). */
export function noteSettingChanged(name: keyof SyncedSettings) {
  const m = getMeta();
  m.settings[name] = nextStamp();
  saveMeta(true);
  if (!syncConfigured) return;
  void enqueue(["settings"]).then(() => syncSoon(1500));
}

function onLocalPhotoEvent(e: { type: "saved" | "deleted"; key: string }) {
  if (!syncConfigured) return;
  const m = getMeta();
  if (e.type === "deleted") {
    m.photoTombs[e.key] = Date.now();
    delete m.remotePhotos[e.key];
  }
  saveMeta();
  void enqueue([`photo:${e.key}`]).then(() => syncSoon(1500));
}

// ------------------------------------------------------------------ auth ---

/** Wrong PIN / locked out. `retryAfter` (seconds) is set while PIN sign-in is locked. */
export class PinError extends Error {
  constructor(message: string, readonly kind: "wrong" | "locked" | "other", readonly retryAfter = 0) {
    super(message);
  }
}

/**
 * PIN sign-in: the pin-login Edge Function checks the PIN server-side and hands
 * back a one-time magic-link token hash, which becomes a normal session here.
 */
export async function pinSignIn(pin: string) {
  const c = await getClient();
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/pin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
      body: JSON.stringify({ pin }),
    });
  } catch {
    throw new PinError("Can’t reach the sync server. Check your connection and try again.", "other");
  }
  const body = (await res.json().catch(() => ({}))) as { token_hash?: string; error?: string; retryAfter?: number };
  if (res.status === 401) throw new PinError("Incorrect code.", "wrong");
  if (res.status === 429) throw new PinError("Too many tries.", "locked", Math.max(1, Number(body.retryAfter) || 60));
  if (!res.ok || !body.token_hash) {
    throw new PinError(
      res.status === 404 || res.status === 503 ? "Code sign-in isn’t set up yet." : "Couldn’t sign in. Try again in a moment.",
      "other"
    );
  }
  const { data, error } = await c.auth.verifyOtp({ token_hash: body.token_hash, type: "magiclink" });
  if (error || !data.session) throw new PinError("Couldn’t sign in. Try again in a moment.", "other");
  onSignedIn(data.session);
  await syncNow();
}

export async function signOut() {
  stopRealtime();
  const c = await getClient();
  try {
    await c.auth.signOut({ scope: "local" });
  } catch {
    /* local session is cleared regardless */
  }
  session = null;
  setStatus({ phase: "signed-out", error: null });
}

function onSignedIn(s: Session) {
  session = s;
  const m = getMeta();
  if (m.userId !== s.user.id) {
    // Different account than last time: start its sync state fresh (local data is kept).
    m.userId = s.user.id;
    m.cursor = null;
    m.uploaded = {};
    m.remotePhotos = {};
    setRemotePhotoKeys([]);
  }
  m.email = s.user.email ?? null;
  saveMeta(true);
  setStatus({ email: m.email, phase: online() ? "idle" : "offline", error: null });
  startRealtime(s.user.id);
}

// -------------------------------------------------------------- realtime ---

function startRealtime(uid: string) {
  stopRealtime();
  void getClient().then((c) => {
    const ch = c.channel(`hi-sync-${uid}`);
    for (const t of TABLES) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `user_id=eq.${uid}` }, () => syncSoon(400));
    }
    ch.subscribe();
    channel = ch;
    // Separate channel: if the count tables don't exist yet, only this one fails.
    const cc = c.channel(`hi-counts-${uid}`);
    for (const t of COUNT_TABLES) {
      cc.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `user_id=eq.${uid}` }, () => syncSoon(400));
    }
    cc.subscribe();
    countsChannel = cc;
  });
}

function stopRealtime() {
  const ch = channel;
  const cc = countsChannel;
  channel = null;
  countsChannel = null;
  if (ch) void getClient().then((c) => c.removeChannel(ch));
  if (cc) void getClient().then((c) => c.removeChannel(cc));
}

// ---------------------------------------------------------------- runner ---

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;
let backoff = 0;

export function syncSoon(ms = 1000) {
  if (!syncConfigured || typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, ms);
}

export function syncNow(): Promise<void> {
  if (!syncConfigured) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = runSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      syncSoon(200);
    }
  });
  return running;
}

async function runSync() {
  const c = await getClient();
  if (!session) {
    const { data } = await c.auth.getSession();
    if (!data.session) {
      setStatus({ phase: "signed-out" });
      return;
    }
    onSignedIn(data.session);
  }
  if (!online()) {
    setStatus({ phase: "offline" });
    return;
  }
  const uid = session!.user.id;
  const m = getMeta();
  const signedOutMeanwhile = () => !session || session.user.id !== uid;
  setStatus({ phase: "syncing" });
  try {
    const first = !m.firstSyncDone.includes(uid);
    if (first) await prepareFirstSync();
    await push(c, uid);
    await pull(c, uid);
    if ((await outboxCount()) > 0) await push(c, uid);
    if (first) m.firstSyncDone.push(uid);
    m.lastSyncAt = Date.now();
    saveMeta(true);
    backoff = 0;
    if (signedOutMeanwhile()) setStatus({ phase: "signed-out", lastSyncAt: m.lastSyncAt });
    else setStatus({ phase: "idle", error: null, lastSyncAt: m.lastSyncAt });
  } catch (err) {
    console.warn("Sync failed", err);
    if (signedOutMeanwhile()) {
      setStatus({ phase: "signed-out", error: null });
      return;
    }
    if (isAuthExpired(err)) {
      setStatus({ phase: "error", error: "Your sign-in has expired. Sign out and sign in again to keep syncing." });
      return;
    }
    if (!online() || isNetworkError(err)) {
      // Can't reach the server: that's "Offline", not an error. Changes stay queued.
      setStatus({ phase: "offline", error: null });
    } else {
      setStatus({ phase: "error", error: plainError(err) });
    }
    backoff = Math.min(backoff ? backoff * 2 : 15_000, 300_000);
    syncSoon(backoff);
  } finally {
    void refreshPending();
  }
}

/** First sync for this account on this device: keep a full local backup, then queue everything. */
async function prepareFirstSync() {
  const state = bridge?.getState();
  if (!state) throw new Error("App data isn’t loaded yet");
  const m = getMeta();
  const id = `pre-sync-${m.userId}`;
  const existing = (await listBackups()).some((b) => b.id === id);
  if (!existing) {
    await saveBackup({ id, createdAt: new Date().toISOString(), email: m.email, json: await buildBackupJson(state) });
  }
  const photos = await listPhotoRecordsMeta();
  await enqueue([...allLocalKeys(state, photos.map((p) => p.id)), ...allCountKeys()]);
}

// ------------------------------------------------------------------ push ---

type ItemRow = { id: string; data: Record<string, unknown>; meta: FieldMeta; deleted?: boolean; deleted_at?: number | null };
type ListRow = { id: string; item_id?: string | null; data: Record<string, unknown>; deleted?: boolean };
type PhotoRow = { id: string; item_id: string; sha256?: string | null; width?: number | null; height?: number | null; deleted?: boolean };

function settingsMeta(): FieldMeta {
  const m = getMeta();
  const fm: FieldMeta = { ...m.settings };
  for (const k of Object.keys(readSettings())) if (!fm[k]) fm[k] = [0, ""];
  return fm;
}

async function push(c: SupabaseClient, uid: string) {
  const all = await listOutbox();
  const entries = all.filter((e) => !isCountKey(e.key));
  await pushCounts(c, all.filter((e) => isCountKey(e.key)));
  if (!entries.length) return;
  const m = getMeta();
  const CHUNK = 150;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const state = bridge?.getState();
    if (!state) throw new Error("App data isn’t loaded yet");
    const items = new Map(state.items.map((x) => [x.id, x]));
    const purchases = new Map((state.purchases ?? []).map((x) => [x.id, x]));
    const receipts = new Map((state.receipts ?? []).map((x) => [x.id, x]));
    const p_items: ItemRow[] = [];
    const p_purchases: ListRow[] = [];
    const p_receipts: ListRow[] = [];
    const p_photos: PhotoRow[] = [];
    const p_settings: Array<{ id: string; data: Record<string, unknown>; meta: FieldMeta }> = [];
    for (const e of chunk) {
      const sep = e.key.indexOf(":");
      const kind = sep === -1 ? e.key : e.key.slice(0, sep);
      const id = sep === -1 ? "" : e.key.slice(sep + 1);
      if (kind === "item") {
        if (m.itemTombs[id]) p_items.push({ id, data: {}, meta: {}, deleted: true, deleted_at: m.itemTombs[id] });
        else {
          const it = items.get(id);
          if (it) p_items.push({ id, data: itemData(it), meta: itemMeta(it) });
        }
      } else if (kind === "purchase") {
        if (m.purchaseTombs[id]) p_purchases.push({ id, data: {}, deleted: true });
        else {
          const p = purchases.get(id);
          if (p) p_purchases.push({ id, item_id: p.itemId, data: p as unknown as Record<string, unknown> });
        }
      } else if (kind === "receipt") {
        if (m.receiptTombs[id]) p_receipts.push({ id, data: {}, deleted: true });
        else {
          const r = receipts.get(id);
          if (r) p_receipts.push({ id, data: r as unknown as Record<string, unknown> });
        }
      } else if (kind === "photo") {
        if (m.photoTombs[id]) p_photos.push({ id, item_id: itemIdOfKey(id), deleted: true });
        else {
          const up = await ensureUploaded(c, uid, id);
          if (up) p_photos.push({ id, item_id: itemIdOfKey(id), sha256: up.sha, width: up.w ?? null, height: up.h ?? null });
        }
      } else if (kind === "settings") {
        p_settings.push({ id: "app", data: readSettings() as unknown as Record<string, unknown>, meta: settingsMeta() });
      }
    }
    if (p_items.length + p_purchases.length + p_receipts.length + p_photos.length + p_settings.length) {
      const { error } = await c.rpc("sync_push", { p_items, p_settings, p_purchases, p_receipts, p_photos });
      if (error) throw error;
    }
    saveMeta(true);
    await ack(chunk as OutboxEntry[]);
  }
}

/** Missing table / function in the cloud project (migration 0003 not applied yet). */
function isMissingSchema(err: unknown) {
  const e = err as { code?: string; message?: string; status?: number };
  return (
    e?.code === "PGRST202" || e?.code === "PGRST205" || e?.code === "42P01" || e?.code === "42883" ||
    /could not find the (function|table)|does not exist|schema cache/i.test(e?.message || "")
  );
}

/** Count sessions + log entries → sync_push_counts. Never blocks the item sync. */
async function pushCounts(c: SupabaseClient, entries: OutboxEntry[]) {
  if (!entries.length) return;
  const CHUNK = 200;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const p_counts: unknown[] = [];
    const p_entries: unknown[] = [];
    for (const e of chunk) {
      const sep = e.key.indexOf(":");
      const kind = e.key.slice(0, sep);
      const id = e.key.slice(sep + 1);
      if (kind === "count") {
        const r = sessionRowForPush(id);
        if (r) p_counts.push(r);
      } else {
        const r = entryRowForPush(id);
        if (r) p_entries.push(r);
      }
    }
    if (p_counts.length + p_entries.length) {
      const { error } = await c.rpc("sync_push_counts", { p_counts, p_entries });
      if (error) {
        if (isMissingSchema(error)) {
          // Keep them queued; they go up once the cloud has the count tables.
          countsCloudMissing = true;
          return;
        }
        throw error;
      }
    }
    countsCloudMissing = false;
    await ack(chunk);
  }
}

async function pullCounts(c: SupabaseClient, uid: string) {
  const cursor = countsCursor(uid);
  const since = cursor ? new Date(Date.parse(cursor) - 60_000).toISOString() : null;
  const rows: Record<string, Row[]> = {};
  let max = cursor ? Date.parse(cursor) : 0;
  let maxStr = cursor;
  try {
    for (const t of COUNT_TABLES) {
      rows[t] = await fetchSince(c, uid, t, since);
      for (const r of rows[t]) {
        const ts = Date.parse(r.updated_at);
        if (ts > max) {
          max = ts;
          maxStr = r.updated_at;
        }
      }
    }
  } catch (err) {
    if (isMissingSchema(err)) {
      countsCloudMissing = true;
      return;
    }
    throw err;
  }
  countsCloudMissing = false;
  const repush = applyRemoteCounts((rows.counts ?? []) as RemoteRow[], (rows.count_entries ?? []) as RemoteRow[]);
  setCountsCursor(maxStr ?? null);
  if (repush.length) await enqueue(repush);
}

async function sha256Hex(buf: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) throw new Error("Photo sync needs a secure (https) page");
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureUploaded(c: SupabaseClient, uid: string, key: string) {
  const rec = await getPhotoRecord(key);
  if (!rec) return null;
  const m = getMeta();
  const sha = m.photoSha[key] ?? (await sha256Hex(rec.data));
  m.photoSha[key] = sha;
  if (!m.uploaded[sha]) {
    const { error } = await c.storage
      .from(PHOTO_BUCKET)
      .upload(`${uid}/${sha}.jpg`, new Blob([rec.data], { type: "image/jpeg" }), {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "31536000",
      });
    if (error && !isDuplicate(error)) throw error;
    m.uploaded[sha] = 1;
  }
  return { sha, w: rec.width, h: rec.height };
}

function isDuplicate(err: unknown) {
  const e = err as { statusCode?: string | number; status?: number; message?: string };
  return String(e?.statusCode) === "409" || e?.status === 409 || /already exists|duplicate/i.test(e?.message || "");
}

// ------------------------------------------------------------------ pull ---

type Row = Record<string, unknown> & { id: string; updated_at: string };

async function fetchSince(c: SupabaseClient, uid: string, table: string, since: string | null): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = c.from(table).select("*").eq("user_id", uid).order("updated_at").order("id").range(from, from + PAGE - 1);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function pull(c: SupabaseClient, uid: string) {
  const m = getMeta();
  // Re-read a minute of overlap: merging is idempotent, and it covers rows
  // committed slightly out of order around the previous cursor.
  const since = m.cursor ? new Date(Date.parse(m.cursor) - 60_000).toISOString() : null;
  const rows: Record<string, Row[]> = {};
  let max = m.cursor ? Date.parse(m.cursor) : 0;
  let maxStr = m.cursor;
  for (const t of TABLES) {
    rows[t] = await fetchSince(c, uid, t, since);
    for (const r of rows[t]) {
      const ts = Date.parse(r.updated_at);
      if (ts > max) {
        max = ts;
        maxStr = r.updated_at;
      }
    }
  }
  await loadLocalIndex();
  const sideEffects = applyRemote(rows);
  m.cursor = maxStr ?? null;
  saveMeta(true);
  if (sideEffects.repush.length) await enqueue(sideEffects.repush);
  for (const id of sideEffects.deletedItems) await deletePhotosForItem(id, { fromSync: true });
  for (const key of sideEffects.deletedPhotos) await deletePhoto(key, { fromSync: true });
  setRemotePhotoKeys(Object.keys(m.remotePhotos));
  await pullCounts(c, uid);
}

/** Synchronous merge of pulled rows into the latest local state. */
function applyRemote(rows: Record<string, Row[]>) {
  const m = getMeta();
  const repush: string[] = [];
  const deletedItems: string[] = [];
  const deletedPhotos: string[] = [];
  const state = bridge?.getState();
  if (!state) return { repush, deletedItems, deletedPhotos };

  let items = state.items.slice();
  let purchases = (state.purchases ?? []).slice();
  let receipts = (state.receipts ?? []).slice();
  let changed = false;
  const idx = () => new Map(items.map((x, i) => [x.id, i]));
  let pos = idx();

  for (const r of rows.items ?? []) {
    const id = r.id;
    if (r.deleted) {
      if (!m.itemTombs[id]) m.itemTombs[id] = Number(r.deleted_at) || 1;
      delete m.items[id];
      if (pos.has(id)) {
        items = items.filter((x) => x.id !== id);
        purchases = purchases.filter((p) => p.itemId !== id);
        pos = idx();
        deletedItems.push(id);
        changed = true;
      }
      continue;
    }
    if (m.itemTombs[id]) {
      repush.push(`item:${id}`);
      continue;
    }
    const rData = (r.data ?? {}) as Record<string, unknown>;
    const rMeta = (r.meta ?? {}) as FieldMeta;
    const i = pos.get(id);
    if (i === undefined) {
      const created = normalizeItem({ ...(rData as Partial<InventoryItem>), id, name: String(rData.name ?? "Item") });
      const fm: FieldMeta = { ...rMeta };
      for (const f of Object.keys(created)) if (f !== "id" && !fm[f]) fm[f] = [0, ""];
      m.items[id] = fm;
      items = [created, ...items];
      pos = idx();
      changed = true;
      continue;
    }
    const local = items[i];
    const res = lwwMerge(itemData(local), itemMeta(local), rData, rMeta);
    m.items[id] = res.meta;
    if (res.remoteChanged) {
      items[i] = normalizeItem({ ...(res.data as Partial<InventoryItem>), id, name: String(res.data.name ?? local.name) });
      changed = true;
    }
    if (res.localNewer) repush.push(`item:${id}`);
  }

  const mergeList = <T extends { id: string }>(
    list: T[],
    remote: Row[] | undefined,
    tombs: Record<string, number>,
    kind: "purchase" | "receipt",
    make: (d: Record<string, unknown>, id: string) => T | null
  ): T[] => {
    let out = list;
    const have = new Set(list.map((x) => x.id));
    for (const r of remote ?? []) {
      if (r.deleted) {
        if (!tombs[r.id]) tombs[r.id] = Date.now();
        if (have.has(r.id)) {
          out = out.filter((x) => x.id !== r.id);
          have.delete(r.id);
          changed = true;
        }
        continue;
      }
      if (tombs[r.id]) {
        repush.push(`${kind}:${r.id}`);
        continue;
      }
      if (have.has(r.id)) continue;
      const itemId = (r.item_id as string | undefined) ?? ((r.data as Record<string, unknown>)?.itemId as string | undefined);
      if (kind === "purchase" && itemId && m.itemTombs[itemId]) continue;
      const made = make((r.data ?? {}) as Record<string, unknown>, r.id);
      if (made) {
        out = [made, ...out];
        have.add(r.id);
        changed = true;
      }
    }
    return out;
  };
  purchases = mergeList<Purchase>(purchases, rows.purchases, m.purchaseTombs, "purchase", (d, id) =>
    normalizePurchase({ ...(d as Partial<Purchase>), id, itemId: String(d.itemId ?? "") } as Purchase)
  );
  purchases.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  receipts = mergeList<ReceiptRecord>(receipts, rows.receipts, m.receiptTombs, "receipt", (d, id) =>
    normalizeReceipt({ ...(d as Partial<ReceiptRecord>), id })
  );

  for (const r of rows.photos ?? []) {
    const key = r.id;
    if (r.deleted) {
      if (!m.photoTombs[key]) m.photoTombs[key] = Date.now();
      delete m.remotePhotos[key];
      if (hasLocalPhoto(key)) deletedPhotos.push(key);
      continue;
    }
    if (m.photoTombs[key]) {
      repush.push(`photo:${key}`);
      continue;
    }
    if (m.itemTombs[String(r.item_id)]) continue;
    const sha = r.sha256 as string | null;
    if (!sha) continue;
    m.uploaded[sha] = 1;
    if (!hasLocalPhoto(key)) m.remotePhotos[key] = { sha, itemId: String(r.item_id), w: r.width as number, h: r.height as number };
    else delete m.remotePhotos[key];
  }

  for (const r of rows.settings ?? []) {
    const res = lwwMerge(readSettings() as unknown as Record<string, unknown>, settingsMeta(), (r.data ?? {}) as Record<string, unknown>, (r.meta ?? {}) as FieldMeta);
    m.settings = res.meta;
    if (res.remoteChanged) writeSettings(res.data as Partial<SyncedSettings>);
    if (res.localNewer) repush.push("settings");
  }

  if (changed) bridge!.applyRemote({ ...state, items, purchases, receipts });
  return { repush, deletedItems, deletedPhotos };
}

// ---------------------------------------------------------- photo fetch ---

let activeDownloads = 0;
const waiting: Array<() => void> = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDownloads >= 3) await new Promise<void>((r) => waiting.push(r));
  activeDownloads++;
  try {
    return await fn();
  } finally {
    activeDownloads--;
    waiting.shift()?.();
  }
}

/** Lazily download a cloud-only photo into this device's IndexedDB cache. */
async function downloadPhoto(key: string): Promise<boolean> {
  const m = getMeta();
  const rp = m.remotePhotos[key];
  if (!rp || !online() || !session) return false;
  return slot(async () => {
    const c = await getClient();
    const { data, error } = await c.storage.from(PHOTO_BUCKET).download(`${session!.user.id}/${rp.sha}.jpg`);
    if (error || !data) return false;
    m.photoSha[key] = rp.sha;
    delete m.remotePhotos[key];
    saveMeta();
    await savePhoto(key, new Blob([await data.arrayBuffer()], { type: "image/jpeg" }), { width: rp.w ?? undefined, height: rp.h ?? undefined }, { fromSync: true });
    return true;
  });
}

// ---------------------------------------------------------------- errors ---

function isNetworkError(err: unknown) {
  const e = err as { name?: string; message?: string };
  const msg = e?.message || "";
  return (
    e?.name === "TypeError" ||
    e?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg)
  );
}

function isAuthExpired(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  return e?.code === "PGRST301" || e?.code === "PGRST303" || /jwt expired|refresh token/i.test(e?.message || "");
}

export function plainError(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number; statusCode?: string };
  const msg = e?.message || "";
  if (isNetworkError(err)) return "Can’t reach the sync server. Changes are saved on this device and will sync later.";
  if (e?.code === "PGRST202" || e?.code === "42P01" || /does not exist|schema cache/i.test(msg))
    return "The cloud database isn’t set up yet. Run the setup SQL in Supabase.";
  if (/bucket not found/i.test(msg)) return "The photo storage bucket is missing in Supabase.";
  if (/payload too large|too large|exceeded the maximum/i.test(msg)) return "A photo or change was too large to sync.";
  if (/row-level security|permission denied/i.test(msg)) return "The cloud refused this change (permissions). Check the setup SQL.";
  return "Sync didn’t finish. It will try again shortly.";
}
