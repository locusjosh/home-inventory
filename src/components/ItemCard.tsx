"use client";

import Link from "next/link";
import type { InventoryItem } from "@/lib/types";
import { isLowStock } from "@/lib/utils";
import { QuantityStepper } from "./QuantityStepper";

type Props = {
  item: InventoryItem;
  onQuantity: (id: string, qty: number) => void;
  showMove?: boolean;
  onMove?: (id: string) => void;
};

export function ItemCard({ item, onQuantity, showMove, onMove }: Props) {
  const low = isLowStock(item);

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 shadow-soft ${
        low ? "border-warn/40" : "border-surface-3"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/items/${encodeURIComponent(item.id)}`}
            className="block truncate text-base font-semibold text-ink hover:text-accent"
          >
            {item.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="rounded-md bg-surface-2 px-2 py-0.5">{item.folder}</span>
            {item.unit ? <span>{item.unit}</span> : null}
            {low ? (
              <span className="rounded-md bg-warn/15 px-2 py-0.5 font-medium text-warn">
                Low · min {item.minLevel}
              </span>
            ) : item.minLevel !== null ? (
              <span>min {item.minLevel}</span>
            ) : null}
            {item.vendor ? <span>{item.vendor}</span> : null}
          </div>
        </div>
        <QuantityStepper
          value={item.quantity}
          onChange={(q) => onQuantity(item.id, q)}
          unit={item.unit}
        />
      </div>
      {showMove && onMove ? (
        <button
          type="button"
          onClick={() => onMove(item.id)}
          className="mt-3 w-full rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent"
        >
          Move to folder…
        </button>
      ) : null}
    </div>
  );
}
