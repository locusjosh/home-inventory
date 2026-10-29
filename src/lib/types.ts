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

/** One extra product link shown as a button after the Default (`productUrl`). */
export type ItemLink = {
  /** 1–24 chars, shown on the button. Empty → store name from the URL. */
  label: string;
  /** Normalised https URL (open-only, never fetched). */
  url: string;
};

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
  /** Optional product page (open-only, never fetched). Normalised https URL. */
  productUrl?: string | null;
  /**
   * Extra product links (max 6), shown as buttons after the Default button.
   * Always passed through sanitizeItemLinks(); omitted (not []) when empty so
   * items without links keep exactly the fields they had before. Older app
   * versions drop it locally but never delete it in the cloud (see sync/meta.ts).
   */
  links?: ItemLink[];
  /**
   * Gallery order (max 4). Entries are "bundled" (the seed packshot in `image`)
   * or IndexedDB photo keys. Undefined = legacy/default order, derived at runtime.
   */
  photoOrder?: string[];
  /**
   * Set when the item is moved to Recently Deleted (ISO time). The item also
   * gets `archived: true`, so app versions that predate this field keep hiding it.
   * Present only while the item is in Recently Deleted.
   */
  trashedAt?: string | null;
  /** Present (true) only when the item was already archived before it was deleted; Recover puts it back there. */
  restoreArchived?: boolean;
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
  /** Optional pre-generated id (lets Add Item key photos before the item exists). */
  id?: string;
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
  productUrl?: string | null;
  photoOrder?: string[];
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
