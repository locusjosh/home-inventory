import type { InventoryItem } from "./types";
import { findMatches } from "./chatbot";

export type ParsedLineKind = "item" | "discount" | "tax" | "total" | "subtotal" | "payment" | "other";

export type ParsedReceiptLine = {
  raw: string;
  description: string;
  qty: number;
  price: number;
  listPrice?: number | null;
  discountAmount?: number | null;
  kind: ParsedLineKind;
  confidence: "high" | "medium" | "low";
};

export type ParsedReceipt = {
  vendor: string | null;
  date: string | null;
  lines: ParsedReceiptLine[];
  tax: number | null;
  subtotal: number | null;
  total: number | null;
  rawText: string;
};

const SKIP_RE =
  /\b(visa|mastercard|amex|debit|credit|change|cash|auth|approval|card\s*#|xxxxxx|thank you|thanks|welcome|member|store\s*#|tel|phone|www\.|http|receipt|transaction|terminal|chip|pin|approved|balance)\b/i;

const TAX_RE = /\b(sales?\s*tax|tax)\b/i;
const SUBTOTAL_RE = /\b(sub\s*-?\s*total|subtotal)\b/i;
const TOTAL_RE = /\b(total|amount\s*due|grand\s*total|balance\s*due)\b/i;
const DISCOUNT_RE = /\b(save|savings|coupon|discount|promo|you\s*saved|instant\s*savings|member\s*savings)\b/i;
const QTY_AT_RE = /^(\d+(?:\.\d+)?)\s*[@xX]\s*/;
const QTY_PREFIX_RE = /^(\d+)\s+/;
const PRICE_TAIL_RE = /(-?\$?\s*\d{1,5}(?:[.,]\d{2})?)\s*[A-Za-z]?\s*$/;
const DATE_RE =
  /\b((?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:20)?\d{2}|(?:20\d{2})[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01]))\b/;

