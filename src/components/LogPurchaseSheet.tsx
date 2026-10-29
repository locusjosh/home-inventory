"use client";

import { useEffect, useRef, useState } from "react";
import type { InventoryItem, Purchase } from "@/lib/types";
import { formatPrice, needToBuy } from "@/lib/utils";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { FieldRow, TextInput } from "./ui/Form";
import { ItemImage } from "./ItemImage";

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
  title?: string;
};

export function LogPurchaseSheet({
  item,
  lastPurchase,
  open,
  onClose,
  onSave,
  title = "Log Purchase",
}: LogPurchaseSheetProps) {
  const priceRef = useRef<HTMLInputElement>(null);
  const [qty, setQty] = useState(String(Math.max(1, needToBuy(item) || 1)));
  const [pricePaid, setPricePaid] = useState("");
  const [vendor, setVendor] = useState(item.lastVendor || item.vendor || "");
  const [expanded, setExpanded] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [promoNotes, setPromoNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setQty(String(Math.max(1, needToBuy(item) || 1)));
    setPricePaid("");
    setVendor(item.lastVendor || item.vendor || "");
    setExpanded(false);
    setListPrice("");
    setDiscountPercent("");
    setDiscountAmount("");
    setPromoNotes("");
    const t = window.setTimeout(() => priceRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, item]);

  const paidValid = pricePaid !== "" && Number.isFinite(Number(pricePaid)) && Number(pricePaid) >= 0;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!paidValid) {
      priceRef.current?.focus();
      return;
    }
    const q = Number(qty);
    onSave({
      qty: Number.isFinite(q) && q > 0 ? q : 1,
      pricePaid: Number(pricePaid),
      listPrice: listPrice === "" ? null : Number(listPrice),
      discountPercent: discountPercent === "" ? null : Number(discountPercent),
      discountAmount: discountAmount === "" ? null : Number(discountAmount),
      promoNotes: promoNotes.trim() || null,
      vendor: vendor.trim() || null,
    });
  };

  const reference = lastPurchase
    ? `Last paid ${formatPrice(lastPurchase.pricePaid)}${lastPurchase.vendor ? ` at ${lastPurchase.vendor}` : ""}${
        lastPurchase.unitPricePaid != null ? ` · ${formatPrice(lastPurchase.unitPricePaid)}/${lastPurchase.unit}` : ""
      }`
    : item.price != null
      ? `Listed at ${formatPrice(item.price)}`
      : "No price history yet";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      leading={
        <Button variant="plain" onClick={onClose}>
          Cancel
        </Button>
      }
      trailing={
        <Button variant="plain" onClick={() => submit()} disabled={!paidValid} className="font-semibold">
          Save
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-6 pt-2">
        <div className="flex items-center gap-3 px-1">
          <ItemImage item={item} className="h-14 w-14" rounded="rounded-[10px]" symbolSize={26} />
          <div className="min-w-0">
            <p className="truncate text-headline text-label">{item.name}</p>
            <p className="text-subhead text-label-2">{reference}</p>
          </div>
        </div>

        <div className="ios-group glass overflow-hidden rounded-card">
          <FieldRow label="Price Paid">
            <span className="flex items-center text-body text-label-2">
              $
              <TextInput
                ref={priceRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={pricePaid}
                onChange={(e) => setPricePaid(e.target.value)}
                placeholder="0.00"
                className="w-28 font-semibold"
              />
            </span>
          </FieldRow>
          <FieldRow label="Quantity">
            <TextInput
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-24"
            />
          </FieldRow>
          <FieldRow label="Store">
            <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Costco, Amazon…" />
          </FieldRow>
        </div>

        {expanded ? (
          <section>
            <h3 className="px-4 pb-1.5 eyebrow text-label-2">Deal Details</h3>
            <div className="ios-group glass overflow-hidden rounded-card">
              <FieldRow label="Regular Price">
                <TextInput type="number" inputMode="decimal" min={0} step="0.01" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder="Optional" />
              </FieldRow>
              <FieldRow label="Percent Off">
                <TextInput type="number" inputMode="decimal" min={0} max={100} step="any" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} placeholder="Optional" />
              </FieldRow>
              <FieldRow label="Amount Off">
                <TextInput type="number" inputMode="decimal" min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="Optional" />
              </FieldRow>
              <FieldRow label="Promo">
                <TextInput value={promoNotes} onChange={(e) => setPromoNotes(e.target.value)} placeholder="Buy 4, save 33%" />
              </FieldRow>
            </div>
          </section>
        ) : (
          <Button variant="plain" block onClick={() => setExpanded(true)}>
            Add Deal Details
          </Button>
        )}

        <Button type="submit" variant="primary" size="lg" block disabled={!paidValid}>
          Save Purchase
        </Button>
      </form>
    </Sheet>
  );
}
