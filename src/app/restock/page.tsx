"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { formatPrice } from "@/lib/utils";

export default function RestockPage() {
  const { lowStockItems } = useInventory();

  const byVendor = useMemo(() => {
    const map = new Map<string, typeof lowStockItems>();
    for (const item of lowStockItems) {
      const key = item.vendor?.trim() || "No vendor";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [lowStockItems]);

  const total = lowStockItems.reduce((sum, i) => sum + (i.price ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Restock list</h1>
        <p className="text-sm text-ink-muted">
          Low-stock items with vendor, notes, and price
          {lowStockItems.some((i) => i.price != null)
            ? ` · ~${formatPrice(total)} listed`
            : ""}
        </p>
      </div>

      {byVendor.map(([vendor, items]) => (
        <section key={vendor} className="rounded-2xl bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {vendor}
          </h2>
          <ul className="divide-y divide-surface-3">
            {items.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
                  className="block font-medium text-ink hover:text-accent"
                >
                  {item.name}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                  <span>
                    Have {item.quantity} {item.unit} · min {item.minLevel}
                  </span>
                  {item.price != null ? <span>{formatPrice(item.price)}</span> : null}
                </div>
                {item.notes ? (
                  <p className="mt-1 text-sm text-ink-muted">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lowStockItems.length === 0 ? (
        <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
          Restock list is empty.
        </div>
      ) : null}
    </div>
  );
}
