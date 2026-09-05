"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemCard } from "@/components/ItemCard";
import { SearchInput } from "@/components/SearchInput";
import { MoveFolderModal } from "@/components/MoveFolderModal";

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
        <h1 className="text-xl font-semibold text-ink">Ideas</h1>
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

      <div className="grid gap-3">
        {filtered.map((item) => (
          <div key={item.id} className="space-y-2">
            <ItemCard
              item={item}
              onQuantity={updateQuantity}
              showMove
              onMove={setMoveId}
            />
            <div className="flex gap-2 px-1">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Archive “${item.name}”?`)) archiveItem(item.id);
                }}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete “${item.name}” permanently?`)) deleteItem(item.id);
                }}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
            {ideaItems.length === 0
              ? "No wishlist ideas left — nice."
              : "No ideas match your search."}
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
