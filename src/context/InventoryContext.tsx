"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { clearPhotos, deletePhotosForItem, importPhotos } from "@/lib/photoStore";
import { getSyncStatus, initSync, noteLocalChange, subscribeSyncStatus } from "@/lib/sync/engine";
import type { ChangeMode } from "@/lib/sync/meta";
import { noteManualQuantity } from "@/lib/counts/manualLog";
import { importCounts } from "@/lib/counts/store";
import { buildBackupJson } from "@/lib/backup";
import { saveSnapshot } from "@/lib/snapshots";
import { ideaItems as filterIdeaItems, isLowStock, isTrashed, myItems as filterMyItems, needsCount, uid } from "@/lib/utils";

type InventoryContextValue = {
  ready: boolean;
  items: InventoryItem[];
  purchases: Purchase[];
  receipts: ReceiptRecord[];
  /** All non-archived items (includes Suggested Items). */
  activeItems: InventoryItem[];
  /** Non-archived stock items (excludes Suggested Items). */
  myItems: InventoryItem[];
  /** Non-archived Suggested Items wishlist. */
  ideaItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  needsCountItems: InventoryItem[];
  /** Counts for stock folders only (excludes Suggested Items). */
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
  importJson: (data: unknown) => Promise<number>;
  replaceAll: (items: InventoryItem[]) => void;
  /** Archived items that are not in Recently Deleted. */
  archivedItems: InventoryItem[];
  /** Items in Recently Deleted (newest first). */
  trashedItems: InventoryItem[];
  /** Move to Recently Deleted (kept 30 days, photos and purchases intact). */
  trashItem: (id: string) => void;
  /** Bring an item back from Recently Deleted. */
  recoverItem: (id: string) => void;
  /** End Count: set counted quantities + lastCountedAt in one change (not logged as Manual). */
  applyCountResults: (updates: { id: string; quantity: number }[], at: string) => void;
  /** Revert a count: put quantities back (not logged as Manual). */
  revertQuantities: (updates: { id: string; quantity: number; lastCountedAt?: string | null }[]) => void;
};

