"use client";

import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";

export default function LowStockPage() {
  const { lowStockItems, updateQuantity } = useInventory();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Low stock</h1>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {lowStockItems.map((item) => (
          <ItemCard key={item.id} item={item} onQuantity={updateQuantity} variant="grid" />
        ))}
      </div>
      {lowStockItems.length === 0 ? (
        <EmptyState title="Nothing is low right now" description="Stock levels look healthy." />
      ) : null}
    </div>
  );
}
