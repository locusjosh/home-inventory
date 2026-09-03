"use client";

import { useEffect, useRef, useState } from "react";
import type { InventoryItem, Purchase } from "@/lib/types";
import { formatPrice, needToBuy } from "@/lib/utils";

type LogPurchaseSheetProps = {
  item: InventoryItem;
  lastPurchase?: Purchase | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    qty: number;
    pricePaid: number;
    listPrice?: number | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    promoNotes?: string | null;
    vendor?: string | null;
  }) => void;
  /** Optional title override */
  title?: string;
};

export function LogPurchaseSheet({
  item,
  lastPurchase,
  open,
  onClose,
  onSave,
  title = "Log purchase",
}: LogPurchaseSheetProps) {
  const priceRef = useRef<HTMLInputElement>(null);
  const need = Math.max(1, needToBuy(item) || 1);
  const [qty, setQty] = useState(String(need));
  const [pricePaid, setPricePaid] = useState("");
  const [vendor, setVendor] = useState(
    item.lastVendor || item.vendor || ""
  );
  const [expanded, setExpanded] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [promoNotes, setPromoNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const n = Math.max(1, needToBuy(item) || 1);
    setQty(String(n));
    setPricePaid("");
    setVendor(item.lastVendor || item.vendor || "");
    setExpanded(false);
    setListPrice("");
    setDiscountPercent("");
    setDiscountAmount("");
    setPromoNotes("");
    // Focus price for numeric keypad
    const t = window.setTimeout(() => priceRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, item]);

  if (!open) return null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const paid = Number(pricePaid);
    if (!Number.isFinite(paid) || paid < 0) {
      priceRef.current?.focus();
      return;
    }
    const q = Number(qty);
    onSave({
      qty: Number.isFinite(q) && q > 0 ? q : 1,
      pricePaid: paid,
      listPrice: listPrice === "" ? null : Number(listPrice),
      discountPercent:
        discountPercent === "" ? null : Number(discountPercent),
      discountAmount: discountAmount === "" ? null : Number(discountAmount),
      promoNotes: promoNotes.trim() || null,
      vendor: vendor.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-surface p-4 shadow-soft sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="text-sm text-ink-muted">{item.name}</p>
            {lastPurchase ? (
              <p className="mt-0.5 text-xs text-ink-muted">
                Last: {formatPrice(lastPurchase.pricePaid)}
                {lastPurchase.vendor ? ` at ${lastPurchase.vendor}` : ""}
                {lastPurchase.unitPricePaid != null
                  ? ` · ${formatPrice(lastPurchase.unitPricePaid)}/${lastPurchase.unit}`
                  : ""}
              </p>
            ) : item.price != null ? (
              <p className="mt-0.5 text-xs text-ink-muted">
                Listed: {formatPrice(item.price)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-muted"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-muted">Qty</span>
              <input
                type="number"
                inputMode="decimal"
                min={0.01}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-muted">
                Price paid ($)
              </span>
              <input
                ref={priceRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={pricePaid}
                onChange={(e) => setPricePaid(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-lg font-semibold text-ink outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Vendor</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Costco, Amazon…"
              className="w-full rounded-xl border border-surface-3 bg-surface-2 px-3 py-3 text-ink outline-none focus:border-accent"
            />
          </label>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-accent"
          >
            {expanded ? "Hide promo details" : "List price / promo (optional)"}
          </button>

          {expanded ? (
            <div className="space-y-3 rounded-xl bg-surface-2 p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-ink-muted">List / was ($)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="w-full rounded-xl border border-surface-3 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-ink-muted">% off</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full rounded-xl border border-surface-3 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-ink-muted">$ off</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full rounded-xl border border-surface-3 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-muted">Promo notes</span>
                <input
                  value={promoNotes}
                  onChange={(e) => setPromoNotes(e.target.value)}
                  placeholder='e.g. "buy 4 save 33%"'
                  className="w-full rounded-xl border border-surface-3 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </label>
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
