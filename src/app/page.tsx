"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/ui/Page";
import { ChipBar, SearchField } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { STOCK_FOLDERS } from "@/lib/types";
import { isLowStock, needsCount } from "@/lib/utils";
import { activeSession } from "@/lib/counts/store";
import { sessionProgress } from "@/lib/counts/model";
import { useCountsVersion } from "@/lib/counts/useCounts";

type SortMode = "name" | "low" | "recent";
type Filter = "all" | "low" | "needs" | string;

const SORT_LABEL: Record<SortMode, string> = {
  name: "Name",
  low: "Low First",
  recent: "Recently Counted",
};

export default function HomePage() {
  const { myItems, folderCounts, lowStockItems, needsCountItems, updateQuantity } = useInventory();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [sortOpen, setSortOpen] = useState(false);
  useCountsVersion();
  const counting = activeSession();
  const cp = counting ? sessionProgress(counting) : null;

  const roomCount = useMemo(
    () => Object.keys(folderCounts).filter((k) => (folderCounts[k] ?? 0) > 0).length,
    [folderCounts]
  );

  const filtered = useMemo(() => {
    let list = myItems;
    if (filter === "low") list = list.filter(isLowStock);
    else if (filter === "needs") list = list.filter(needsCount);
    else if (filter !== "all") list = list.filter((i) => i.folder === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "low")
      sorted.sort((a, b) => {
        const d = (isLowStock(a) ? 0 : 1) - (isLowStock(b) ? 0 : 1);
        return d || a.name.localeCompare(b.name);
      });
    else
      sorted.sort((a, b) => {
        const at = a.lastCountedAt ? Date.parse(a.lastCountedAt) : 0;
        const bt = b.lastCountedAt ? Date.parse(b.lastCountedAt) : 0;
        return bt - at || a.name.localeCompare(b.name);
      });
    return sorted;
  }, [myItems, filter, query, sort]);

  const chips = [
    { value: "all", label: "All", count: myItems.length },
    { value: "low", label: "Low", count: lowStockItems.length },
    { value: "needs", label: "Needs Count", count: needsCountItems.length },
    ...STOCK_FOLDERS.filter((f) => (folderCounts[f] ?? 0) > 0).map((f) => ({
      value: f,
      label: f,
      count: folderCounts[f] ?? 0,
    })),
  ];

  const sectionTitle =
    filter === "all" ? "All Items" : filter === "low" ? "Low Stock" : filter === "needs" ? "Needs Count" : filter;

  return (
    <Page
      title="Stock"
      subtitle={`${myItems.length} items · ${roomCount} rooms`}
      actions={
        <Link
          href="/add"
          aria-label="Add item"
          className="glass pressable focus-ring flex h-11 w-11 items-center justify-center rounded-full text-tint"
        >
          <Icon name="plus" size={22} strokeWidth={2.4} />
        </Link>
      }
    >
      <div className="space-y-3">
        {counting && cp ? (
          <Link
            href="/count"
            data-testid="home-resume-count"
            className="accent-fill pressable focus-ring inline-flex min-h-tap items-center gap-2 rounded-full pl-3.5 pr-3 text-subhead font-semibold"
          >
            <Icon name="checklist" size={18} strokeWidth={2} />
            <span className="tabular-nums">Count in progress · {cp.counted + cp.skipped} of {cp.total} · Resume</span>
            <Icon name="chevron.right" size={14} strokeWidth={2.6} />
          </Link>
        ) : needsCountItems.length > 0 ? (
          <Link
            href="/count"
            className="glass pressable focus-ring inline-flex min-h-tap items-center gap-2 rounded-full pl-3.5 pr-3 text-subhead font-semibold text-tint"
          >
            <Icon name="checklist" size={18} strokeWidth={2} />
            <span className="tabular-nums">{needsCountItems.length} need a count</span>
            <Icon name="chevron.right" size={14} strokeWidth={2.6} />
          </Link>
        ) : null}

        <SearchField value={query} onChange={setQuery} placeholder="Search items" />
        <ChipBar value={filter} onChange={setFilter} options={chips} ariaLabel="Filter by room" />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-title3 text-label">
          {sectionTitle}
          <span className="ml-2 text-subhead font-normal tabular-nums text-label-2">{filtered.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="pressable focus-ring -mr-2 inline-flex min-h-tap items-center gap-1 rounded-lg px-2 text-subhead text-tint"
          aria-label={`Sort: ${SORT_LABEL[sort]}`}
        >
          <Icon name="arrow.up.arrow.down" size={16} strokeWidth={2} />
          {SORT_LABEL[sort]}
        </button>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} onQuantity={updateQuantity} />
          ))}
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState
            icon="magnifyingglass"
            title="No Results"
            description="Try another room or clear your search."
          />
        </div>
      )}

      <ActionSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort Items By"
        actions={(Object.keys(SORT_LABEL) as SortMode[]).map((k) => ({
          label: SORT_LABEL[k],
          checked: k === sort,
          onSelect: () => setSort(k),
        }))}
      />
    </Page>
  );
}
