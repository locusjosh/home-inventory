"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemCard } from "@/components/ItemCard";
import { SearchInput } from "@/components/SearchInput";
import { MoveFolderModal } from "@/components/MoveFolderModal";
import { EmptyState } from "@/components/EmptyState";

export default function IdeasPage() {
  const { ideaItems, moveToFolder, archiveItem, deleteItem, updateQuantity } =
    useInventory();
  const [query, setQuery] = useState("");
  const [moveId, setMoveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...ideaItems].sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q) ||
          (i.vendor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ideaItems, query]);

  const moving = ideaItems.find((i) => i.id === moveId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Ideas</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Wishlist ideas from Sortly — not part of your stock until you move them.
        </p>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search ideas…" />

      <div className="flex items-baseline justify-between">
        <p className="text-sm text-ink-muted">
          {filtered.length} idea{filtered.length === 1 ? "" : "s"}
          {query.trim() ? " shown" : ""}
        </p>
        <Link href="/" className="text-sm font-medium text-accent">
          ← My stock
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((item) => (
          <div key={item.id} className="space-y-2">
            <ItemCard
              item={item}
              onQuantity={updateQuantity}
              showMove
              onMove={setMoveId}
              variant="grid"
            />
            <div className="flex gap-2 px-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Archive “${item.name}”?`)) archiveItem(item.id);
                }}
                className="min-h-tap flex-1 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink-muted ring-1 ring-surface-3 hover:text-ink pressable focus-ring"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete “${item.name}” permanently?`)) deleteItem(item.id);
                }}
                className="min-h-tap rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold text-danger ring-1 ring-danger/25 hover:bg-danger/10 pressable focus-ring"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title={ideaItems.length === 0 ? "No wishlist ideas left" : "No ideas match"}
              description={ideaItems.length === 0 ? "Your ideas list is clear." : "Try a different search."}
            />
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
