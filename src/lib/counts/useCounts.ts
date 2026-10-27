"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useInventory } from "@/context/InventoryContext";
import { getMeta } from "../sync/meta";
import { isTrashed } from "../utils";
import { flushManualLog } from "./manualLog";
import {
  activeSession,
  addEntries,
  countsVersion,
  createSession,
  getSession,
  listEntries,
  listSessions,
  patchSession,
  setLine,
  subscribeCounts,
} from "./store";
import {
  deviceLabel,
  itemsForScope,
  reviewRows,
  round2,
  totalsFor,
  ulid,
  type CountEntry,
  type CountLine,
  type CountScope,
  type CountSession,
} from "./model";

/** Re-render on any count/log change (this device or pulled from another). */
export function useCountsVersion() {
  return useSyncExternalStore(subscribeCounts, countsVersion, () => 0);
}

export function useCounts() {
  useCountsVersion();
  const { items, applyCountResults, revertQuantities } = useInventory();

  const start = useCallback(
    (scope: CountScope): CountSession | null => {
      flushManualLog();
      const list = itemsForScope(items, scope);
      if (!list.length) return null;
      const s: CountSession = {
        id: ulid("count"),
        status: "active",
        scope,
        itemIds: list.map((i) => i.id),
        expected: Object.fromEntries(list.map((i) => [i.id, i.quantity])),
        lines: {},
        pos: 0,
        startedAt: new Date().toISOString(),
        endedAt: null,
        deviceId: getMeta().deviceId,
        deviceLabel: deviceLabel(),
        totals: null,
      };
      createSession(s);
      return s;
    },
    [items]
  );

  const record = useCallback((sessionId: string, itemId: string, line: Omit<CountLine, "at">, pos?: number) => {
    setLine(sessionId, itemId, line, pos);
  }, []);

  const move = useCallback((sessionId: string, pos: number) => patchSession(sessionId, { pos }), []);

  const setStatus = useCallback((sessionId: string, status: CountSession["status"]) => patchSession(sessionId, { status }), []);

  const cancel = useCallback((sessionId: string) => {
    patchSession(sessionId, { status: "cancelled", endedAt: new Date().toISOString() });
  }, []);

  /** End Count: apply counted quantities, write the log, mark complete. Returns the totals. */
  const end = useCallback(
    (sessionId: string) => {
      const s = getSession(sessionId);
      if (!s || (s.status !== "active" && s.status !== "reviewing")) return null;
      flushManualLog();
      const rows = reviewRows(s, items);
      const totals = totalsFor(rows);
      const at = new Date().toISOString();
      const label = deviceLabel();
      const deviceId = getMeta().deviceId;
      const apply = rows.filter((r) => r.state === "counted" && !r.excluded && !r.missing);
      const byId = new Map(items.map((i) => [i.id, i]));
      applyCountResults(apply.map((r) => ({ id: r.itemId, quantity: r.counted as number })), at);
      const entries: CountEntry[] = apply.map((r) => ({
        id: ulid("ce"),
        sessionId: s.id,
        itemId: r.itemId,
        itemName: r.name,
        oldQty: r.current as number,
        oldCountedAt: byId.get(r.itemId)?.lastCountedAt ?? null,
        newCountedAt: at,
        newQty: r.counted as number,
        delta: round2((r.counted as number) - (r.current as number)),
        at,
        deviceId,
        deviceLabel: label,
        source: "count",
        ...(s.lines[r.itemId]?.note ? { note: s.lines[r.itemId]!.note } : {}),
      }));
      addEntries(entries);
      patchSession(s.id, { status: "completed", endedAt: at, totals });
      return totals;
    },
    [items, applyCountResults]
  );

  /**
   * Revert a finished count: every item whose quantity is still what the count
   * set goes back to its old quantity. Items changed since are left alone.
   */
  const revert = useCallback(
    (sessionId: string) => {
      const s = getSession(sessionId);
      if (!s || s.status !== "completed") return null;
      flushManualLog();
      const byId = new Map(items.map((i) => [i.id, i]));
      const mine = listEntries().filter((e) => e.sessionId === s.id && e.source === "count");
      const back: { id: string; quantity: number; lastCountedAt?: string | null }[] = [];
      const skipped: string[] = [];
      const at = new Date().toISOString();
      const label = deviceLabel();
      const deviceId = getMeta().deviceId;
      const entries: CountEntry[] = [];
      for (const e of mine) {
        const it = byId.get(e.itemId);
        if (!it || isTrashed(it) || it.quantity !== e.newQty) {
          if (e.oldQty !== e.newQty) skipped.push(e.itemName);
          continue;
        }
        // Put the count date back only if nothing has re-counted the item since this count.
        const restoreDate = "oldCountedAt" in e && e.newCountedAt !== undefined && it.lastCountedAt === e.newCountedAt;
        if (e.oldQty === e.newQty && !restoreDate) continue;
        back.push({ id: e.itemId, quantity: e.oldQty, ...(restoreDate ? { lastCountedAt: e.oldCountedAt ?? null } : {}) });
        if (e.oldQty !== e.newQty) {
          entries.push({
            id: ulid("ce"), sessionId: s.id, itemId: e.itemId, itemName: it.name,
            oldQty: e.newQty, newQty: e.oldQty, delta: round2(e.oldQty - e.newQty),
            at, deviceId, deviceLabel: label, source: "revert",
          });
        }
      }
      revertQuantities(back);
      addEntries(entries);
      patchSession(s.id, { status: "reverted", endedAt: s.endedAt ?? at });
      return { reverted: entries.length, skipped };
    },
    [items, revertQuantities]
  );

  return {
    sessions: listSessions(),
    active: activeSession(),
    entries: listEntries(),
    start,
    record,
    move,
    setStatus,
    cancel,
    end,
    revert,
  };
}
