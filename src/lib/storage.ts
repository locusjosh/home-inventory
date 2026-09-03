import type { InventoryItem, InventoryState, Purchase } from "./types";
import seed from "../../data/seed.json";

const STORAGE_KEY = "home-inventory-v1";
const CURRENT_VERSION = 2;

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
  };
}

export function getSeedState(): InventoryState {
  const items = (seed.items as InventoryItem[]).map((i) => normalizeItem(i));
  return {
    items,
    purchases: [],
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
    const parsed = JSON.parse(raw) as InventoryState & { purchases?: Purchase[] };
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
    const state: InventoryState = {
      version: CURRENT_VERSION,
      seededAt: parsed.seededAt,
      items: parsed.items.map((i) => normalizeItem(i)),
      purchases,
    };
    // Persist migration if version was older / purchases missing
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetToSeed(): InventoryState {
  const seeded = getSeedState();
  saveState(seeded);
  return seeded;
}

export function importState(data: unknown): InventoryState {
  let items: InventoryItem[] = [];
  let purchases: Purchase[] = [];
  if (Array.isArray(data)) {
    items = data.map((i) => normalizeItem(i as InventoryItem));
  } else if (data && typeof data === "object" && Array.isArray((data as InventoryState).items)) {
    const d = data as InventoryState;
    items = d.items.map((i) => normalizeItem(i));
    if (Array.isArray(d.purchases)) {
      purchases = d.purchases
        .map((p) => normalizePurchase(p as Purchase))
        .filter((p): p is Purchase => p !== null);
    }
  } else {
    throw new Error("Invalid import file: expected { items: [...] } or an array");
  }
  const state: InventoryState = {
    items,
    purchases,
    version: CURRENT_VERSION,
    seededAt: new Date().toISOString(),
  };
  saveState(state);
  return state;
}
