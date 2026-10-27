/**
 * Count sessions + count log — data model and pure helpers.
 *
 * Everything here is NEW data. It lives in its own localStorage key and its own
 * cloud tables (counts, count_entries), so it can never overwrite items,
 * photos, purchases or receipts. Item quantities only change at End Count,
 * through the same `quantity` + `lastCountedAt` fields the old Count screen used.
 */
import type { InventoryItem } from "../types";
import { STOCK_FOLDERS } from "../types";
import { myItems } from "../utils";

export type CountStatus = "active" | "reviewing" | "cancelled" | "completed" | "reverted";

/** Status only moves forward when two devices disagree (same order as SQL count_status_rank). */
export const STATUS_RANK: Record<CountStatus, number> = { active: 1, reviewing: 2, cancelled: 3, completed: 4, reverted: 5 };

export type CountScope =
  | { kind: "all" }
  | { kind: "rooms"; rooms: string[] }
  | { kind: "low" }
  | { kind: "stale"; days: number };

/** Per-item state inside a session. Stored as its own LWW field `line:<itemId>`. */
export type CountLine = {
  counted?: number;
  skipped?: boolean;
  excluded?: boolean;
  note?: string;
  at: number;
};

export type CountTotals = { counted: number; skipped: number; changed: number; net: number; abs: number; items: number };

export type CountSession = {
  id: string;
  status: CountStatus;
  scope: CountScope;
  /** Frozen order at start. */
  itemIds: string[];
  /** Quantity of each item when the count started (for "changed during count"). */
  expected: Record<string, number>;
  /** itemId → line */
  lines: Record<string, CountLine>;
  /** Index the counter was last on (synced so another device resumes at the same spot). */
  pos: number;
  startedAt: string;
  endedAt?: string | null;
  deviceId: string;
  deviceLabel: string;
  totals?: CountTotals | null;
};

export type CountEntrySource = "count" | "manual" | "revert";

/** One row of the count log. Immutable once written. */
export type CountEntry = {
  id: string;
  sessionId: string | null;
  itemId: string;
  itemName: string;
  oldQty: number;
  newQty: number;
  delta: number;
  at: string;
  deviceId: string;
  deviceLabel: string;
  source: CountEntrySource;
  /** For manual changes: what caused it (edit, restock, purchase, receipt). */
  via?: string;
  note?: string;
};

export const SCOPE_LABEL = (s: CountScope): string => {
  switch (s.kind) {
    case "all":
      return "All Rooms";
    case "rooms":
      return s.rooms.length === 1 ? s.rooms[0] : `${s.rooms.length} Rooms`;
    case "low":
      return "Low Items";
    case "stale":
      return `Not Counted in ${s.days} Days`;
  }
};

const folderRank = (f: string) => {
  const i = STOCK_FOLDERS.indexOf(f as (typeof STOCK_FOLDERS)[number]);
  return i === -1 ? 99 : i;
};

/** Stock items only (never Ideas / Suggested Items, never archived or deleted), room order then A–Z. */
export function itemsForScope(all: InventoryItem[], scope: CountScope, now = Date.now()): InventoryItem[] {
  let list = myItems(all).filter((i) => !i.trashedAt);
  if (scope.kind === "rooms") {
    const set = new Set(scope.rooms);
    list = list.filter((i) => set.has(i.folder));
  } else if (scope.kind === "low") {
    list = list.filter((i) => i.minLevel != null && i.quantity <= i.minLevel);
  } else if (scope.kind === "stale") {
    const cutoff = now - scope.days * 86_400_000;
    list = list.filter((i) => !i.lastCountedAt || Date.parse(i.lastCountedAt) < cutoff);
  }
  return [...list].sort((a, b) => folderRank(a.folder) - folderRank(b.folder) || a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
}

export type LineState = "counted" | "skipped" | "pending";
export function lineState(l: CountLine | undefined): LineState {
  if (l && typeof l.counted === "number") return "counted";
  if (l?.skipped) return "skipped";
  return "pending";
}

export function sessionProgress(s: CountSession) {
  let counted = 0;
  let skipped = 0;
  for (const id of s.itemIds) {
    const st = lineState(s.lines[id]);
    if (st === "counted") counted++;
    else if (st === "skipped") skipped++;
  }
  return { counted, skipped, pending: s.itemIds.length - counted - skipped, total: s.itemIds.length };
}

/** What End Count would do, item by item. `current` = live quantity right now. */
export type ReviewRow = {
  itemId: string;
  name: string;
  folder: string;
  state: LineState;
  excluded: boolean;
  expected: number;
  current: number | null;
  counted: number | null;
  delta: number;
  /** Quantity changed somewhere else after this count started. */
  changedElsewhere: boolean;
  missing: boolean;
};

export function reviewRows(s: CountSession, items: InventoryItem[]): ReviewRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return s.itemIds.map((id) => {
    const it = byId.get(id);
    const l = s.lines[id];
    const st = lineState(l);
    const expected = s.expected[id] ?? it?.quantity ?? 0;
    const current = it && !it.trashedAt ? it.quantity : null;
    const counted = st === "counted" ? (l!.counted as number) : null;
    const base = current ?? expected;
    return {
      itemId: id,
      name: it?.name ?? "Deleted item",
      folder: it?.folder ?? "",
      state: st,
      excluded: Boolean(l?.excluded),
      expected,
      current,
      counted,
      delta: counted == null ? 0 : round2(counted - base),
      changedElsewhere: current != null && current !== expected,
      missing: current == null,
    };
  });
}

export function totalsFor(rows: ReviewRow[]): CountTotals {
  let counted = 0, skipped = 0, changed = 0, net = 0, abs = 0;
  for (const r of rows) {
    if (r.state === "counted" && !r.excluded && !r.missing) {
      counted++;
      if (r.delta !== 0) changed++;
      net += r.delta;
      abs += Math.abs(r.delta);
    } else skipped++;
  }
  return { counted, skipped, changed, net: round2(net), abs: round2(abs), items: rows.length };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function signed(n: number): string {
  const v = round2(n);
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "0";
}

/** "iPhone · Home Screen", "iPhone · Safari", "Mac · Browser" … */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent || "";
  const dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : "Computer";
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches);
  const app = standalone ? "Home Screen" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return `${dev} · ${app}`;
}

/** Sortable, unique id (time first) for sessions and log entries. */
export function ulid(prefix: string): string {
  const t = Date.now().toString(36).padStart(9, "0");
  const a = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(a);
  const r = [...a].map((b) => b.toString(16).padStart(2, "0")).join("") || Math.random().toString(16).slice(2);
  return `${prefix}-${t}-${r}`;
}
