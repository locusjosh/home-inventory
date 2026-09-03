"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import {
  formatPrice,
  needToBuy,
  shopAmazonUrl,
  shopCostcoUrl,
  shopWalmartUrl,
} from "@/lib/utils";

export default function RestockPage() {
  const { lowStockItems, markRestocked } = useInventory();
  const [copied, setCopied] = useState(false);

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

  const copyList = async () => {
    const lines: string[] = ["Restock list", ""];
    for (const [vendor, items] of byVendor) {
      lines.push(`## ${vendor}`);
      for (const item of items) {
        const need = needToBuy(item);
        lines.push(
          `- ${item.name}: buy ${need} ${item.unit} (have ${item.quantity}, min ${item.minLevel})` +
            (item.price != null ? ` · ${formatPrice(item.price)}` : "")
        );
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Restock list</h1>
          <p className="text-sm text-ink-muted">
            Low-stock items with shop links & need-to-buy qty
            {lowStockItems.some((i) => i.price != null)
              ? ` · ~${formatPrice(total)} listed`
              : ""}
          </p>
        </div>
        {lowStockItems.length > 0 ? (
          <button
            type="button"
            onClick={() => void copyList()}
            className="shrink-0 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-medium text-ink"
          >
            {copied ? "Copied!" : "Copy list"}
          </button>
        ) : null}
      </div>

      {byVendor.map(([vendor, items]) => (
        <section key={vendor} className="rounded-2xl bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {vendor}
          </h2>
          <ul className="divide-y divide-surface-3">
            {items.map((item) => {
              const need = needToBuy(item);
              return (
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
                    <span className="font-semibold text-warn">
                      Need {need} {item.unit}
                    </span>
                    {item.price != null ? <span>{formatPrice(item.price)}</span> : null}
                  </div>
                  {item.notes ? (
                    <p className="mt-1 text-sm text-ink-muted">{item.notes}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={shopAmazonUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink"
                    >
                      Shop Amazon
                    </a>
                    <a
                      href={shopCostcoUrl(item.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink"
                    >
                      Shop Costco
                    </a>
                    <a
                      href={shopWalmartUrl(item.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink"
                    >
                      Shop Walmart
                    </a>
                    <button
                      type="button"
                      onClick={() => markRestocked(item.id)}
                      className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent"
                    >
                      Mark restocked
                    </button>
                  </div>
                </li>
              );
            })}
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
