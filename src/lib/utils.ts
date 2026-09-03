import type { InventoryItem } from "./types";

export function isLowStock(item: InventoryItem): boolean {
  if (item.archived) return false;
  if (item.minLevel === null || item.minLevel === undefined) return false;
  return item.quantity < item.minLevel;
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
      JSON.stringify(i.attributes ?? []),
    ]
      .map(escape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
