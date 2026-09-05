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

/** Real stock folders (excludes Suggested Items wishlist). */
export const STOCK_FOLDERS: FolderName[] = [
  "Bathroom",
  "Cleaning",
  "Family",
  "Kitchen",
  "Laundry",
  "Maintenance",
  "Outside",
];

export const SUGGESTED_FOLDER: FolderName = "Suggested Items";

export const FOLDERS: FolderName[] = [...STOCK_FOLDERS, SUGGESTED_FOLDER];

/** Folders used in count mode — stock only. */
export const COUNT_FOLDERS: FolderName[] = [...STOCK_FOLDERS];

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
  /** Public path like /item-photos/SID.jpg — use assetPath() for <img src> */
  image?: string | null;
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
  source?: "restock" | "chat" | "manual" | "receipt";
  /** Links purchase lines from one scanned receipt */
  receiptId?: string;
  /** Original OCR line text */
  rawLine?: string;
  /** OCR confidence 0–100 for this line / receipt */
  ocrConfidence?: number;
  /** Optional compressed thumbnail dataURL (prefer omit if storage tight) */
  receiptImageId?: string;
};

/** Receipt metadata without full image (OCR text + vendor/date). */
export type ReceiptRecord = {
  id: string;
  vendor: string | null;
  date: string; // ISO date or purchasedAt
  rawText: string;
  createdAt: string;
  /** Optional tiny compressed thumbnail (dataURL); omit when large */
  thumbnailDataUrl?: string | null;
  lineCount?: number;
  tax?: number | null;
  total?: number | null;
};

export type InventoryState = {
  items: InventoryItem[];
  purchases: Purchase[];
  receipts?: ReceiptRecord[];
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
  image?: string | null;
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
  source?: "restock" | "chat" | "manual" | "receipt";
  /** Also bump qty / mark restocked (default true for restock/chat) */
  alsoRestock?: boolean;
  purchasedAt?: string;
  receiptId?: string;
  rawLine?: string;
  ocrConfidence?: number;
  receiptImageId?: string;
};
