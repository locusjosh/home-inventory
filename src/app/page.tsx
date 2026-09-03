"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { FolderChips } from "@/components/FolderChips";
import { ItemCard } from "@/components/ItemCard";
import { SearchInput } from "@/components/SearchInput";
import { MoveFolderModal } from "@/components/MoveFolderModal";
import { isLowStock } from "@/lib/utils";

export default function HomePage() {
  const { activeItems, folderCounts, lowStockItems, updateQuantity, moveToFolder } =
    useInventory();
  const [folder, setFolder] = useState<string | "all" | "low">("all");
  const [query, setQuery] = useState("");
  const [moveId, setMoveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = activeItems;
    if (folder === "low") list = list.filter(isLowStock);
    else if (folder !== "all") list = list.filter((i) => i.folder === folder);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeItems, folder, query]);

  const moving = activeItems.find((i) => i.id === moveId);

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <SearchInput value={query} onChange={setQuery} />
        <FolderChips
          selected={folder}
          counts={folderCounts}
          lowCount={lowStockItems.length}
          onSelect={setFolder}
        />
      </section>

      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-ink">
          {folder === "all"
            ? "All items"
            : folder === "low"
              ? "Low stock"
              : folder}
        </h1>
        <p className="text-sm text-ink-muted">{filtered.length} shown</p>
      </div>

      {folder === "Suggested Items" ? (
        <p className="rounded-2xl bg-accent-soft/60 px-4 py-3 text-sm text-ink">
          Suggested Items is your wishlist. Use <strong>Move to folder…</strong> when you start
          stocking something.
        </p>
      ) : null}

      <div className="grid gap-3">
        {filtered.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onQuantity={updateQuantity}
            showMove={item.folder === "Suggested Items"}
            onMove={setMoveId}
          />
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
            No items match.
          </div>
        ) : null}
      </div>

      <MoveFolderModal
        open={Boolean(moveId)}
        itemName={moving?.name}
        onClose={() => setMoveId(null)}
        onPick={(f) => {
          if (moveId) moveToFolder(moveId, f);
          setMoveId(null);
        }}
      />
    </div>
  );
}
