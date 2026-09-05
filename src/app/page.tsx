"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { FolderChips } from "@/components/FolderChips";
import { ItemCard } from "@/components/ItemCard";
import { SearchInput } from "@/components/SearchInput";
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
      // Recently counted — most recent first; never counted last
      sorted.sort((a, b) => {
        const at = a.lastCountedAt ? Date.parse(a.lastCountedAt) : 0;
        const bt = b.lastCountedAt ? Date.parse(b.lastCountedAt) : 0;
        if (at !== bt) return bt - at;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [myItems, folder, query, sort]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          href="/low-stock"
          className="rounded-2xl bg-surface px-3 py-3 shadow-soft"
        >
          <p className="text-xs text-ink-muted">Low stock</p>
          <p className="text-xl font-bold tabular-nums text-warn">{lowStockItems.length}</p>
        </Link>
        <Link
          href="/?folder=needs"
          onClick={(e) => {
            e.preventDefault();
            setFolder("needs");
          }}
          className="rounded-2xl bg-surface px-3 py-3 shadow-soft"
        >
          <p className="text-xs text-ink-muted">Needs count</p>
          <p className="text-xl font-bold tabular-nums text-accent">{needsCountItems.length}</p>
        </Link>
        <Link
          href="/count"
          className="rounded-2xl bg-accent px-3 py-3 text-white shadow-soft"
        >
          <p className="text-xs text-white/80">Count mode</p>
          <p className="text-sm font-semibold">Start →</p>
        </Link>
        <Link
          href="/ideas"
          className="rounded-2xl bg-surface px-3 py-3 shadow-soft"
        >
          <p className="text-xs text-ink-muted">Ideas</p>
          <p className="text-xl font-bold tabular-nums text-ink">{ideaItems.length}</p>
        </Link>
      </section>

      {needsCountItems.length > 0 && folder !== "needs" ? (
        <Link
          href="/count"
          className="flex items-center justify-between rounded-2xl bg-accent-soft/70 px-4 py-3 text-sm text-ink"
        >
          <span>
            <strong>{needsCountItems.length}</strong> items need a stock count
          </span>
          <span className="font-semibold text-accent">Count →</span>
        </Link>
      ) : null}

      <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-muted">
        Tip: on iPhone, open Share → <strong>Add to Home Screen</strong> for a full-screen app.
      </p>

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
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                sort === key
                  ? "bg-ink text-surface"
                  : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-ink">
          {folder === "all"
            ? "My items"
            : folder === "low"
              ? "Low stock"
              : folder === "needs"
                ? "Needs count"
                : folder}
        </h1>
        <p className="text-sm text-ink-muted">{filtered.length} shown</p>
      </div>

      <div className="grid gap-3">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} onQuantity={updateQuantity} />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
            No items match.
          </div>
        ) : null}
      </div>
    </div>
  );
}
