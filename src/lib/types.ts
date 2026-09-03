export type Attribute = {
  name: string;
  option: string;
};

export type FolderName =
  | "Bathroom"
  | "Cleaning"
  | "Family"
  | "Kitchen"
  | "Laundry"
  | "Maintenance"
  | "Outside"
  | "Suggested Items";

export const FOLDERS: FolderName[] = [
  "Bathroom",
  "Cleaning",
  "Family",
  "Kitchen",
  "Laundry",
  "Maintenance",
  "Outside",
  "Suggested Items",
];

/** Folders shown first in count mode (Suggested Items last). */
export const COUNT_FOLDERS: FolderName[] = [
  "Bathroom",
  "Cleaning",
  "Family",
  "Kitchen",
  "Laundry",
  "Maintenance",
  "Outside",
  "Suggested Items",
];

export type InventoryItem = {
  id: string;
  sortlyId?: string | null;
  name: string;
  folder: string;
  group?: string | null;
  attributes: Attribute[];
  quantity: number;
  unit: string;
  minLevel: number | null;
  price: number | null;
  notes: string | null;
  vendor: string | null;
  archived?: boolean;
  /** ISO timestamp set when quantity confirmed in count mode */
  lastCountedAt?: string | null;
  /** Last vendor used when logging a purchase */
  lastVendor?: string | null;
};

export type Purchase = {
  id: string;
  itemId: string;
  purchasedAt: string; // ISO
  qty: number;
  unit: string;
  pricePaid: number; // total paid for this line
  listPrice?: number | null; // was / MSRP if known
  discountAmount?: number | null; // dollars off
  discountPercent?: number | null;
  promoNotes?: string | null; // "buy 4 save 33%", coupon, etc.
  vendor?: string | null;
  unitPricePaid?: number | null; // computed pricePaid/qty
  source?: "restock" | "chat" | "manual";
};

export type InventoryState = {
  items: InventoryItem[];
  purchases: Purchase[];
  version: number;
  seededAt?: string;
};

export type ItemDraft = {
  name: string;
  folder: string;
  quantity: number;
  unit: string;
  minLevel: number | null;
  price: number | null;
  notes: string | null;
  vendor: string | null;
  attributes: Attribute[];
  archived?: boolean;
};

export type LogPurchaseInput = {
  itemId: string;
  qty: number;
  pricePaid: number;
  listPrice?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  promoNotes?: string | null;
  vendor?: string | null;
  unit?: string;
  source?: "restock" | "chat" | "manual";
  /** Also bump qty / mark restocked (default true for restock/chat) */
  alsoRestock?: boolean;
};
