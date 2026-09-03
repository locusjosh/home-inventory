"use client";

import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemCard } from "@/components/ItemCard";

export default function LowStockPage() {
  const { lowStockItems, updateQuantity } = useInventory();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Low stock</h1>
          <p className="text-sm text-ink-muted">
            Quantity below min level ({lowStockItems.length})
          </p>
        </div>
        <Link
          href="/restock"
          className="rounded-xl bg-warn px-3 py-2 text-sm font-medium text-white"
        >
          Restock list
        </Link>
      </div>
      <div className="grid gap-3">
        {lowStockItems.map((item) => (
          <ItemCard key={item.id} item={item} onQuantity={updateQuantity} />
        ))}
        {lowStockItems.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
            Nothing is low right now. Nice.
          </div>
        ) : null}
      </div>
    </div>
  );
}
