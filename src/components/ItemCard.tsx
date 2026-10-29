"use client";

import Link from "next/link";
import type { InventoryItem } from "@/lib/types";
import { formatQty, isLowStock, needsCount } from "@/lib/utils";
import { ItemImage } from "./ItemImage";
import { MiniStepper, StatusTag } from "./ui/Controls";

type Props = {
  item: InventoryItem;
  onQuantity?: (id: string, qty: number) => void;
  /** Hide the inline stepper (browse-only grids) */
  readOnly?: boolean;
};

export function itemHref(id: string) {
  return `/items/edit/?id=${encodeURIComponent(id)}`;
}

/**
 * Photo-first product card. No borders: a white plate on the grouped
 * background, 1:1 media, 17pt semibold title, one quiet status line and a
 * single compact stepper.
 */
export function ItemCard({ item, onQuantity, readOnly }: Props) {
  const low = isLowStock(item);
  const needs = needsCount(item);
  return (
    <article className="glass flex flex-col rounded-card p-2">
      <Link href={itemHref(item.id)} className="pressable focus-ring block rounded-plate">
        <ItemImage item={item} rounded="rounded-plate" className="photo-plate" />
        <div className="px-1.5 pb-1 pt-2.5">
          <h3 className="line-clamp-2 min-h-[44px] text-headline text-label">{item.name}</h3>
          <div className="mt-1 flex min-h-[18px] items-center gap-2">
            {low ? (
              <StatusTag tone="orange">Low</StatusTag>
            ) : needs ? (
              <StatusTag tone="blue">Count</StatusTag>
            ) : null}
            <span className="truncate text-footnote text-label-2">
              {readOnly ? `${formatQty(item.quantity)} ${item.unit} · ` : ""}
              {item.folder}
            </span>
          </div>
        </div>
      </Link>
      {!readOnly && onQuantity ? (
        <div className="mt-1.5">
          <MiniStepper value={item.quantity} label={item.name} onChange={(q) => onQuantity(item.id, q)} />
        </div>
      ) : null}
    </article>
  );
}
