"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { InventoryItem, InventoryState, ItemDraft } from "@/lib/types";
import { importState, loadState, resetToSeed, saveState } from "@/lib/storage";
import { isLowStock, needsCount, uid } from "@/lib/utils";

type InventoryContextValue = {
  ready: boolean;
  items: InventoryItem[];
  activeItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  needsCountItems: InventoryItem[];
  folderCounts: Record<string, number>;
  updateQuantity: (id: string, quantity: number) => void;
  confirmCount: (id: string, quantity: number) => void;
  markRestocked: (id: string) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  addItem: (draft: ItemDraft) => InventoryItem;
  archiveItem: (id: string, archived?: boolean) => void;
  deleteItem: (id: string) => void;
  moveToFolder: (id: string, folder: string) => void;
  reset: () => void;
  importJson: (data: unknown) => void;
  replaceAll: (items: InventoryItem[]) => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InventoryState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const persist = useCallback((next: InventoryState) => {
    setState(next);
    saveState(next);
  }, []);

  const items = useMemo(() => state?.items ?? [], [state?.items]);

  const activeItems = useMemo(
    () => items.filter((i) => !i.archived),
    [items]
  );

  const lowStockItems = useMemo(
    () => activeItems.filter(isLowStock).sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems]
  );

  const needsCountItems = useMemo(
    () => activeItems.filter(needsCount).sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems]
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of activeItems) {
      counts[i.folder] = (counts[i.folder] ?? 0) + 1;
    }
    return counts;
  }, [activeItems]);

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!state) return;
      const q = Math.max(0, Math.round(quantity * 100) / 100);
      persist({
        ...state,
        items: state.items.map((i) => (i.id === id ? { ...i, quantity: q } : i)),
      });
    },
    [persist, state]
  );

  /** Confirm quantity in count mode and stamp lastCountedAt. */
  const confirmCount = useCallback(
    (id: string, quantity: number) => {
      if (!state) return;
      const q = Math.max(0, Math.round(quantity * 100) / 100);
      const now = new Date().toISOString();
      persist({
        ...state,
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity: q, lastCountedAt: now } : i
        ),
      });
    },
    [persist, state]
  );

  /** Set quantity to minLevel when below min (bought from empty/low). */
  const markRestocked = useCallback(
    (id: string) => {
      if (!state) return;
      persist({
        ...state,
        items: state.items.map((i) => {
          if (i.id !== id) return i;
          const min = i.minLevel ?? 0;
          const nextQty = i.quantity < min ? Math.max(min, 1) : i.quantity + 1;
          return { ...i, quantity: nextQty };
        }),
      });
    },
    [persist, state]
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<InventoryItem>) => {
      if (!state) return;
      persist({
        ...state,
        items: state.items.map((i) => (i.id === id ? { ...i, ...patch, id: i.id } : i)),
      });
    },
    [persist, state]
  );

  const addItem = useCallback(
    (draft: ItemDraft) => {
      const item: InventoryItem = {
        id: uid("local"),
        sortlyId: null,
        name: draft.name.trim(),
        folder: draft.folder,
        group: null,
        attributes: draft.attributes ?? [],
        quantity: draft.quantity ?? 0,
        unit: draft.unit || "units",
        minLevel: draft.minLevel,
        price: draft.price,
        notes: draft.notes,
        vendor: draft.vendor,
        archived: false,
        lastCountedAt: null,
      };
      if (!state) {
        const next = { items: [item], version: 1, seededAt: new Date().toISOString() };
        persist(next);
        return item;
      }
      persist({ ...state, items: [item, ...state.items] });
      return item;
    },
    [persist, state]
  );

  const archiveItem = useCallback(
    (id: string, archived = true) => {
      updateItem(id, { archived });
    },
    [updateItem]
  );

  const deleteItem = useCallback(
    (id: string) => {
      if (!state) return;
      persist({ ...state, items: state.items.filter((i) => i.id !== id) });
    },
    [persist, state]
  );

  const moveToFolder = useCallback(
    (id: string, folder: string) => {
      updateItem(id, { folder });
    },
    [updateItem]
  );

  const reset = useCallback(() => {
    persist(resetToSeed());
  }, [persist]);

  const importJson = useCallback(
    (data: unknown) => {
      persist(importState(data));
    },
    [persist]
  );

  const replaceAll = useCallback(
    (nextItems: InventoryItem[]) => {
      persist({
        items: nextItems,
        version: 1,
        seededAt: new Date().toISOString(),
      });
    },
    [persist]
  );

  const value: InventoryContextValue = {
    ready: state !== null,
    items,
    activeItems,
    lowStockItems,
    needsCountItems,
    folderCounts,
    updateQuantity,
    confirmCount,
    markRestocked,
    updateItem,
    addItem,
    archiveItem,
    deleteItem,
    moveToFolder,
    reset,
    importJson,
    replaceAll,
  };

  return (
    <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
