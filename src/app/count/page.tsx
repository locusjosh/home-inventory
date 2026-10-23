"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { ItemImage } from "@/components/ItemImage";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/ui/Page";
import { ChipBar, Switch } from "@/components/ui/Controls";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { COUNT_FOLDERS } from "@/lib/types";
import { formatQty } from "@/lib/utils";

function CountModeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const { myItems, confirmCount, folderCounts } = useInventory();

  const foldersWithItems = useMemo(
    () => COUNT_FOLDERS.filter((f) => (folderCounts[f] ?? 0) > 0),
    [folderCounts]
  );

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

  useEffect(() => setFolder(initialFolder), [initialFolder]);

  const roomItems = useMemo(() => {
    let list = myItems.filter((i) => i.folder === folder);
    if (uncountedOnly) list = list.filter((i) => !i.lastCountedAt);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [myItems, folder, uncountedOnly]);

  const current = roomItems[index] ?? null;

  useEffect(() => setIndex(0), [folder, uncountedOnly]);

  useEffect(() => {
    setDraftQty(current ? current.quantity : 0);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectFolder = useCallback(
    (f: string) => {
      setFolder(f);
      router.replace(`/count/?folder=${encodeURIComponent(f)}`, { scroll: false });
    },
    [router]
  );

  const goNextRoom = useCallback(() => {
    const idx = foldersWithItems.indexOf(folder as (typeof COUNT_FOLDERS)[number]);
    const next = foldersWithItems[(idx + 1) % Math.max(foldersWithItems.length, 1)];
    if (next && next !== folder) selectFolder(next);
  }, [folder, foldersWithItems, selectFolder]);

  const confirmAndNext = () => {
    if (!current) return;
    confirmCount(current.id, draftQty);
    if (index + 1 < roomItems.length) setIndex(index + 1);
    else goNextRoom();
  };

  const skip = () => {
    if (index + 1 < roomItems.length) setIndex(index + 1);
    else goNextRoom();
  };

  const bump = (delta: number) => setDraftQty((q) => Math.max(0, q + delta));
  const progress = roomItems.length ? (index + 1) / roomItems.length : 0;

  return (
    <Page title="Count" subtitle="Room by room, one item at a time">
      <ChipBar
        value={folder}
        onChange={selectFolder}
        ariaLabel="Room"
        options={foldersWithItems.map((f) => ({ value: f, label: f, count: folderCounts[f] ?? 0 }))}
      />

      <div className="ios-group mt-4 overflow-hidden rounded-card bg-bg-grouped-2">
        <label className="ios-row flex cursor-pointer items-center">
          <span className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center justify-between gap-3 py-1.5 pr-4">
            <span className="text-body text-label">Uncounted only</span>
            <Switch checked={uncountedOnly} onChange={setUncountedOnly} label="Uncounted only" />
          </span>
        </label>
      </div>

      {current ? (
        <section className="mt-4 overflow-hidden rounded-card bg-bg-grouped-2" aria-live="polite">
          <div className="p-3 pb-0">
            <ItemImage item={current} aspect="aspect-[2/1]" symbolSize={64} />
          </div>
          <div className="px-5 pb-3 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-subhead tabular-nums text-label-2">
                {index + 1} of {roomItems.length} · {folder}
              </p>
              <p className="text-subhead text-label-2">
                {current.lastCountedAt
                  ? `Counted ${new Date(current.lastCountedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : "Never counted"}
              </p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-fill-3" aria-hidden>
              <div className="h-full rounded-full bg-tint transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <h2 className="mt-4 text-title1 text-label">{current.name}</h2>
            <p className="mt-1 text-subhead text-label-2">
              {current.unit}
              {current.minLevel != null ? ` · keep at least ${current.minLevel}` : ""}
            </p>

            <div className="mt-5 flex items-center justify-center gap-5">
              <button
                type="button"
                aria-label="Decrease"
                onClick={() => bump(-1)}
                className="pressable focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-fill-3 text-tint"
              >
                <Icon name="minus" size={28} strokeWidth={2.4} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                aria-label="Counted quantity"
                value={formatQty(draftQty)}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  setDraftQty(Number.isNaN(n) ? 0 : Math.max(0, n));
                }}
                className="focus-ring h-16 w-24 rounded-[14px] bg-transparent text-center text-[44px] font-bold leading-none tabular-nums text-label outline-none"
              />
              <button
                type="button"
                aria-label="Increase"
                onClick={() => bump(1)}
                className="pressable focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-fill-3 text-tint"
              >
                <Icon name="plus" size={28} strokeWidth={2.4} />
              </button>
            </div>

            <Button variant="primary" size="lg" block className="mt-5" onClick={confirmAndNext}>
              Confirm Count
            </Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="plain" onClick={skip}>
                Skip
              </Button>
              <Button
                variant="plain"
                onClick={() => {
                  confirmCount(current.id, draftQty);
                  goNextRoom();
                }}
              >
                Finish Room
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon="checkmark.circle"
          title={uncountedOnly ? `${folder} Is Counted` : `No Items in ${folder}`}
          description={uncountedOnly ? "Every item in this room has a count." : undefined}
          action={
            <Button variant="secondary" onClick={goNextRoom}>
              Next Room
            </Button>
          }
        />
      )}
    </Page>
  );
}

export default function CountPage() {
  return (
    <Suspense fallback={null}>
      <CountModeInner />
    </Suspense>
  );
}
