"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  InventoryItem,
  InventoryState,
  ItemDraft,
  LogPurchaseInput,
  Purchase,
  ReceiptRecord,
} from "@/lib/types";
import { importState, loadState, resetToSeed, saveState } from "@/lib/storage";
import { isLowStock, needsCount, uid } from "@/lib/utils";

type InventoryContextValue = {
  ready: boolean;
  items: InventoryItem[];
  purchases: Purchase[];
  receipts: ReceiptRecord[];
  activeItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  needsCountItems: InventoryItem[];
  folderCounts: Record<string, number>;
  updateQuantity: (id: string, quantity: number) => void;
  confirmCount: (id: string, quantity: number) => void;
  markRestocked: (id: string) => void;
  logPurchase: (input: LogPurchaseInput) => Purchase | null;
  /** Batch-log purchases from a receipt confirm (one persist). */
  confirmReceiptAllocation: (args: {
    receipt: Omit<ReceiptRecord, "id" | "createdAt"> & { id?: string };
    lines: (LogPurchaseInput & { createDraft?: ItemDraft })[];
  }) => { receiptId: string; purchases: Purchase[] } | null;
  getPurchasesForItem: (itemId: string) => Purchase[];
  getLastPurchase: (itemId: string) => Purchase | null;
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
  const purchases = useMemo(() => state?.purchases ?? [], [state?.purchases]);
  const receipts = useMemo(() => state?.receipts ?? [], [state?.receipts]);

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

  const getPurchasesForItem = useCallback(
    (itemId: string) =>
      purchases
        .filter((p) => p.itemId === itemId)
        .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)),
    [purchases]
  );

  const getLastPurchase = useCallback(
    (itemId: string) => {
      const list = getPurchasesForItem(itemId);
      return list[0] ?? null;
    },
    [getPurchasesForItem]
  );

  const buildPurchase = useCallback(
    (input: LogPurchaseInput, item: InventoryItem): Purchase => {
      const qty = Math.max(0.01, input.qty || 1);
      const pricePaid = Math.max(0, input.pricePaid);
      const unitPricePaid = Math.round((pricePaid / qty) * 100) / 100;
      const vendor = (input.vendor ?? item.lastVendor ?? item.vendor ?? null) || null;
      return {
        id: uid("purchase"),
        itemId: item.id,
        purchasedAt: input.purchasedAt || new Date().toISOString(),
        qty,
        unit: input.unit || item.unit || "units",
        pricePaid,
        listPrice: input.listPrice ?? null,
        discountAmount: input.discountAmount ?? null,
        discountPercent: input.discountPercent ?? null,
        promoNotes: input.promoNotes ?? null,
        vendor,
        unitPricePaid,
        source: input.source ?? "manual",
        receiptId: input.receiptId,
        rawLine: input.rawLine,
        ocrConfidence: input.ocrConfidence,
        receiptImageId: input.receiptImageId,
      };
    },
    []
  );

  const applyPurchaseToItem = (
    i: InventoryItem,
    purchase: Purchase,
    alsoRestock: boolean
  ): InventoryItem => {
    if (i.id !== purchase.itemId) return i;
    let nextQty = i.quantity;
    if (alsoRestock) {
      const min = i.minLevel ?? 0;
      nextQty = Math.max(
        i.quantity + purchase.qty,
        i.quantity < min ? Math.max(min, 1) : i.quantity + purchase.qty
      );
    }
    return {
      ...i,
      quantity: Math.round(nextQty * 100) / 100,
      price: purchase.unitPricePaid ?? i.price,
      vendor: purchase.vendor ?? i.vendor,
      lastVendor: purchase.vendor ?? i.lastVendor ?? i.vendor,
    };
  };

  const logPurchase = useCallback(
    (input: LogPurchaseInput): Purchase | null => {
      if (!state) return null;
      const item = state.items.find((i) => i.id === input.itemId);
      if (!item) return null;
      const purchase = buildPurchase(input, item);
      const alsoRestock = input.alsoRestock !== false;
      const nextItems = state.items.map((i) =>
        applyPurchaseToItem(i, purchase, alsoRestock)
      );
      persist({
        ...state,
        version: Math.max(state.version, 3),
        items: nextItems,
        purchases: [purchase, ...(state.purchases ?? [])],
        receipts: state.receipts ?? [],
      });
      return purchase;
    },
    [buildPurchase, persist, state]
  );

  const confirmReceiptAllocation = useCallback(
    (args: {
      receipt: Omit<ReceiptRecord, "id" | "createdAt"> & { id?: string };
      lines: (LogPurchaseInput & { createDraft?: ItemDraft })[];
    }) => {
      if (!state) return null;
      const receiptId = args.receipt.id || uid("receipt");
      const createdAt = new Date().toISOString();
      const receipt: ReceiptRecord = {
        id: receiptId,
        vendor: args.receipt.vendor ?? null,
        date: args.receipt.date,
        rawText: args.receipt.rawText || "",
        createdAt,
        thumbnailDataUrl: args.receipt.thumbnailDataUrl ?? null,
        lineCount: args.receipt.lineCount ?? args.lines.length,
        tax: args.receipt.tax ?? null,
        total: args.receipt.total ?? null,
      };

      const newPurchases: Purchase[] = [];
      let nextItems = [...state.items];

      for (const input of args.lines) {
        let itemId = input.itemId;
        if (input.createDraft) {
          const d = input.createDraft;
          const created: InventoryItem = {
            id: uid("local"),
            sortlyId: null,
            name: d.name.trim(),
            folder: d.folder,
            group: null,
            attributes: d.attributes ?? [],
            quantity: d.quantity ?? 0,
            unit: d.unit || "units",
            minLevel: d.minLevel,
            price: d.price,
            notes: d.notes,
            vendor: d.vendor,
            archived: false,
            lastCountedAt: null,
            lastVendor: d.vendor,
          };
          nextItems = [created, ...nextItems];
          itemId = created.id;
        }
        const item = nextItems.find((i) => i.id === itemId);
        if (!item) continue;
        const resolvedInput = { ...input, itemId: item.id };
        const purchase = buildPurchase(
          { ...resolvedInput, receiptId, source: resolvedInput.source ?? "receipt" },
          item
        );
        const alsoRestock = resolvedInput.alsoRestock !== false;
        nextItems = nextItems.map((i) =>
          applyPurchaseToItem(i, purchase, alsoRestock)
        );
        newPurchases.push(purchase);
      }

      persist({
        ...state,
        version: Math.max(state.version, 3),
        items: nextItems,
        purchases: [...newPurchases, ...(state.purchases ?? [])],
        receipts: [receipt, ...(state.receipts ?? [])],
      });
      return { receiptId, purchases: newPurchases };
    },
    [buildPurchase, persist, state]
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
        lastVendor: draft.vendor,
      };
      if (!state) {
        const next = {
          items: [item],
          purchases: [],
          receipts: [],
          version: 3,
          seededAt: new Date().toISOString(),
        };
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
      persist({
        ...state,
        items: state.items.filter((i) => i.id !== id),
        purchases: (state.purchases ?? []).filter((p) => p.itemId !== id),
      });
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
        purchases: state?.purchases ?? [],
        receipts: state?.receipts ?? [],
        version: 3,
        seededAt: new Date().toISOString(),
      });
    },
    [persist, state?.purchases, state?.receipts]
  );

  const value: InventoryContextValue = {
    ready: state !== null,
    items,
    purchases,
    receipts,
    activeItems,
    lowStockItems,
    needsCountItems,
    folderCounts,
    updateQuantity,
    confirmCount,
    markRestocked,
    logPurchase,
    confirmReceiptAllocation,
    getPurchasesForItem,
    getLastPurchase,
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
