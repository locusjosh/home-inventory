"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { FolderChips } from "@/components/FolderChips";
import { ItemCard } from "@/components/ItemCard";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { isLowStock, needsCount } from "@/lib/utils";

type SortMode = "name" | "low" | "recent";

export default function HomePage() {
  const {
    myItems,
    folderCounts,
    lowStockItems,
    needsCountItems,
    updateQuantity,
    ideaItems,
  } = useInventory();
  const [folder, setFolder] = useState<string | "all" | "low" | "needs">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("name");

  const roomCount = useMemo(() => {
    return Object.keys(folderCounts).filter((k) => (folderCounts[k] ?? 0) > 0).length;
  }, [folderCounts]);

  const healthPct = useMemo(() => {
    if (myItems.length === 0) return 100;
    const ok = myItems.filter((i) => !isLowStock(i)).length;
    return Math.round((ok / myItems.length) * 100);
  }, [myItems]);

  const filtered = useMemo(() => {
    let list = myItems;
    if (folder === "low") list = list.filter(isLowStock);
    else if (folder === "needs") list = list.filter(needsCount);
    else if (folder !== "all") list = list.filter((i) => i.folder === folder);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "low") {
      sorted.sort((a, b) => {
        const al = isLowStock(a) ? 0 : 1;
        const bl = isLowStock(b) ? 0 : 1;
        if (al !== bl) return al - bl;
        return a.name.localeCompare(b.name);
      });
    } else {
      sorted.sort((a, b) => {
        const at = a.lastCountedAt ? Date.parse(a.lastCountedAt) : 0;
        const bt = b.lastCountedAt ? Date.parse(b.lastCountedAt) : 0;
        if (at !== bt) return bt - at;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [myItems, folder, query, sort]);

  const ringStyle = {
    background: `conic-gradient(rgb(var(--accent)) ${healthPct * 3.6}deg, rgb(var(--surface-3)) 0deg)`,
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-surface-3/60 bg-gradient-to-br from-[rgb(var(--hero-from))] via-surface to-[rgb(var(--hero-to))] p-5 shadow-lux sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div
            className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full p-[3px] shadow-soft"
            style={ringStyle}
            aria-label={`Stock health ${healthPct}%`}
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-surface">
              <span className="font-display text-lg font-semibold tabular-nums text-ink">
                {healthPct}%
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-ink-muted">
                health
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Home stock
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">
              Your inventory
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {myItems.length} items · {roomCount} rooms
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <Link
            href="/low-stock"
            className="rounded-2xl bg-surface/80 px-3 py-3 shadow-soft ring-1 ring-surface-3/50 pressable focus-ring backdrop-blur"
          >
            <p className="text-[11px] text-ink-muted">Low</p>
            <p className="font-display text-xl font-semibold tabular-nums text-warn">
              {lowStockItems.length}
            </p>
          </Link>
          <button
            type="button"
            onClick={() => setFolder("needs")}
            className="rounded-2xl bg-surface/80 px-3 py-3 text-left shadow-soft ring-1 ring-surface-3/50 pressable focus-ring backdrop-blur"
          >
            <p className="text-[11px] text-ink-muted">Needs count</p>
            <p className="font-display text-xl font-semibold tabular-nums text-accent">
              {needsCountItems.length}
            </p>
          </button>
          <Link
            href="/ideas"
            className="rounded-2xl bg-surface/80 px-3 py-3 shadow-soft ring-1 ring-surface-3/50 pressable focus-ring backdrop-blur"
          >
            <p className="text-[11px] text-ink-muted">Ideas</p>
            <p className="font-display text-xl font-semibold tabular-nums text-ink">
              {ideaItems.length}
            </p>
          </Link>
        </div>

        <div className="relative mt-3 flex gap-2">
          <Link
            href="/count"
            className="flex min-h-tap flex-1 items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lux pressable focus-ring"
          >
            Start count
          </Link>
          <Link
            href="/assist"
            className="flex min-h-tap items-center justify-center rounded-2xl bg-surface/90 px-4 py-3 text-sm font-semibold text-accent ring-1 ring-accent/20 pressable focus-ring"
          >
            Assist
          </Link>
        </div>
      </section>

      {needsCountItems.length > 0 && folder !== "needs" ? (
        <Link
          href="/count"
          className="flex items-center justify-between rounded-2xl bg-accent-soft/80 px-4 py-3.5 text-sm text-ink ring-1 ring-accent/15 pressable focus-ring"
        >
          <span>
            <strong className="tabular-nums">{needsCountItems.length}</strong> items need a stock
            count
          </span>
          <span className="font-semibold text-accent">Count →</span>
        </Link>
      ) : null}

      <section className="space-y-3">
        <SearchInput value={query} onChange={setQuery} />
        <FolderChips
          selected={folder}
          counts={folderCounts}
          lowCount={lowStockItems.length}
          needsCount={needsCountItems.length}
          onSelect={setFolder}
        />
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {(
            [
              ["name", "Name"],
              ["low", "Low first"],
              ["recent", "Recently counted"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium pressable focus-ring ${
                sort === key
                  ? "bg-ink text-surface"
                  : "bg-surface/80 text-ink-muted ring-1 ring-surface-3/80 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          {folder === "all"
            ? "My items"
            : folder === "low"
              ? "Low stock"
              : folder === "needs"
                ? "Needs count"
                : folder}
        </h2>
        <p className="text-sm tabular-nums text-ink-muted">{filtered.length} shown</p>
      </div>

      {/* Mobile: 2-col product grid; sm+: denser grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onQuantity={updateQuantity}
            variant="grid"
          />
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="No items match"
          description="Try another room filter or clear your search."
        />
      ) : null}
    </div>
  );
}
