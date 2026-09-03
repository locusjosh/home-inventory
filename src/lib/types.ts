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
};

export type InventoryState = {
  items: InventoryItem[];
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
