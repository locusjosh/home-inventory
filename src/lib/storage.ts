import type { InventoryItem, InventoryState, Purchase, ReceiptRecord } from "./types";
import seed from "../../data/seed.json";
import photoMap from "../../data/photo-map.json";
import photoOverrides from "../../data/photo-overrides.json";
import { sanitizeProductUrl } from "./productUrl";
import { sanitizePhotoOrder } from "./photoOrder";

const STORAGE_KEY = "home-inventory-v1";
const CURRENT_VERSION = 7;
export const STATE_VERSION = CURRENT_VERSION;

/**
 * Seed-category corrections. Applied to saved/imported data from before
 * `since`, and only when the item still has the original seed folder — a
 * folder the user picked is never overwritten.
 */
const FOLDER_FIXES: Array<{ id: string; from: string; to: string; since: number }> = [
  { id: "SBO59T3232", from: "Laundry", to: "Bathroom", since: 7 }, // Bandages
];

function migrateItems(items: InventoryItem[], fromVersion: number): InventoryItem[] {
  const fixes = FOLDER_FIXES.filter((f) => fromVersion < f.since);
  if (!fixes.length) return items;
  return items.map((it) => {
    const fix = fixes.find((f) => f.id === it.id && it.folder === f.from);
    return fix ? { ...it, folder: fix.to } : it;
  });
}

const PHOTO_MAP = photoMap as Record<string, string>;
/** Verified replacements keyed by item id (fixes wrong packshots in saved data). */
const PHOTO_OVERRIDES = photoOverrides as Record<string, string>;

function resolveImage(
  raw: Partial<InventoryItem> & { id: string }
): string | null {
  const override = PHOTO_OVERRIDES[raw.id];
  const bundled =
    typeof raw.image !== "string" || raw.image.length === 0 || raw.image.startsWith("/item-photos/");
  // Only replace bundled photos — never a user-supplied image.
  if (override && bundled) return override;
  if (typeof raw.image === "string" && raw.image.length > 0) return raw.image;
  const keys = [raw.sortlyId, raw.id].filter(
    (k): k is string => typeof k === "string" && k.length > 0
  );
  for (const key of keys) {
    if (PHOTO_MAP[key]) return PHOTO_MAP[key];
    // Match SID-2 style duplicates to base Sortly id
    const base = key.replace(/-\d+$/, "");
    if (base !== key && PHOTO_MAP[base]) return PHOTO_MAP[base];
  }
  return null;
}

function normalizeItem(raw: Partial<InventoryItem> & { id: string; name: string }): InventoryItem {
  return {
    id: raw.id,
    sortlyId: raw.sortlyId ?? null,
    name: raw.name,
    folder: raw.folder || "Kitchen",
    group: raw.group ?? null,
    attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
    quantity: typeof raw.quantity === "number" ? raw.quantity : 0,
    unit: raw.unit || "units",
    minLevel: raw.minLevel === undefined ? null : raw.minLevel,
    price: raw.price === undefined ? null : raw.price,
    notes: raw.notes ?? null,
    vendor: raw.vendor ?? null,
    archived: Boolean(raw.archived),
    lastCountedAt: raw.lastCountedAt ?? null,
    lastVendor: raw.lastVendor ?? raw.vendor ?? null,
    image: resolveImage(raw),
    productUrl: sanitizeProductUrl(raw.productUrl),
    ...(Array.isArray(raw.photoOrder) ? { photoOrder: sanitizePhotoOrder(raw.id, raw.photoOrder) } : {}),
  };
}

function normalizePurchase(raw: Partial<Purchase> & { id: string; itemId: string }): Purchase | null {
  if (typeof raw.pricePaid !== "number" || !Number.isFinite(raw.pricePaid)) return null;
  const qty = typeof raw.qty === "number" && raw.qty > 0 ? raw.qty : 1;
  const unitPricePaid =
    raw.unitPricePaid != null && Number.isFinite(raw.unitPricePaid)
      ? raw.unitPricePaid
      : Math.round((raw.pricePaid / qty) * 100) / 100;
  return {
    id: raw.id,
    itemId: raw.itemId,
    purchasedAt: raw.purchasedAt || new Date().toISOString(),
    qty,
    unit: raw.unit || "units",
    pricePaid: raw.pricePaid,
    listPrice: raw.listPrice ?? null,
    discountAmount: raw.discountAmount ?? null,
    discountPercent: raw.discountPercent ?? null,
    promoNotes: raw.promoNotes ?? null,
    vendor: raw.vendor ?? null,
    unitPricePaid,
    source: raw.source ?? "manual",
    receiptId: raw.receiptId,
    rawLine: raw.rawLine,
    ocrConfidence: raw.ocrConfidence,
    receiptImageId: raw.receiptImageId,
  };
}

