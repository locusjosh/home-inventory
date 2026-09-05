"use client";

import Link from "next/link";
import type { InventoryItem } from "@/lib/types";
import { isLowStock, needsCount } from "@/lib/utils";
import { QuantityStepper } from "./QuantityStepper";
import { ItemImage } from "./ItemImage";

type Props = {
  item: InventoryItem;
  onQuantity: (id: string, qty: number) => void;
  showMove?: boolean;
  onMove?: (id: string) => void;
  /** Visual product grid card (photo-first) */
  variant?: "list" | "grid";
};

export function ItemCard({
  item,
  onQuantity,
  showMove,
  onMove,
  variant = "list",
}: Props) {
  const low = isLowStock(item);
  const needs = needsCount(item);

  if (variant === "grid") {
    return (
      <div
        className={`group card-lux overflow-hidden pressable ${
          low ? "ring-1 ring-warn/35" : ""
        }`}
      >
        <Link
          href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
          className="block focus-ring"
        >
          <ItemImage item={item} aspect="aspect-[4/3]" className="rounded-none" />
        </Link>
        <div className="space-y-2 p-3">
          <div className="min-w-0">
            <Link
              href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
              className="line-clamp-2 text-sm font-semibold leading-snug text-ink hover:text-accent"
            >
              {item.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-muted">
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5">{item.folder}</span>
              {low ? (
                <span className="rounded-md bg-warn/15 px-1.5 py-0.5 font-medium text-warn">
                  Low
                </span>
              ) : null}
              {needs ? (
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                  Count
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center">
            <QuantityStepper
              value={item.quantity}
              onChange={(q) => onQuantity(item.id, q)}
              unit={item.unit}
              compact
            />
          </div>
          {showMove && onMove ? (
            <button
              type="button"
              onClick={() => onMove(item.id)}
              className="w-full rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent pressable focus-ring"
            >
              Move to folder…
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group card-lux overflow-hidden ${
        low ? "ring-1 ring-warn/35" : ""
      }`}
    >
      <div className="flex gap-3 p-3 sm:p-4">
        <Link
          href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
          className="shrink-0 focus-ring rounded-2xl"
        >
          <ItemImage
            item={item}
            aspect="aspect-square"
            className="h-20 w-20 rounded-2xl shadow-soft sm:h-24 sm:w-24"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/items/edit/?id=${encodeURIComponent(item.id)}`}
                className="block truncate text-base font-semibold text-ink hover:text-accent"
              >
                {item.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <span className="rounded-md bg-surface-2 px-2 py-0.5">{item.folder}</span>
                {item.unit ? <span>{item.unit}</span> : null}
                {low ? (
                  <span className="rounded-md bg-warn/15 px-2 py-0.5 font-medium text-warn">
                    Low · min {item.minLevel}
                  </span>
                ) : item.minLevel !== null ? (
                  <span>min {item.minLevel}</span>
                ) : null}
                {needs ? (
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent">
                    Needs count
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <QuantityStepper
              value={item.quantity}
              onChange={(q) => onQuantity(item.id, q)}
              unit={item.unit}
              compact
            />
            <button
              type="button"
              onClick={() => onQuantity(item.id, Math.max(0, item.quantity - 1))}
              className="min-h-tap rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-3 hover:text-ink pressable focus-ring"
            >
              Use 1
            </button>
          </div>
        </div>
      </div>
      {showMove && onMove ? (
        <button
          type="button"
          onClick={() => onMove(item.id)}
          className="w-full border-t border-surface-3/70 bg-accent-soft/40 px-3 py-2.5 text-sm font-medium text-accent pressable"
        >
          Move to folder…
        </button>
      ) : null}
    </div>
  );
}
