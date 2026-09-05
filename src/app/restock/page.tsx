"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { LogPurchaseSheet } from "@/components/LogPurchaseSheet";
import { ItemImage } from "@/components/ItemImage";
import { EmptyState } from "@/components/EmptyState";
import type { InventoryItem } from "@/lib/types";
import {
  formatPrice,
  needToBuy,
  shopAmazonUrl,
  shopCostcoUrl,
  shopWalmartUrl,
} from "@/lib/utils";

function ShopMenu({ item }: { item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Amazon", href: shopAmazonUrl(item) },
    { label: "Costco", href: shopCostcoUrl(item.name) },
    { label: "Walmart", href: shopWalmartUrl(item.name) },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-tap rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm font-semibold text-ink ring-1 ring-surface-3 pressable focus-ring"
      >
        Shop ▾
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close shop menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-surface-3 bg-surface shadow-lux-lg">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2"
              >
                {l.label}
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

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
          <h1 className="font-display text-2xl font-semibold text-ink">Restock list</h1>
          <p className="text-sm text-ink-muted">
            Low-stock items with need-to-buy qty
            {lowStockItems.some((i) => i.price != null)
              ? ` · ~${formatPrice(total)} listed`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/receipt"
            className="min-h-tap rounded-xl bg-accent px-3 py-2.5 text-center text-sm font-semibold text-white pressable focus-ring"
          >
            Scan receipt
          </Link>
          {lowStockItems.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyList()}
              className="min-h-tap rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink ring-1 ring-surface-3 pressable focus-ring"
            >
              {copied ? "Copied!" : "Copy list"}
            </button>
          ) : null}
        </div>
      </div>

      {byVendor.map(([vendor, items]) => (
        <section key={vendor} className="card-lux p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {vendor}
          </h2>
          <ul className="divide-y divide-surface-3">
            {items.map((item) => {
              const need = needToBuy(item);
              const last = getLastPurchase(item.id);
              return (
                <li key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                  <Link
                    href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
                    className="shrink-0 focus-ring rounded-xl"
                  >
                    <ItemImage
                      item={item}
                      aspect="aspect-square"
                      className="h-14 w-14 rounded-xl shadow-soft"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
                      className="block font-semibold text-ink hover:text-accent"
                    >
                      {item.name}
                    </Link>

                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          Have
                        </dt>
                        <dd className="font-semibold tabular-nums text-ink">
                          {item.quantity} {item.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          Min
                        </dt>
                        <dd className="font-semibold tabular-nums text-ink">
                          {item.minLevel ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          Need
                        </dt>
                        <dd className="font-semibold tabular-nums text-warn">
                          {need} {item.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          Price
                        </dt>
                        <dd className="font-semibold tabular-nums text-ink">
                          {item.price != null ? formatPrice(item.price) : "—"}
                        </dd>
                      </div>
                    </dl>

                    {last ? (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Last paid {formatPrice(last.pricePaid)}
                        {last.vendor ? ` at ${last.vendor}` : ""}
                        {last.unitPricePaid != null
                          ? ` · ${formatPrice(last.unitPricePaid)}/${last.unit}`
                          : ""}
                      </p>
                    ) : null}

                    {item.notes ? (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{item.notes}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSheetAlsoRestock(true);
                          setSheetItem(item);
                        }}
                        className="min-h-tap rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-white pressable focus-ring"
                      >
                        Log purchase
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkRestocked(item)}
                        className="min-h-tap rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-semibold text-accent ring-1 ring-accent/25 pressable focus-ring"
                      >
                        Mark restocked
                      </button>
                      <ShopMenu item={item} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {lowStockItems.length === 0 ? (
        <EmptyState
          title="Restock list is empty"
          description="Nothing is below min level right now."
          action={
            <Link
              href="/receipt"
              className="inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white pressable"
            >
              Scan a receipt
            </Link>
          }
        />
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
                className="min-h-tap flex-1 rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold text-ink"
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
                className="min-h-tap flex-1 rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-white"
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
