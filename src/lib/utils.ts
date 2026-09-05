import type { InventoryItem } from "./types";
import { SUGGESTED_FOLDER } from "./types";

export function isSuggested(item: InventoryItem): boolean {
  return item.folder === SUGGESTED_FOLDER;
}

/** Non-archived stock items (excludes Suggested Items wishlist). */
export function myItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => !i.archived && !isSuggested(i));
}

/** Non-archived Suggested Items (wishlist / ideas). */
export function ideaItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => !i.archived && isSuggested(i));
}

export function isLowStock(item: InventoryItem): boolean {
  if (item.archived || isSuggested(item)) return false;
  if (item.minLevel === null || item.minLevel === undefined) return false;
  return item.quantity < item.minLevel;
}

/** Needs count: has minLevel and (qty===0 or never counted). Stock only. */
export function needsCount(item: InventoryItem): boolean {
  if (item.archived || isSuggested(item)) return false;
  if (item.minLevel === null || item.minLevel === undefined) return false;
  if (!item.lastCountedAt) return true;
  return item.quantity === 0;
}

export function needToBuy(item: InventoryItem): number {
  const min = item.minLevel ?? 0;
  return Math.max(0, min - item.quantity);
}

export function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function formatPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return `$${n.toFixed(2)}`;
}

export function uid(prefix = "item"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Extract first amazon / a.co URL from notes if present. */
export function extractAmazonUrl(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(
    /https?:\/\/(?:www\.)?(?:amazon\.com|a\.co)[^\s)\]"']*/i
  );
  return match ? match[0] : null;
}

export function shopAmazonUrl(item: InventoryItem): string {
  const fromNotes = extractAmazonUrl(item.notes);
  if (fromNotes) return fromNotes;
  return `https://www.amazon.com/s?k=${encodeURIComponent(item.name)}`;
}

export function shopCostcoUrl(name: string): string {
  return `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(name)}`;
}

export function shopWalmartUrl(name: string): string {
  return `https://www.walmart.com/search?q=${encodeURIComponent(name)}`;
}

export function itemsToCsv(items: InventoryItem[]): string {
  const headers = [
    "id",
    "sortlyId",
    "name",
    "folder",
    "quantity",
    "unit",
    "minLevel",
    "price",
    "vendor",
    "notes",
    "archived",
    "lastCountedAt",
    "attributes",
  ];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = items.map((i) =>
    [
      i.id,
      i.sortlyId ?? "",
      i.name,
      i.folder,
      i.quantity,
      i.unit,
      i.minLevel ?? "",
      i.price ?? "",
      i.vendor ?? "",
      i.notes ?? "",
      i.archived ? "true" : "false",
      i.lastCountedAt ?? "",
      JSON.stringify(i.attributes ?? []),
    ]
      .map(escape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
