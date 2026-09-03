"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { FOLDERS, type Attribute } from "@/lib/types";
import { QuantityStepper } from "@/components/QuantityStepper";
import { LogPurchaseSheet } from "@/components/LogPurchaseSheet";
import { formatPrice } from "@/lib/utils";

export default function ItemDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const {
    items,
    updateItem,
    updateQuantity,
    archiveItem,
    deleteItem,
    logPurchase,
    getPurchasesForItem,
  } = useInventory();
  const item = items.find((i) => i.id === id);

  const [attrName, setAttrName] = useState("");
  const [attrOption, setAttrOption] = useState("");
  const [showPurchase, setShowPurchase] = useState(false);

  const attrs = useMemo(() => item?.attributes ?? [], [item]);

  if (!item) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <p className="text-ink-muted">Item not found.</p>
        <Link href="/" className="mt-3 inline-block text-accent">
          Back to stock
        </Link>
      </div>
    );
  }

  const setField = <K extends keyof typeof item>(key: K, value: (typeof item)[K]) => {
    updateItem(item.id, { [key]: value });
  };

  const addAttr = () => {
    if (!attrName.trim()) return;
    const next: Attribute[] = [...attrs, { name: attrName.trim(), option: attrOption.trim() }];
    updateItem(item.id, { attributes: next });
    setAttrName("");
    setAttrOption("");
  };

  const removeAttr = (idx: number) => {
    updateItem(item.id, { attributes: attrs.filter((_, i) => i !== idx) });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-accent">
          ← Stock
        </Link>
        {item.archived ? (
          <span className="rounded-full bg-surface-3 px-2 py-1 text-xs text-ink-muted">Archived</span>
        ) : null}
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-soft space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            value={item.name}
            onChange={(e) => setField("name", e.target.value)}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-lg font-semibold text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Quantity</span>
          <QuantityStepper
            value={item.quantity}
            onChange={(q) => updateQuantity(item.id, q)}
            unit={item.unit}
          />
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Folder</span>
          <select
            value={item.folder}
            onChange={(e) => setField("folder", e.target.value)}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          >
            {!FOLDERS.includes(item.folder as (typeof FOLDERS)[number]) ? (
              <option value={item.folder}>{item.folder}</option>
            ) : null}
            {FOLDERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Unit</span>
            <input
              value={item.unit}
              onChange={(e) => setField("unit", e.target.value)}
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Min level</span>
            <input
              type="number"
              min={0}
              step="any"
              value={item.minLevel ?? ""}
              onChange={(e) =>
                setField("minLevel", e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Price</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={item.price ?? ""}
              onChange={(e) =>
                setField("price", e.target.value === "" ? null : Number(e.target.value))
              }
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink">Vendor</span>
            <input
              value={item.vendor ?? ""}
              onChange={(e) => setField("vendor", e.target.value || null)}
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-ink">Notes</span>
          <textarea
            value={item.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value || null)}
            rows={3}
            className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
          />
        </label>


        <div className="space-y-2 border-t border-surface-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Purchase history</span>
            <button
              type="button"
              onClick={() => setShowPurchase(true)}
              className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent"
            >
              Log purchase
            </button>
          </div>
          {(() => {
            const hist = getPurchasesForItem(item.id);
            if (!hist.length) {
              return (
                <p className="text-sm text-ink-muted">
                  No purchases logged yet. Track price paid for inflation.
                </p>
              );
            }
            return (
              <ul className="space-y-2">
                {hist.slice(0, 12).map((p, idx) => {
                  const prev = hist[idx + 1];
                  let trend: string | null = null;
                  if (
                    prev &&
                    prev.unitPricePaid != null &&
                    p.unitPricePaid != null &&
                    prev.unitPricePaid > 0
                  ) {
                    const pct =
                      ((p.unitPricePaid - prev.unitPricePaid) / prev.unitPricePaid) *
                      100;
                    if (Math.abs(pct) >= 0.5) {
                      const arrow = pct > 0 ? "↑" : "↓";
                      const color = pct > 0 ? "text-danger" : "text-emerald-600";
                      trend = `${arrow} ${Math.abs(pct).toFixed(0)}%`;
                      return (
                        <li
                          key={p.id}
                          className="rounded-xl bg-surface-2 px-3 py-2 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-ink">
                                {formatPrice(p.pricePaid)}
                                <span className="ml-1 font-normal text-ink-muted">
                                  ({formatPrice(p.unitPricePaid)}/{p.unit} × {p.qty})
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted">
                                {new Date(p.purchasedAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {p.vendor ? ` · ${p.vendor}` : ""}
                                {p.promoNotes ? ` · ${p.promoNotes}` : ""}
                                {p.discountPercent != null
                                  ? ` · ${p.discountPercent}% off`
                                  : ""}
                              </div>
                            </div>
                            <span className={`shrink-0 text-xs font-semibold ${color}`}>
                              {trend}
                            </span>
                          </div>
                        </li>
                      );
                    }
                  }
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl bg-surface-2 px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-ink">
                        {formatPrice(p.pricePaid)}
                        <span className="ml-1 font-normal text-ink-muted">
                          ({formatPrice(p.unitPricePaid)}/{p.unit} × {p.qty})
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted">
                        {new Date(p.purchasedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {p.vendor ? ` · ${p.vendor}` : ""}
                        {p.promoNotes ? ` · ${p.promoNotes}` : ""}
                        {p.discountPercent != null
                          ? ` · ${p.discountPercent}% off`
                          : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-ink">Attributes</span>
          <ul className="space-y-1">
            {attrs.map((a, idx) => (
              <li
                key={`${a.name}-${idx}`}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{a.name}</strong>: {a.option}
                </span>
                <button
                  type="button"
                  className="text-danger"
                  onClick={() => removeAttr(idx)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              placeholder="Name"
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
              className="rounded-xl border border-surface-3 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              placeholder="Option"
              value={attrOption}
              onChange={(e) => setAttrOption(e.target.value)}
              className="rounded-xl border border-surface-3 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addAttr}
              className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
            >
              Add
            </button>
          </div>
        </div>

        {item.sortlyId ? (
          <p className="text-xs text-ink-muted">Sortly ID: {item.sortlyId}</p>
        ) : null}
      </div>

      {showPurchase ? (
        <LogPurchaseSheet
          item={item}
          lastPurchase={getPurchasesForItem(item.id)[0] ?? null}
          open
          onClose={() => setShowPurchase(false)}
          onSave={(data) => {
            logPurchase({
              itemId: item.id,
              ...data,
              source: "manual",
              alsoRestock: false,
            });
            setShowPurchase(false);
          }}
        />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => archiveItem(item.id, !item.archived)}
          className="rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium text-ink"
        >
          {item.archived ? "Unarchive" : "Archive"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Permanently delete this item?")) {
              deleteItem(item.id);
              router.push("/");
            }
          }}
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
