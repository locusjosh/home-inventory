import type { InventoryItem, InventoryState } from "./types";
import seed from "../../data/seed.json";

const STORAGE_KEY = "home-inventory-v1";

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
  };
}

export function getSeedState(): InventoryState {
  const items = (seed.items as InventoryItem[]).map((i) => normalizeItem(i));
  return {
    items,
    version: (seed as { version?: number }).version ?? 1,
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
    const parsed = JSON.parse(raw) as InventoryState;
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      const seeded = getSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return {
      version: parsed.version ?? 1,
      seededAt: parsed.seededAt,
      items: parsed.items.map((i) => normalizeItem(i)),
    };
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
  if (Array.isArray(data)) {
    items = data.map((i) => normalizeItem(i as InventoryItem));
  } else if (data && typeof data === "object" && Array.isArray((data as InventoryState).items)) {
    items = (data as InventoryState).items.map((i) => normalizeItem(i));
  } else {
    throw new Error("Invalid import file: expected { items: [...] } or an array");
  }
  const state: InventoryState = {
    items,
    version: 1,
    seededAt: new Date().toISOString(),
  };
  saveState(state);
  return state;
}
