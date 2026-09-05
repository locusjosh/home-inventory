"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { COUNT_FOLDERS } from "@/lib/types";
import { formatQty } from "@/lib/utils";

function CountModeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const { myItems, confirmCount, folderCounts } = useInventory();

  const foldersWithItems = useMemo(() => {
    return COUNT_FOLDERS.filter((f) => (folderCounts[f] ?? 0) > 0);
  }, [folderCounts]);

  const initialFolder = useMemo(() => {
    if (folderParam && foldersWithItems.includes(folderParam as (typeof COUNT_FOLDERS)[number])) {
      return folderParam;
    }
    return foldersWithItems[0] ?? "Bathroom";
  }, [folderParam, foldersWithItems]);

  const [folder, setFolder] = useState(initialFolder);
  const [index, setIndex] = useState(0);
  const [draftQty, setDraftQty] = useState(0);
  const [uncountedOnly, setUncountedOnly] = useState(false);

  useEffect(() => {
    setFolder(initialFolder);
  }, [initialFolder]);

  const roomItems = useMemo(() => {
    let list = myItems.filter((i) => i.folder === folder);
    if (uncountedOnly) {
      list = list.filter((i) => !i.lastCountedAt);
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [myItems, folder, uncountedOnly]);

  const current = roomItems[index] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [folder, uncountedOnly]);

  useEffect(() => {
    if (current) setDraftQty(current.quantity);
    else setDraftQty(0);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNextRoom = useCallback(() => {
    const idx = foldersWithItems.indexOf(folder as (typeof COUNT_FOLDERS)[number]);
    const next = foldersWithItems[(idx + 1) % Math.max(foldersWithItems.length, 1)];
    if (next && next !== folder) {
      setFolder(next);
      router.replace(`/count/?folder=${encodeURIComponent(next)}`, { scroll: false });
    }
  }, [folder, foldersWithItems, router]);

  const confirmAndNext = () => {
    if (!current) return;
    confirmCount(current.id, draftQty);
    if (index + 1 < roomItems.length) {
      setIndex(index + 1);
    } else {
      goNextRoom();
    }
  };

  const skip = () => {
    if (index + 1 < roomItems.length) setIndex(index + 1);
    else goNextRoom();
  };

  const bump = (delta: number) => setDraftQty((q) => Math.max(0, q + delta));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Count mode</h1>
          <p className="text-sm text-ink-muted">One item at a time · room by room</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={uncountedOnly}
            onChange={(e) => setUncountedOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-[rgb(var(--accent))]"
          />
          Uncounted only
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {foldersWithItems.map((f) => {
          const active = f === folder;
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFolder(f);
                router.replace(`/count/?folder=${encodeURIComponent(f)}`, { scroll: false });
              }}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${
                active ? "bg-accent text-white" : "bg-surface-2 text-ink hover:bg-surface-3"
              }`}
            >
              {f}
              <span className={`ml-1.5 tabular-nums ${active ? "opacity-90" : "text-ink-muted"}`}>
                {folderCounts[f] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="rounded-3xl bg-surface p-5 shadow-soft">
          <p className="text-sm font-medium text-ink-muted">
            {index + 1} of {roomItems.length} in {folder}
          </p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-ink">{current.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {current.unit}
            {current.minLevel != null ? ` · min ${current.minLevel}` : ""}
            {current.lastCountedAt
              ? ` · counted ${new Date(current.lastCountedAt).toLocaleDateString()}`
              : " · never counted"}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => bump(-1)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-3xl font-bold text-ink active:scale-95"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={formatQty(draftQty)}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                setDraftQty(Number.isNaN(n) ? 0 : Math.max(0, n));
              }}
              className="h-16 w-28 rounded-2xl border-2 border-surface-3 bg-surface-2 text-center text-3xl font-bold text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              aria-label="Increase"
              onClick={() => bump(1)}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl font-bold text-white active:scale-95"
            >
              +
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={skip}
              className="rounded-2xl bg-surface-2 px-3 py-4 text-sm font-semibold text-ink-muted"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={confirmAndNext}
              className="rounded-2xl bg-accent px-3 py-4 text-sm font-semibold text-white"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                confirmCount(current.id, draftQty);
                goNextRoom();
              }}
              className="rounded-2xl bg-accent-soft px-3 py-4 text-sm font-semibold text-accent"
            >
              Done room
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
          <p className="text-ink-muted">
            {uncountedOnly
              ? `No uncounted items in ${folder}.`
              : `No items in ${folder}.`}
          </p>
          <button
            type="button"
            onClick={goNextRoom}
            className="mt-4 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white"
          >
            Next room
          </button>
        </div>
      )}
    </div>
  );
}

export default function CountPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
          Loading count mode…
        </div>
      }
    >
      <CountModeInner />
    </Suspense>
  );
}
