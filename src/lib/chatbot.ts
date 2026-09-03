import type { InventoryItem } from "./types";
import { FOLDERS } from "./types";
import { formatQty, isLowStock } from "./utils";

export type ChatAction =
  | { type: "setQuantity"; itemId: string; quantity: number }
  | { type: "adjustQuantity"; itemId: string; delta: number }
  | { type: "markRestocked"; itemId: string };

export type ChatMatch = { item: InventoryItem; score: number };

export type ChatResult = {
  reply: string;
  action?: ChatAction;
  /** Ambiguous matches for UI chips */
  candidates?: InventoryItem[];
};

export type ChatContext = {
  activeItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  needsCountItems: InventoryItem[];
};

const WORD_NUM: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

/** Lowercase, strip punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function parseNumber(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (WORD_NUM[t] !== undefined) return WORD_NUM[t];
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Score how well query matches an item name (higher = better). */
export function scoreMatch(query: string, itemName: string): number {
  const q = normalize(query);
  const name = normalize(itemName);
  if (!q || !name) return 0;
  if (q === name) return 100;

  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = name.split(" ").filter(Boolean);
  if (qTokens.length === 0) return 0;

  // All query tokens found as substrings of name
  let matched = 0;
  let exactToken = 0;
  for (const qt of qTokens) {
    if (nTokens.some((nt) => nt === qt)) {
      matched++;
      exactToken++;
    } else if (name.includes(qt) || nTokens.some((nt) => nt.startsWith(qt) || qt.startsWith(nt))) {
      matched++;
    }
  }
  if (matched < qTokens.length) {
    // Allow if majority of tokens match and at least one
    if (matched === 0) return 0;
    if (matched < Math.ceil(qTokens.length * 0.6)) return 0;
  }

  let score = 40 + (matched / qTokens.length) * 30 + (exactToken / qTokens.length) * 20;

  // Prefer shorter names (more specific)
  if (name.startsWith(q) || name.includes(` ${q}`)) score += 8;
  if (name.includes(q)) score += 5;
  score -= Math.min(10, Math.abs(nTokens.length - qTokens.length));

  // Bonus if all tokens exact
  if (exactToken === qTokens.length && qTokens.length === nTokens.length) score = 95;

  return Math.min(99, Math.round(score));
}

