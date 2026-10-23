/**
 * Per-item photo gallery ordering (pure helpers, no React / IndexedDB).
 *
 * A gallery is up to 4 slots. Each slot is either the bundled seed packshot
 * ("bundled", rendered from `item.image`) or a user photo stored in IndexedDB
 * under a key. Slot 0 is the cover shown everywhere else in the app.
 *
 * Keys: `${itemId}#${random}` for new photos. The legacy single-photo build
 * stored one photo under the bare item id — that key keeps working as-is.
 */
import type { InventoryItem } from "./types";

export const MAX_PHOTOS = 4;
export const BUNDLED = "bundled";

export function newPhotoKey(itemId: string) {
  return `${itemId}#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function itemIdOfKey(key: string) {
  const i = key.indexOf("#");
  return i === -1 ? key : key.slice(0, i);
}

export function isKeyForItem(key: string, itemId: string) {
  return key === itemId || key.startsWith(`${itemId}#`);
}

/** Drop junk from stored/imported orders: only "bundled" or this item's keys, unique, max 4. */
export function sanitizePhotoOrder(itemId: string, order: unknown[]): string[] {
  const out: string[] = [];
  for (const v of order) {
    if (typeof v !== "string") continue;
    if (v !== BUNDLED && !isKeyForItem(v, itemId)) continue;
    if (out.includes(v)) continue;
    out.push(v);
    if (out.length === MAX_PHOTOS) break;
  }
  return out;
}

type GalleryItem = Pick<InventoryItem, "image"> & { id?: string; photoOrder?: string[] };

/**
 * Effective slot list for an item given the set of photo keys in IndexedDB.
 *  - Explicit `photoOrder` is authoritative (bundled only if the item has a packshot,
 *    keys only if the photo exists); orphaned photos for the item are appended.
 *  - No `photoOrder` (legacy data): [legacy user photo, bundled packshot, …] —
 *    so an existing single user photo stays the cover and the packshot becomes slot 2.
 */
export function resolveSlots(item: GalleryItem, index: Set<string> | null): string[] {
  const has = (k: string) => (k === BUNDLED ? Boolean(item.image) : Boolean(index?.has(k)));
  const id = item.id;
  const userKeys = id && index ? [...index].filter((k) => isKeyForItem(k, id)).sort() : [];
  let order: string[];
  if (Array.isArray(item.photoOrder)) {
    order = item.photoOrder.filter(has);
    for (const k of userKeys) if (!order.includes(k)) order.push(k);
  } else {
    order = [];
    if (id && index?.has(id)) order.push(id);
    if (item.image) order.push(BUNDLED);
    for (const k of userKeys) if (!order.includes(k)) order.push(k);
  }
  return order.slice(0, MAX_PHOTOS);
}

export function moveSlot(order: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = order.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