const VENDOR_HINTS: { re: RegExp; name: string }[] = [
  { re: /\bcostco\b/i, name: "Costco" },
  { re: /\bwalmart\b/i, name: "Walmart" },
  { re: /\bamazon\b/i, name: "Amazon" },
  { re: /\btarget\b/i, name: "Target" },
  { re: /\bsams?\s*club\b/i, name: "Sam's Club" },
  { re: /\bhome\s*depot\b/i, name: "Home Depot" },
  { re: /\blowe'?s\b/i, name: "Lowe's" },
  { re: /\bkroger\b/i, name: "Kroger" },
  { re: /\bsafeway\b/i, name: "Safeway" },
  { re: /\btrader\s*joe/i, name: "Trader Joe's" },
  { re: /\bwhole\s*foods\b/i, name: "Whole Foods" },
  { re: /\bcvs\b/i, name: "CVS" },
  { re: /\bwalgreens\b/i, name: "Walgreens" },
  { re: /\bbest\s*buy\b/i, name: "Best Buy" },
];

function parseMoney(s: string): number | null {
  const cleaned = s.replace(/[^\d.\-]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeDate(raw: string): string | null {
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const s = m[1];
  let y: number, mo: number, d: number;
  if (/^\d{4}/.test(s)) {
    const p = s.split(/[\/\-]/).map(Number);
    y = p[0]; mo = p[1]; d = p[2];
  } else {
    const p = s.split(/[\/\-]/).map(Number);
    mo = p[0]; d = p[1]; y = p[2] < 100 ? 2000 + p[2] : p[2];
  }
  if (!y || !mo || !d || mo > 12 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function detectVendor(text: string): string | null {
  for (const h of VENDOR_HINTS) {
    if (h.re.test(text)) return h.name;
  }
  const first = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length >= 3 &&
        l.length <= 40 &&
        !/\d{2}[\/\-]\d{2}/.test(l) &&
        !PRICE_TAIL_RE.test(l)
    );
  if (
    first &&
    !SKIP_RE.test(first) &&
    !TAX_RE.test(first) &&
    !TOTAL_RE.test(first)
  ) {
    return first.replace(/\s+/g, " ").slice(0, 40);
  }
  return null;
}

function classifyLine(desc: string, price: number): ParsedLineKind {
  if (TAX_RE.test(desc) && !DISCOUNT_RE.test(desc)) return "tax";
  if (SUBTOTAL_RE.test(desc)) return "subtotal";
  if (TOTAL_RE.test(desc) && !SUBTOTAL_RE.test(desc)) return "total";
  if (DISCOUNT_RE.test(desc) || price < 0) return "discount";
  if (SKIP_RE.test(desc)) return "payment";
  return "item";
}

function lineConfidence(
  desc: string,
  price: number,
  kind: ParsedLineKind
): "high" | "medium" | "low" {
  if (kind !== "item" && kind !== "discount") return "medium";
  if (!desc || desc.length < 2) return "low";
  if (price === 0 && kind === "item") return "low";
  const letters = (desc.match(/[A-Za-z]/g) || []).length;
  if (letters < desc.length * 0.4) return "low";
  if (desc.length >= 4 && Number.isFinite(price)) return "high";
  return "medium";
}

function parseOneLine(rawLine: string): ParsedReceiptLine | null {
  const line = rawLine.replace(/\s+/g, " ").trim();
  if (!line || line.length < 2) return null;
  if (/^[-=_*]{3,}$/.test(line)) return null;

  const priceMatch = line.match(PRICE_TAIL_RE);
  if (!priceMatch) return null;
  const price = parseMoney(priceMatch[1]);
  if (price === null) return null;

  let desc = line.slice(0, priceMatch.index).trim();
  desc = desc.replace(/\s+[A-Z]$/i, "").trim();

  let qty = 1;
  const qtyAt = desc.match(QTY_AT_RE);
  if (qtyAt) {
    qty = Number(qtyAt[1]) || 1;
    desc = desc.slice(qtyAt[0].length).trim();
  } else {
    const qtyPref = desc.match(QTY_PREFIX_RE);
    if (qtyPref && Number(qtyPref[1]) <= 48 && !/^\d{4,}/.test(desc)) {
      const rest = desc.slice(qtyPref[0].length);
      if (/^[A-Za-z]/.test(rest)) {
        qty = Number(qtyPref[1]) || 1;
        desc = rest.trim();
      }
    }
  }

  desc = desc.replace(/^\d{6,}\s+/, "").trim();
  if (!desc) desc = "Item";

  if (
    SKIP_RE.test(desc) &&
    !TAX_RE.test(desc) &&
    !TOTAL_RE.test(desc) &&
    !DISCOUNT_RE.test(desc) &&
    !SUBTOTAL_RE.test(desc)
  ) {
    return null;
  }

  const kind = classifyLine(desc, price);
  let discountAmount: number | null = null;
  const listPrice: number | null = null;
  let finalPrice = price;

  if (kind === "discount") {
    discountAmount = Math.abs(price);
    finalPrice = -Math.abs(price);
  }

  return {
    raw: rawLine,
    description: desc,
    qty: kind === "item" ? qty : 1,
    price: finalPrice,
    listPrice,
    discountAmount,
    kind,
    confidence: lineConfidence(desc, finalPrice, kind),
  };
}

/** Parse OCR text into structured receipt fields. */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split(/\r?\n/);
  const parsed: ParsedReceiptLine[] = [];
  let tax: number | null = null;
  let subtotal: number | null = null;
  let total: number | null = null;

  for (const raw of lines) {
    const pl = parseOneLine(raw);
    if (!pl) continue;
    if (pl.kind === "tax") {
      tax = Math.abs(pl.price);
      continue;
    }
    if (pl.kind === "subtotal") {
      subtotal = Math.abs(pl.price);
      continue;
    }
    if (pl.kind === "total") {
      total = Math.abs(pl.price);
      continue;
    }
    if (pl.kind === "payment") continue;
    parsed.push(pl);
  }

  const merged: ParsedReceiptLine[] = [];
  for (const pl of parsed) {
    if (pl.kind === "discount" && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.kind === "item") {
        const off = Math.abs(pl.discountAmount ?? pl.price);
        prev.discountAmount = (prev.discountAmount ?? 0) + off;
        prev.listPrice =
          prev.listPrice ?? Math.round((prev.price + off) * 100) / 100;
        prev.price = Math.round((prev.price - off) * 100) / 100;
        continue;
      }
    }
    merged.push(pl);
  }

  return {
    vendor: detectVendor(rawText),
    date: normalizeDate(rawText),
    lines: merged,
    tax,
    subtotal,
    total,
    rawText,
  };
}

export type MatchSuggestion = {
  itemId: string | null;
  itemName: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  candidates: { id: string; name: string; score: number }[];
};

/** Fuzzy-match a line description to inventory using chatbot scoreMatch. */
export function matchLineToInventory(
  description: string,
  activeItems: InventoryItem[],
  limit = 6
): MatchSuggestion {
  const matches = findMatches(description, activeItems, limit);
  if (matches.length === 0) {
    return {
      itemId: null,
      itemName: null,
      score: 0,
      confidence: "low",
      candidates: [],
    };
  }
  const best = matches[0];
  let confidence: "high" | "medium" | "low" = "low";
  if (best.score >= 75) confidence = "high";
  else if (best.score >= 45) confidence = "medium";
  const autoSelect = best.score >= 40;
  return {
    itemId: autoSelect ? best.item.id : null,
    itemName: autoSelect ? best.item.name : null,
    score: best.score,
    confidence,
    candidates: matches.map((m) => ({
      id: m.item.id,
      name: m.item.name,
      score: m.score,
    })),
  };
}

export function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Sum of item line prices for totals check. */
export function sumItemPrices(
  lines: { price: number; kind?: string }[]
): number {
  return (
    Math.round(
      lines
        .filter((l) => !l.kind || l.kind === "item" || l.kind === "discount")
        .reduce((s, l) => s + l.price, 0) * 100
    ) / 100
  );
}