function normalizeReceipt(raw: Partial<ReceiptRecord> & { id: string }): ReceiptRecord {
  return {
    id: raw.id,
    vendor: raw.vendor ?? null,
    date: raw.date || new Date().toISOString().slice(0, 10),
    rawText: raw.rawText || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    thumbnailDataUrl: raw.thumbnailDataUrl ?? null,
    lineCount: raw.lineCount,
    tax: raw.tax ?? null,
    total: raw.total ?? null,
  };
}

export function getSeedState(): InventoryState {
  const items = (seed.items as InventoryItem[]).map((i) => normalizeItem(i));
  return {
    items,
    purchases: [],
    receipts: [],
    version: CURRENT_VERSION,
    seededAt: new Date().toISOString(),
  };
}

export function loadState(): InventoryState {
  if (typeof window === "undefined") return getSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = getSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as InventoryState & { purchases?: Purchase[]; receipts?: ReceiptRecord[] };
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      const seeded = getSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const purchases = Array.isArray(parsed.purchases)
      ? parsed.purchases
          .map((p) => normalizePurchase(p as Purchase))
          .filter((p): p is Purchase => p !== null)
      : [];
    const receipts = Array.isArray(parsed.receipts)
      ? parsed.receipts.map((r) => normalizeReceipt(r as ReceiptRecord))
      : [];
    const state: InventoryState = {
      version: CURRENT_VERSION,
      seededAt: parsed.seededAt,
      items: migrateItems(parsed.items.map((i) => normalizeItem(i)), parsed.version ?? 1),
      purchases,
      receipts,
    };
    if ((parsed.version ?? 1) < CURRENT_VERSION || !Array.isArray(parsed.purchases)) {
      saveState(state);
    }
    return state;
  } catch {
    const seeded = getSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveState(state: InventoryState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    const stripped: InventoryState = {
      ...state,
      receipts: (state.receipts ?? []).map((r) => ({
        ...r,
        thumbnailDataUrl: null,
      })),
      purchases: (state.purchases ?? []).map((p) => {
        const rest = { ...p }; delete (rest as { receiptImageId?: string }).receiptImageId;
        return rest;
      }),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      console.warn("localStorage full; could not persist inventory state", err);
    }
  }
}

export function resetToSeed(): InventoryState {
  const seeded = getSeedState();
  saveState(seeded);
  return seeded;
}

export function importState(data: unknown): InventoryState {
  let items: InventoryItem[] = [];
  let purchases: Purchase[] = [];
  let receipts: ReceiptRecord[] = [];
  if (Array.isArray(data)) {
    items = migrateItems(data.map((i) => normalizeItem(i as InventoryItem)), 1);
  } else if (data && typeof data === "object" && Array.isArray((data as InventoryState).items)) {
    const d = data as InventoryState & { stateVersion?: number };
    items = migrateItems(d.items.map((i) => normalizeItem(i)), typeof d.stateVersion === "number" ? d.stateVersion : 1);
    if (Array.isArray(d.purchases)) {
      purchases = d.purchases
        .map((p) => normalizePurchase(p as Purchase))
        .filter((p): p is Purchase => p !== null);
    }
    if (Array.isArray(d.receipts)) {
      receipts = d.receipts.map((r) => normalizeReceipt(r));
    }
  } else {
    throw new Error("Invalid import file: expected { items: [...] } or an array");
  }
  const state: InventoryState = {
    items,
    purchases,
    receipts,
    version: CURRENT_VERSION,
    seededAt: new Date().toISOString(),
  };
  saveState(state);
  return state;
}