export function findMatches(query: string, items: InventoryItem[], limit = 8): ChatMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const scored = items
    .map((item) => ({ item, score: scoreMatch(q, item.name) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit);
}

function describeItem(item: InventoryItem): string {
  const low = isLowStock(item);
  const min =
    item.minLevel !== null && item.minLevel !== undefined
      ? ` · min ${formatQty(item.minLevel)}`
      : "";
  const flag = low ? " · low" : "";
  return `${item.name}: ${formatQty(item.quantity)} ${item.unit} (${item.folder}${min}${flag})`;
}

function resolveItem(
  nameQuery: string,
  items: InventoryItem[]
): { item?: InventoryItem; reply?: string; candidates?: InventoryItem[] } {
  const matches = findMatches(nameQuery, items);
  if (matches.length === 0) {
    // Suggest closest by loose token overlap
    const loose = items
      .map((item) => {
        const nTok = tokens(item.name);
        const qTok = tokens(nameQuery);
        const hit = qTok.filter((t) => nTok.some((n) => n.includes(t) || t.includes(n))).length;
        return { item, hit };
      })
      .filter((x) => x.hit > 0)
      .sort((a, b) => b.hit - a.hit)
      .slice(0, 3);
    if (loose.length) {
      return {
        reply: `Couldn't find “${nameQuery.trim()}”. Closest: ${loose
          .map((l) => l.item.name)
          .join(", ")}. Try another name?`,
      };
    }
    return { reply: `Couldn't find “${nameQuery.trim()}”. Try a different name or say “help”.` };
  }

  const top = matches[0];
  const close = matches.filter((m) => m.score >= top.score - 12 && m.score >= 50);
  // Ambiguous if multiple strong matches and not a clear winner
  if (
    matches.length > 1 &&
    top.score < 95 &&
    matches[1].score >= top.score - 8 &&
    matches[1].score >= 45
  ) {
    const cands = matches.slice(0, 3).map((m) => m.item);
    return {
      reply: `Which one?\n${cands.map((c, i) => `${i + 1}. ${c.name} (${c.folder})`).join("\n")}`,
      candidates: cands,
    };
  }

  // Also ambiguous if several medium matches
  if (close.length > 1 && top.score < 85) {
    const cands = close.slice(0, 3).map((m) => m.item);
    return {
      reply: `Which one?\n${cands.map((c, i) => `${i + 1}. ${c.name} (${c.folder})`).join("\n")}`,
      candidates: cands,
    };
  }

  return { item: top.item };
}

function matchFolder(text: string): string | null {
  const n = normalize(text);
  for (const f of FOLDERS) {
    if (normalize(f) === n) return f;
  }
  for (const f of FOLDERS) {
    const fn = normalize(f);
    if (n.includes(fn) || fn.includes(n)) return f;
  }
  return null;
}

function helpReply(): string {
  return [
    "I'm your on-device inventory buddy. Try:",
    "• Do I have toilet paper?",
    "• What's low?",
    "• Bathroom status",
    "• Set detergent pods to 2",
    "• Use 1 paper towels",
    "• Add 2 to dish soap",
    "• Mark toilet paper restocked",
    "• What needs counting?",
    "• Find gloves",
  ].join("\n");
}

function lowStockReply(items: InventoryItem[]): string {
  if (items.length === 0) return "Nice — nothing is low right now.";
  const cap = 15;
  const list = items.slice(0, cap);
  const byFolder = new Map<string, InventoryItem[]>();
  for (const i of list) {
    const arr = byFolder.get(i.folder) ?? [];
    arr.push(i);
    byFolder.set(i.folder, arr);
  }
  const lines: string[] = [`${items.length} low item${items.length === 1 ? "" : "s"}:`];
  for (const [folder, group] of [...byFolder.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`\n${folder}`);
    for (const i of group) {
      lines.push(
        `· ${i.name}: ${formatQty(i.quantity)} ${i.unit} (min ${formatQty(i.minLevel ?? 0)})`
      );
    }
  }
  if (items.length > cap) lines.push(`\n…and ${items.length - cap} more.`);
  return lines.join("\n");
}

function needsCountReply(items: InventoryItem[]): string {
  if (items.length === 0) return "Everything that needs a min has been counted. You're good.";
  const cap = 15;
  const list = items.slice(0, cap);
  const lines = [`${items.length} need counting:`];
  for (const i of list) {
    lines.push(`· ${i.name} (${i.folder}) — ${formatQty(i.quantity)} ${i.unit}`);
  }
  if (items.length > cap) lines.push(`…and ${items.length - cap} more.`);
  return lines.join("\n");
}

function folderStatusReply(folder: string, items: InventoryItem[]): string {
  const inFolder = items.filter((i) => normalize(i.folder) === normalize(folder));
  if (inFolder.length === 0) return `No items in ${folder}.`;
  const low = inFolder.filter(isLowStock);
  const lines = [
    `${folder}: ${inFolder.length} item${inFolder.length === 1 ? "" : "s"}, ${low.length} low.`,
  ];
  const show = inFolder.slice(0, 20);
  for (const i of show) {
    const flag = isLowStock(i) ? " ⚠ low" : "";
    lines.push(`· ${i.name}: ${formatQty(i.quantity)} ${i.unit}${flag}`);
  }
  if (inFolder.length > 20) lines.push(`…and ${inFolder.length - 20} more.`);
  return lines.join("\n");
}

/**
 * Parse a user message against inventory. Pure — no side effects.
 * Caller applies `action` via useInventory hooks.
 */
export function handleChatMessage(raw: string, ctx: ChatContext): ChatResult {
  const text = raw.trim();
  if (!text) return { reply: "Say something — or tap a suggestion." };

  const n = normalize(text);
  const { activeItems, lowStockItems, needsCountItems } = ctx;

  // Help
  if (
    /^(help|commands|\?|what can you do|how does this work)$/i.test(n) ||
    n === "hi" ||
    n === "hello"
  ) {
    return { reply: helpReply() };
  }

  // Low stock
  if (
    /^(what s low|whats low|what is low|low stock|whats running low|what do i need|what needs restock|running low|low items|show low)$/i.test(
      n
    ) ||
    /^(what('?s| is) low|low stock|what do i need|running low)/i.test(n)
  ) {
    return { reply: lowStockReply(lowStockItems) };
  }

  // Needs count
  if (
    /need(s)? count|uncounted|to count|what needs counting|items to count/.test(n)
  ) {
    return { reply: needsCountReply(needsCountItems) };
  }

  // Folder status: "Bathroom status", "what's in Kitchen", "status of Laundry"
  {
    const m1 = n.match(/^(.+?)\s+status$/);
    const m2 = n.match(/^(?:what s in|whats in|what is in|status of|show)\s+(.+)$/);
    const folderRaw = m1?.[1] ?? m2?.[1];
    if (folderRaw) {
      const folder = matchFolder(folderRaw);
      if (folder) return { reply: folderStatusReply(folder, activeItems) };
    }
  }

  // Set quantity: "set X to N", "X is N", "I have N X"
  {
    const setMatch =
      text.match(/^set\s+(.+?)\s+to\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i) ||
      text.match(
        /^(?:i\s+have|i've got|ive got|got)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i
      );

    if (setMatch) {
      // Distinguish "set X to N" vs "I have N X"
      const isHaveForm = /^(?:i\s+have|i've got|ive got|got)/i.test(text);
      const qtyStr = isHaveForm ? setMatch[1] : setMatch[2];
      const nameQ = isHaveForm ? setMatch[2] : setMatch[1];
      const qty = parseNumber(qtyStr);
      if (qty !== null) {
        const resolved = resolveItem(nameQ, activeItems);
        if (resolved.reply && !resolved.item)
          return { reply: resolved.reply, candidates: resolved.candidates };
        if (resolved.item) {
          return {
            reply: `Got it — ${resolved.item.name} is now ${formatQty(qty)} ${resolved.item.unit}.`,
            action: { type: "setQuantity", itemId: resolved.item.id, quantity: qty },
          };
        }
      }
    }

    // "X is N" / "X = N"
    const isMatch = text.match(
      /^(.+?)\s+(?:is|=)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i
    );
    if (isMatch && !/^(what|how|who|where|why|do|does|is there)/i.test(isMatch[1])) {
      const qty = parseNumber(isMatch[2]);
      if (qty !== null) {
        const resolved = resolveItem(isMatch[1], activeItems);
        if (resolved.reply && !resolved.item)
          return { reply: resolved.reply, candidates: resolved.candidates };
        if (resolved.item) {
          return {
            reply: `Updated — ${resolved.item.name} set to ${formatQty(qty)} ${resolved.item.unit}.`,
            action: { type: "setQuantity", itemId: resolved.item.id, quantity: qty },
          };
        }
      }
    }
  }

  // Add: "add N to X", "add N X"
  {
    const addMatch = text.match(
      /^add\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:to\s+|more\s+)?(.+)$/i
    );
    if (addMatch) {
      const qty = parseNumber(addMatch[1]);
      if (qty !== null) {
        const resolved = resolveItem(addMatch[2], activeItems);
        if (resolved.reply && !resolved.item)
          return { reply: resolved.reply, candidates: resolved.candidates };
        if (resolved.item) {
          const next = Math.max(0, resolved.item.quantity + qty);
          return {
            reply: `Added ${formatQty(qty)} — ${resolved.item.name} is now ${formatQty(next)} ${resolved.item.unit}.`,
            action: { type: "adjustQuantity", itemId: resolved.item.id, delta: qty },
          };
        }
      }
    }
  }

  // Use: "use N X", "used one X", "use X" (default 1)
  {
    const useMatch =
      text.match(
        /^(?:use|used|using)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+)?(.+)$/i
      ) || text.match(/^(?:use|used|using)\s+(.+)$/i);
    if (useMatch) {
      let qty = 1;
      let nameQ: string;
      if (useMatch[2] !== undefined) {
        const parsed = parseNumber(useMatch[1]);
        if (parsed === null) {
          nameQ = `${useMatch[1]} ${useMatch[2]}`.trim();
        } else {
          qty = parsed;
          nameQ = useMatch[2];
        }
      } else {
        nameQ = useMatch[1];
      }
      const resolved = resolveItem(nameQ, activeItems);
      if (resolved.reply && !resolved.item)
        return { reply: resolved.reply, candidates: resolved.candidates };
      if (resolved.item) {
        const next = Math.max(0, resolved.item.quantity - qty);
        return {
          reply: `Used ${formatQty(qty)} — ${resolved.item.name} now ${formatQty(next)} ${resolved.item.unit}.`,
          action: { type: "adjustQuantity", itemId: resolved.item.id, delta: -qty },
        };
      }
    }
  }

  // Restock: "mark X restocked", "bought X", "restocked X"
  {
    const restockMatch =
      text.match(/^(?:mark\s+)?(.+?)\s+(?:as\s+)?restocked$/i) ||
      text.match(/^(?:bought|restock(?:ed)?)\s+(.+)$/i) ||
      text.match(/^mark\s+(.+?)\s+restocked$/i);
    if (restockMatch) {
      const resolved = resolveItem(restockMatch[1], activeItems);
      if (resolved.reply && !resolved.item)
        return { reply: resolved.reply, candidates: resolved.candidates };
      if (resolved.item) {
        return {
          reply: `Marked ${resolved.item.name} restocked. Nice catch-up.`,
          action: { type: "markRestocked", itemId: resolved.item.id },
        };
      }
    }
  }

  // Search / find
  {
    const findMatch = text.match(
      /^(?:find|search|items?\s+(?:with|named|like|containing)|list|show)\s+(.+)$/i
    );
    if (findMatch) {
      // If it's a folder, treat as folder status
      const folder = matchFolder(findMatch[1]);
      if (folder && /^(list|show)\s+/i.test(text)) {
        return { reply: folderStatusReply(folder, activeItems) };
      }
      const matches = findMatches(findMatch[1], activeItems, 10);
      if (matches.length === 0) {
        return { reply: `No items matching “${findMatch[1].trim()}”.` };
      }
      const lines = [`Found ${matches.length}:`];
      for (const m of matches) {
        lines.push(`· ${describeItem(m.item)}`);
      }
      return { reply: lines.join("\n"), candidates: matches.slice(0, 3).map((m) => m.item) };
    }
  }

  // Query quantity: "do I have X", "how many X", "status of X"
  {
    const qMatch =
      text.match(
        /^(?:do\s+i\s+have|have\s+i\s+got|how\s+many|how\s+much|status\s+of|qty\s+(?:of|for)|quantity\s+(?:of|for)|check|what(?:'?s|\s+is)\s+(?:my|the)\s+(?:count|stock|qty|quantity)\s+(?:of|for))\s+(.+?)\??$/i
      ) ||
      text.match(/^(?:do\s+i\s+have|got\s+any)\s+(.+?)\??$/i);
    if (qMatch) {
      let nameQ = qMatch[1].replace(/\?+$/, "").trim();
      // strip trailing "left" / "in stock"
      nameQ = nameQ.replace(/\s+(left|in stock|available)$/i, "").trim();
      const resolved = resolveItem(nameQ, activeItems);
      if (resolved.reply && !resolved.item)
        return { reply: resolved.reply, candidates: resolved.candidates };
      if (resolved.item) {
        const i = resolved.item;
        const low = isLowStock(i);
        const minBit =
          i.minLevel !== null && i.minLevel !== undefined
            ? ` Min is ${formatQty(i.minLevel)}.`
            : "";
        const lowBit = low ? " That's low." : " Looking fine.";
        return {
          reply: `You have ${formatQty(i.quantity)} ${i.unit} of ${i.name} (${i.folder}).${minBit}${lowBit}`,
        };
      }
    }
  }

  // Bare item name → treat as query
  {
    const matches = findMatches(text, activeItems, 5);
    if (matches.length === 1 && matches[0].score >= 60) {
      const i = matches[0].item;
      const low = isLowStock(i);
      return {
        reply: `${i.name}: ${formatQty(i.quantity)} ${i.unit} in ${i.folder}${
          low ? " — low" : ""
        }.`,
      };
    }
    if (matches.length > 1 && matches[0].score >= 50) {
      const cands = matches.slice(0, 3).map((m) => m.item);
      return {
        reply: `Which one?\n${cands.map((c, i) => `${i + 1}. ${c.name} (${c.folder})`).join("\n")}`,
        candidates: cands,
      };
    }
  }

  return {
    reply:
      "Not sure I caught that. Try “help”, “what's low?”, or “do I have toilet paper?”",
  };
}

export const SUGGESTION_CHIPS = [
  "What's low?",
  "Bathroom status",
  "Do I have toilet paper?",
  "Set detergent pods to 2",
  "Use 1 paper towels",
] as const;
