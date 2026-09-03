"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { LogPurchaseSheet } from "@/components/LogPurchaseSheet";
import type { InventoryItem } from "@/lib/types";
import {
  formatPrice,
  needToBuy,
  shopAmazonUrl,
  shopCostcoUrl,
  shopWalmartUrl,
} from "@/lib/utils";

export default function RestockPage() {
  const { lowStockItems, markRestocked, logPurchase, getLastPurchase } =
    useInventory();
  const [copied, setCopied] = useState(false);
  const [sheetItem, setSheetItem] = useState<InventoryItem | null>(null);
  const [sheetAlsoRestock, setSheetAlsoRestock] = useState(true);
  const [payPromptItem, setPayPromptItem] = useState<InventoryItem | null>(
    null
  );

  const byVendor = useMemo(() => {
    const map = new Map<string, typeof lowStockItems>();
    for (const item of lowStockItems) {
      const key =
        item.lastVendor?.trim() || item.vendor?.trim() || "No vendor";
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
        const last = getLastPurchase(item.id);
        lines.push(
          `- ${item.name}: buy ${need} ${item.unit} (have ${item.quantity}, min ${item.minLevel})` +
            (item.price != null ? ` · ${formatPrice(item.price)}` : "") +
            (last
              ? ` · last ${formatPrice(last.pricePaid)}${last.vendor ? ` @ ${last.vendor}` : ""}`
              : "")
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

  const onMarkRestocked = (item: InventoryItem) => {
    markRestocked(item.id);
    setPayPromptItem(item);
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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/receipt"
            className="rounded-xl bg-accent px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            Scan receipt
          </Link>
          {lowStockItems.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyList()}
              className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-medium text-ink"
            >
              {copied ? "Copied!" : "Copy list"}
            </button>
          ) : null}
        </div>
      </div>

      {byVendor.map(([vendor, items]) => (
        <section key={vendor} className="rounded-2xl bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {vendor}
          </h2>
          <ul className="divide-y divide-surface-3">
            {items.map((item) => {
              const need = needToBuy(item);
              const last = getLastPurchase(item.id);
              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
                    className="block font-medium text-ink hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  {last ? (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Last: {formatPrice(last.pricePaid)}
                      {last.vendor ? ` at ${last.vendor}` : ""}
                      {last.unitPricePaid != null
                        ? ` · ${formatPrice(last.unitPricePaid)}/${last.unit}`
                        : ""}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                    <span>
                      Have {item.quantity} {item.unit} · min {item.minLevel}
                    </span>
                    <span className="font-semibold text-warn">
                      Need {need} {item.unit}
                    </span>
                    {item.price != null ? (
                      <span>{formatPrice(item.price)}</span>
                    ) : null}
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
                      onClick={() => {
                        setSheetAlsoRestock(true);
                        setSheetItem(item);
                      }}
                      className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Log purchase
                    </button>
                    <button
                      type="button"
                      onClick={() => onMarkRestocked(item)}
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
          <p>Restock list is empty.</p>
          <Link
            href="/receipt"
            className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            Scan a receipt
          </Link>
        </div>
      ) : null}

      {sheetItem ? (
        <LogPurchaseSheet
          item={sheetItem}
          lastPurchase={getLastPurchase(sheetItem.id)}
          open
          onClose={() => setSheetItem(null)}
          onSave={(data) => {
            logPurchase({
              itemId: sheetItem.id,
              ...data,
              source: "restock",
              alsoRestock: sheetAlsoRestock,
            });
            setSheetItem(null);
          }}
        />
      ) : null}

      {payPromptItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPayPromptItem(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-surface p-4 shadow-soft sm:rounded-2xl">
            <h3 className="font-semibold text-ink">What&apos;d you pay?</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Optional — log price for {payPromptItem.name} (inflation tracking).
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPayPromptItem(null)}
                className="flex-1 rounded-xl bg-surface-2 px-3 py-3 text-sm font-medium text-ink"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetAlsoRestock(false);
                  setSheetItem(payPromptItem);
                  setPayPromptItem(null);
                }}
                className="flex-1 rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-white"
              >
                Log price
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