/** Recently Deleted keeps items this long before they're removed for good. */
export const TRASH_DAYS = 30;
const SNAPSHOT_FLAG = "home-inventory-snapshot-v6";
type PersistOpts = { via?: string; noLog?: boolean };

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InventoryState | null>(null);
  /** Latest state, readable synchronously by the sync engine. */
  const stateRef = useRef<InventoryState | null>(null);

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded;
    setState(loaded);
    initSync({
      getState: () => stateRef.current,
      applyRemote: (next) => {
        stateRef.current = next;
        setState(next);
        saveState(next);
      },
    });
  }, []);

  /** Every local change goes through here: saved locally first, then stamped + queued for sync. */
  const persist = useCallback((next: InventoryState, mode: ChangeMode = "edit", opts: PersistOpts = {}) => {
    const prev = stateRef.current;
    stateRef.current = next;
    setState(next);
    saveState(next);
    noteLocalChange(prev, next, mode);
    // Count log: quantity changes made outside a count are logged as "Manual".
    if (mode === "edit" && !opts.noLog && prev) {
      const before = new Map(prev.items.map((i) => [i.id, i]));
      for (const it of next.items) {
        const b = before.get(it.id);
        if (b && b.quantity !== it.quantity) noteManualQuantity(it.id, it.name, b.quantity, it.quantity, opts.via ?? "edit");
      }
    }
  }, []);

  // One automatic full snapshot on the first launch of this version, before it
  // changes anything (kept on this device; Data & Backup can download it).
  const snapshotReady = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!state || snapshotReady.current) return;
    snapshotReady.current = (async () => {
      try {
        if (localStorage.getItem(SNAPSHOT_FLAG)) return;
        await saveSnapshot("format-v6", await buildBackupJson(state), state.items.length);
        localStorage.setItem(SNAPSHOT_FLAG, new Date().toISOString());
      } catch (err) {
        console.warn("Snapshot failed", err);
      }
    })();
  }, [state]);

  const items = useMemo(() => state?.items ?? [], [state?.items]);
  const purchases = useMemo(() => state?.purchases ?? [], [state?.purchases]);
  const receipts = useMemo(() => state?.receipts ?? [], [state?.receipts]);

  const activeItems = useMemo(
    () => items.filter((i) => !i.archived),
    [items]
  );

  const myItems = useMemo(() => filterMyItems(items), [items]);

  const ideaItems = useMemo(() => filterIdeaItems(items), [items]);

  const lowStockItems = useMemo(
    () => myItems.filter(isLowStock).sort((a, b) => a.name.localeCompare(b.name)),
    [myItems]
  );

  const needsCountItems = useMemo(
    () => myItems.filter(needsCount).sort((a, b) => a.name.localeCompare(b.name)),
    [myItems]
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of myItems) {
      counts[i.folder] = (counts[i.folder] ?? 0) + 1;
    }
    return counts;
  }, [myItems]);

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

  const applyCountResults = useCallback(
    (updates: { id: string; quantity: number }[], at: string) => {
      const cur = stateRef.current;
      if (!cur || !updates.length) return;
      const map = new Map(updates.map((u) => [u.id, Math.max(0, Math.round(u.quantity * 100) / 100)]));
      persist(
        { ...cur, items: cur.items.map((i) => (map.has(i.id) ? { ...i, quantity: map.get(i.id)!, lastCountedAt: at } : i)) },
        "edit",
        { noLog: true }
      );
    },
    [persist]
  );

  const revertQuantities = useCallback(
    (updates: { id: string; quantity: number; lastCountedAt?: string | null }[]) => {
      const cur = stateRef.current;
      if (!cur || !updates.length) return;
      const map = new Map(updates.map((u) => [u.id, u]));
      persist(
        {
          ...cur,
          items: cur.items.map((i) => {
            const u = map.get(i.id);
            if (!u) return i;
            return { ...i, quantity: u.quantity, ...("lastCountedAt" in u ? { lastCountedAt: u.lastCountedAt ?? null } : {}) };
          }),
        },
        "edit",
        { noLog: true }
      );
    },
    [persist]
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
      }, "edit", { via: "quick count" });
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
      }, "edit", { via: "restock" });
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
      }, "edit", { via: "purchase" });
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
      }, "edit", { via: "receipt" });
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
        id: draft.id ?? uid("local"),
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
        productUrl: draft.productUrl ?? null,
        ...(draft.photoOrder ? { photoOrder: draft.photoOrder } : {}),
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
      const cur = stateRef.current;
      const it = cur?.items.find((i) => i.id === id);
      if (cur && it?.trashedAt && !isTrashed(it)) {
        // A stale Recently Deleted stamp (left by an older app that un-archived it) must not turn this archive into a delete.
        persist({
          ...cur,
          items: cur.items.map((i) => {
            if (i.id !== id) return i;
            const next: InventoryItem = { ...i, archived };
            delete next.trashedAt;
            delete next.restoreArchived;
            return next;
          }),
        });
        return;
      }
      updateItem(id, { archived });
    },
    [updateItem, persist]
  );

  const deleteItem = useCallback(
    (id: string) => {
      if (!state) return;
      persist({
        ...state,
        items: state.items.filter((i) => i.id !== id),
        purchases: (state.purchases ?? []).filter((p) => p.itemId !== id),
      });
      void deletePhotosForItem(id);
    },
    [persist, state]
  );

  const trashItem = useCallback(
    (id: string) => {
      const cur = stateRef.current;
      if (!cur) return;
      persist({
        ...cur,
        items: cur.items.map((i) => {
          if (i.id !== id) return i;
          // archived:true keeps it hidden on app versions that predate Recently Deleted.
          const next: InventoryItem = { ...i, archived: true, trashedAt: new Date().toISOString() };
          if (i.archived) next.restoreArchived = true;
          else delete next.restoreArchived;
          return next;
        }),
      });
    },
    [persist]
  );

  const recoverItem = useCallback(
    (id: string) => {
      const cur = stateRef.current;
      if (!cur) return;
      persist({
        ...cur,
        items: cur.items.map((i) => {
          if (i.id !== id) return i;
          const next: InventoryItem = { ...i, archived: Boolean(i.restoreArchived) };
          delete next.trashedAt;
          delete next.restoreArchived;
          return next;
        }),
      });
    },
    [persist]
  );

  // Recently Deleted: after 30 days an item is deleted for good (the old,
  // permanent delete). Runs only once this device is synced (or sync is off),
  // and only after a fresh snapshot.
  const purgeStarted = useRef(false);
  useEffect(() => {
    if (!state || purgeStarted.current) return;
    const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
    const expired = state.items.filter((i) => isTrashed(i) && Date.parse(i.trashedAt!) < cutoff).map((i) => i.id);
    if (!expired.length) return;
    const ready = () => {
      const st = getSyncStatus();
      return !st.configured || st.phase === "off" || (st.phase === "idle" && st.pending === 0 && st.lastSyncAt != null);
    };
    const run = async () => {
      if (purgeStarted.current) return;
      purgeStarted.current = true;
      unsub();
      try {
        await snapshotReady.current;
        const cur = stateRef.current;
        if (!cur) return;
        const now = Date.now() - TRASH_DAYS * 86_400_000;
        const ids = new Set(cur.items.filter((i) => isTrashed(i) && Date.parse(i.trashedAt!) < now).map((i) => i.id));
        if (!ids.size) return;
        await saveSnapshot("before-purge", await buildBackupJson(cur), cur.items.length);
        const latest = stateRef.current!;
        persist({
          ...latest,
          items: latest.items.filter((i) => !ids.has(i.id)),
          purchases: (latest.purchases ?? []).filter((p) => !ids.has(p.itemId)),
        });
        for (const id of ids) void deletePhotosForItem(id);
      } catch (err) {
        console.warn("Recently Deleted clean-up skipped", err);
        purgeStarted.current = false;
      }
    };
    const unsub = subscribeSyncStatus(() => {
      if (ready()) void run();
    });
    if (ready()) void run();
    return unsub;
  }, [state, persist]);

  // An older app version (before Recently Deleted) can un-archive a deleted item. It is then visible
  // again, so drop the stale stamp once this device is synced: it can never be purged while visible.
  useEffect(() => {
    if (!state || !state.items.some((i) => i.trashedAt && !isTrashed(i))) return;
    const ready = () => {
      const st = getSyncStatus();
      return !st.configured || st.phase === "off" || (st.phase === "idle" && st.pending === 0 && st.lastSyncAt != null);
    };
    const heal = () => {
      const cur = stateRef.current;
      if (!cur || !cur.items.some((i) => i.trashedAt && !isTrashed(i))) return;
      persist(
        {
          ...cur,
          items: cur.items.map((i) => {
            if (!i.trashedAt || isTrashed(i)) return i;
            const next: InventoryItem = { ...i };
            delete next.trashedAt;
            delete next.restoreArchived;
            return next;
          }),
        },
        "edit",
        { noLog: true }
      );
    };
    if (ready()) {
      heal();
      return;
    }
    const unsub = subscribeSyncStatus(() => {
      if (ready()) {
        unsub();
        heal();
      }
    });
    return unsub;
  }, [state, persist]);

  const moveToFolder = useCallback(
    (id: string, folder: string) => {
      updateItem(id, { folder });
    },
    [updateItem]
  );

  const reset = useCallback(() => {
    persist(resetToSeed(), "reset");
    void clearPhotos();
  }, [persist]);

  /** Restores items/purchases/receipts and the embedded user photos. Resolves to the photo count. */
  const importJson = useCallback(
    async (data: unknown) => {
      const next = importState(data);
      persist(next, "import");
      // Format v6: merge the count sessions + log (never replaces what's here).
      if (data && typeof data === "object" && !Array.isArray(data)) importCounts((data as { counts?: unknown }).counts);
      const photos =
        data && typeof data === "object" && !Array.isArray(data)
          ? ((data as { photos?: Record<string, string> }).photos ?? null)
          : null;
      return importPhotos(photos, new Set(next.items.map((i) => i.id)));
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
      }, "import");
    },
    [persist, state?.purchases, state?.receipts]
  );

  const archivedItems = useMemo(
    () => items.filter((i) => i.archived && !isTrashed(i)).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const trashedItems = useMemo(
    () => items.filter((i) => isTrashed(i)).sort((a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? "")),
    [items]
  );

  const value: InventoryContextValue = {
    ready: state !== null,
    items,
    purchases,
    receipts,
    activeItems,
    myItems,
    ideaItems,
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
    archivedItems,
    trashedItems,
    trashItem,
    recoverItem,
    applyCountResults,
    revertQuantities,
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
