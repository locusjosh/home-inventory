/**
 * Count log entries for quantity changes made OUTSIDE a count (tagged "Manual"):
 * the item page stepper, Restock, logged purchases, receipts, the assistant.
 *
 * Quick taps are coalesced per item: five taps on + within a few seconds become
 * one entry (old → final). A change that nets to zero writes nothing.
 */
import { getMeta } from "../sync/meta";
import { addEntries } from "./store";
import { deviceLabel, round2, ulid, type CountEntry } from "./model";

const IDLE_MS = 4000;
type Pending = { itemId: string; name: string; oldQty: number; newQty: number; via: string; firstAt: number; timer: ReturnType<typeof setTimeout> | null };
const pending = new Map<string, Pending>();

function flushOne(p: Pending) {
  if (p.timer) clearTimeout(p.timer);
  pending.delete(p.itemId);
  if (round2(p.newQty) === round2(p.oldQty)) return;
  const e: CountEntry = {
    id: ulid("ce"),
    sessionId: null,
    itemId: p.itemId,
    itemName: p.name,
    oldQty: p.oldQty,
    newQty: p.newQty,
    delta: round2(p.newQty - p.oldQty),
    at: new Date(p.firstAt).toISOString(),
    deviceId: getMeta().deviceId,
    deviceLabel: deviceLabel(),
    source: "manual",
    via: p.via,
  };
  addEntries([e]);
}

export function noteManualQuantity(itemId: string, name: string, oldQty: number, newQty: number, via = "edit") {
  const cur = pending.get(itemId);
  if (cur) {
    cur.newQty = newQty;
    cur.name = name;
    if (cur.via !== via) cur.via = via === "edit" ? cur.via : via;
    if (cur.timer) clearTimeout(cur.timer);
    cur.timer = setTimeout(() => flushOne(cur), IDLE_MS);
    return;
  }
  const p: Pending = { itemId, name, oldQty, newQty, via, firstAt: Date.now(), timer: null };
  p.timer = setTimeout(() => flushOne(p), IDLE_MS);
  pending.set(itemId, p);
}

/** Write everything still waiting (app going to background, a count starting/ending…). */
export function flushManualLog() {
  for (const p of [...pending.values()]) flushOne(p);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushManualLog);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushManualLog();
  });
}
