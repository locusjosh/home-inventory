import type { InventoryItem } from "./types";
import { STOCK_FOLDERS, SUGGESTED_FOLDER } from "./types";
import { formatQty, isLowStock, isSuggested } from "./utils";

export type ChatAction =
  | { type: "setQuantity"; itemId: string; quantity: number }
  | { type: "adjustQuantity"; itemId: string; delta: number }
  | { type: "markRestocked"; itemId: string }
  | {
      type: "logPurchase";
      itemId: string;
      qty: number;
      pricePaid: number;
      listPrice?: number | null;
      discountPercent?: number | null;
      discountAmount?: number | null;
      promoNotes?: string | null;
      vendor?: string | null;
      alsoRestock?: boolean;
    };

export type ChatMatch = { item: InventoryItem; score: number };

export type ChatResult = {
  reply: string;
  /** Shorter text for TTS when reply is a long list */
  speakText?: string;
  action?: ChatAction;
  /** Ambiguous matches for UI chips */
  candidates?: InventoryItem[];
};

export type ChatContext = {
  /** Stock items only (excludes Suggested Items). Default search scope. */
  myItems: InventoryItem[];
  /** Wishlist / Suggested Items. Included when user asks about ideas/wishlist. */
  ideaItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  needsCountItems: InventoryItem[];
  /** Candidates from last "which one?" turn */
  pendingCandidates?: InventoryItem[];
  /** Last assistant message (for follow-up resolution) */
  lastAssistantText?: string;
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

/** Common household synonyms → search expansion tokens / preferred names */
const SYNONYMS: Record<string, string[]> = {
  tp: ["toilet paper"],
  "toilet paper": ["toilet paper", "bath tissue"],
  "paper towel": ["paper towels"],
  "paper towels": ["paper towels"],
  wipes: ["clorox wipes", "wipes"],
  wipe: ["clorox wipes", "wipes"],
  pods: ["detergent pods", "dishwasher pods"],
  "detergent pods": ["detergent pods"],
  detergent: ["detergent pods", "floor detergent"],
  "trash bags": ["trash bags", "kitchen trash bags", "black trash bags"],
  "trash bag": ["trash bags", "kitchen trash bags", "black trash bags"],
  "garbage bags": ["trash bags", "kitchen trash bags", "black trash bags"],
  "dish soap": ["dish soap"],
  "dish soap liquid": ["dish soap"],
  soap: ["dish soap", "hand soap", "body wash"],
  gloves: ["latex gloves"],
  "latex gloves": ["latex gloves"],
  filters: ["air filters", "fridge air filter", "freezer air filter", "ice machine filter", "roborock filters", "coffee machine filters"],
  filter: ["air filters", "fridge air filter", "freezer air filter"],
  "air filter": ["air filters", "fridge air filter", "freezer air filter"],
  bags: ["gallon bags", "quart bags", "sandwich bags", "trash bags"],
  ziploc: ["gallon bags", "quart bags", "sandwich bags"],
  "zip lock": ["gallon bags", "quart bags", "sandwich bags"],
  foil: ["foil paper"],
  "aluminum foil": ["foil paper"],
  qtips: ["qtips"],
  "q tips": ["qtips"],
  "cotton swabs": ["qtips"],
  clorox: ["clorox", "clorox spray", "clorox wipes"],
  "clorax": ["clorox", "clorox spray", "clorox wipes"],
  bleach: ["clorox"],
  windex: ["windex spray"],
  glass: ["windex spray"],
  "pine sol": ["fabuloso/pinesol"],
  pinesol: ["fabuloso/pinesol"],
  fabuloso: ["fabuloso/pinesol"],
  "first aid": ["first aid kit", "bandages"],
  bandaids: ["bandages"],
  "band aids": ["bandages"],
  peroxide: ["hydrogen peroxide"],
  "rubbing alcohol": ["rubbing alcohol"],
  isopropyl: ["rubbing alcohol"],
  hangers: ["clothes hangers"],
  "dryer sheets": ["dryer sheets"],
  "fabric softener": ["fabric softener"],
  "scent beads": ["scent booster beads"],
  "scent booster": ["scent booster beads"],
  litter: ["cat litter"],
  "dog food": ["dog food"],
  toothpaste: ["toothpaste"],
  "coffee cups": ["coffee cups"],
  "paper plates": ["disposable plates"],
  "plastic cups": ["disposable cups"],
  "plastic forks": ["disposable forks"],
  "plastic spoons": ["disposable spoons"],
  plungers: ["plunger"],
  "wd40": ["wd-40"],
  "wd 40": ["wd-40"],
  batteries: ["batteries aa", "batteries aaa"],
  "aa batteries": ["batteries aa"],
  "aaa batteries": ["batteries aaa"],
  napkins: ["paper napkins"],
  "plastic wrap": ["plastic wrap"],
  saran: ["plastic wrap"],
  parchment: ["parchment paper"],
  shampoo: ["shampoo"],
  conditioner: ["conditioner"],
  deodorant: ["deodorant"],
  sunscreen: ["sunscreen"],
  sponges: ["sponges"],
  "hand soap": ["hand soap"],
  "body wash": ["body wash"],
  floss: ["floss"],
  mouthwash: ["mouthwash"],
};

/** Category-ish queries that should return multiple items */
const CATEGORY_QUERIES: Record<string, (item: InventoryItem) => boolean> = {
  filters: (i) => /filter/i.test(i.name),
  gloves: (i) => /glove/i.test(i.name),
  bags: (i) => /bags?/i.test(i.name),
  "trash bags": (i) => /trash bag/i.test(i.name),
  batteries: (i) => /batter/i.test(i.name),
  cups: (i) => /cups?/i.test(i.name),
  disposable: (i) => /disposable/i.test(i.name),
  clorox: (i) => /clorox/i.test(i.name),
  sprays: (i) => /spray/i.test(i.name),
  spray: (i) => /spray/i.test(i.name),
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

/** Classic Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[cols - 1];
}

function expandQuery(query: string): string[] {
  const n = normalize(query);
  const expansions = new Set<string>([n]);
  if (SYNONYMS[n]) {
    for (const s of SYNONYMS[n]) expansions.add(normalize(s));
  }
  // Also expand individual tokens
  for (const tok of tokens(n)) {
    if (SYNONYMS[tok]) {
      for (const s of SYNONYMS[tok]) expansions.add(normalize(s));
    }
  }
  // Multi-word synonym keys contained in query
  for (const [key, vals] of Object.entries(SYNONYMS)) {
    if (key.includes(" ") && n.includes(key)) {
      for (const s of vals) expansions.add(normalize(s));
    }
  }
  return [...expansions];
}

function aliasBonus(query: string, item: InventoryItem): number {
  const q = normalize(query);
  let bonus = 0;
  const notes = item.notes ? normalize(item.notes) : "";
  const vendor = item.vendor ? normalize(item.vendor) : "";
  if (notes && (notes.includes(q) || tokens(q).every((t) => notes.includes(t)))) {
    bonus += 8;
  }
  if (vendor && (vendor === q || vendor.includes(q))) {
    bonus += 4;
  }
  // Light token hit from notes/vendor
  for (const t of tokens(q)) {
    if (t.length < 3) continue;
    if (notes.includes(t)) bonus += 2;
    if (vendor.includes(t)) bonus += 1;
  }
  return Math.min(12, bonus);
}

function typoBonus(qToken: string, nameToken: string): number {
  if (qToken === nameToken) return 0;
  const maxLen = Math.max(qToken.length, nameToken.length);
  if (maxLen < 3) return 0;
  const dist = levenshtein(qToken, nameToken);
  // Allow ~1 edit per 4 chars, max 2 for short words
  const allowed = maxLen <= 4 ? 1 : maxLen <= 8 ? 2 : 3;
  if (dist === 0) return 0;
  if (dist > allowed) return 0;
  // clorax→clorox style
  return Math.max(0, 12 - dist * 4);
}

/** Score how well query matches an item (higher = better). */
export function scoreMatch(query: string, item: InventoryItem): number {
  const expansions = expandQuery(query);
  let best = 0;
  for (const q of expansions) {
    best = Math.max(best, scoreMatchCore(q, item));
  }
  // Prefer active non-Suggested when scores would be close — applied later in ranking
  return best;
}

function scoreMatchCore(q: string, item: InventoryItem): number {
  const name = normalize(item.name);
  if (!q || !name) return 0;
  if (q === name) return 100 + aliasBonus(q, item);

  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = name.split(" ").filter(Boolean);
  if (qTokens.length === 0) return 0;

  let matched = 0;
  let exactToken = 0;
  let typoPts = 0;
  for (const qt of qTokens) {
    if (nTokens.some((nt) => nt === qt)) {
      matched++;
      exactToken++;
      continue;
    }
    // typo / edit-distance against name tokens
    let bestTypo = 0;
    for (const nt of nTokens) {
      bestTypo = Math.max(bestTypo, typoBonus(qt, nt));
    }
    if (bestTypo > 0) {
      matched++;
      typoPts += bestTypo;
      continue;
    }
    if (name.includes(qt) || nTokens.some((nt) => nt.startsWith(qt) || qt.startsWith(nt))) {
      matched++;
    }
  }

  if (matched < qTokens.length) {
    if (matched === 0) {
      // Whole-string fuzzy for short queries (e.g. clorax vs clorox)
      const dist = levenshtein(q, name);
      const maxLen = Math.max(q.length, name.length);
      if (maxLen >= 4 && dist <= Math.ceil(maxLen * 0.3) && dist <= 3) {
        return Math.max(0, 70 - dist * 8) + aliasBonus(q, item);
      }
      return 0;
    }
    if (matched < Math.ceil(qTokens.length * 0.6)) return 0;
  }

  let score = 40 + (matched / qTokens.length) * 30 + (exactToken / qTokens.length) * 20;
  score += Math.min(15, typoPts);

  if (name.startsWith(q) || name.includes(` ${q}`)) score += 8;
  if (name.includes(q)) score += 5;
  score -= Math.min(10, Math.abs(nTokens.length - qTokens.length));

  if (exactToken === qTokens.length && qTokens.length === nTokens.length) score = 95;

  score += aliasBonus(q, item);

  return Math.min(99, Math.round(score));
}

export function findMatches(query: string, items: InventoryItem[], limit = 8): ChatMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const scored = items
    .map((item) => ({ item, score: scoreMatch(q, item) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => {
      // Prefer non-Suggested when scores close
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) <= 8) {
        const aSug = isSuggested(a.item) ? 1 : 0;
        const bSug = isSuggested(b.item) ? 1 : 0;
        if (aSug !== bSug) return aSug - bSug;
      }
      return scoreDiff || a.item.name.localeCompare(b.item.name);
    });
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
    const loose = items
      .map((item) => {
        const nTok = tokens(item.name);
        const qTok = tokens(nameQuery);
        const hit = qTok.filter((t) =>
          nTok.some((n) => n.includes(t) || t.includes(n) || typoBonus(t, n) > 0)
        ).length;
        return { item, hit };
      })
      .filter((x) => x.hit > 0)
      .sort((a, b) => {
        if (b.hit !== a.hit) return b.hit - a.hit;
        return (isSuggested(a.item) ? 1 : 0) - (isSuggested(b.item) ? 1 : 0);
      })
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

  if (
    matches.length > 1 &&
    top.score < 95 &&
    matches[1].score >= top.score - 8 &&
    matches[1].score >= 45
  ) {
    // Prefer unique non-Suggested winner if clearly better after folder bias
    const nonSug = matches.filter((m) => !isSuggested(m.item));
    if (nonSug.length === 1 && nonSug[0].score >= top.score - 5 && nonSug[0].score >= 55) {
      return { item: nonSug[0].item };
    }
    const cands = matches.slice(0, 3).map((m) => m.item);
    return {
      reply: `Which one?\n${cands.map((c, i) => `${i + 1}. ${c.name} (${c.folder})`).join("\n")}`,
      candidates: cands,
    };
  }

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
  const all = [...STOCK_FOLDERS, SUGGESTED_FOLDER];
  for (const f of all) {
    if (normalize(f) === n) return f;
  }
  // Also accept "ideas" / "wishlist" as Suggested Items
  if (/^(ideas?|wishlist|suggested)$/.test(n)) return SUGGESTED_FOLDER;
  for (const f of all) {
    const fn = normalize(f);
    if (n.includes(fn) || fn.includes(n)) return f;
  }
  return null;
}

function wantsIdeasQuery(n: string): boolean {
  return /\b(ideas?|wishlist|suggested|want to buy|on my list|sortly)\b/.test(n);
}

function helpReply(): string {
  return [
    "Inventory online — on-device only. Try:",
    "• Do I have toilet paper?",
    "• What's low? / What's critically low?",
    "• How's the house looking?",
    "• Bathroom status / Compare Kitchen and Bathroom",
    "• Set detergent pods to 2",
    "• Use 1 paper towels",
    "• Add 2 to dish soap",
    "• Mark toilet paper restocked",
    "• Bought toilet paper for 22.50 at Costco",
    "• Paid 15 for detergent pods with 33% off",
    "• What needs counting?",
    "• Find gloves / all filters",
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

function criticallyLowReply(items: InventoryItem[]): { reply: string; speakText: string } {
  const crit = items.filter(
    (i) =>
      i.quantity <= 0 &&
      i.minLevel !== null &&
      i.minLevel !== undefined &&
      i.minLevel > 0
  );
  if (crit.length === 0) {
    return {
      reply: "Nothing critically low — no items at zero with a min set.",
      speakText: "Nothing critically low.",
    };
  }
  const lines = [`${crit.length} critically low (qty 0 with min):`];
  for (const i of crit.slice(0, 20)) {
    lines.push(`· ${i.name}: 0 ${i.unit} (min ${formatQty(i.minLevel ?? 0)}) — ${i.folder}`);
  }
  if (crit.length > 20) lines.push(`…and ${crit.length - 20} more.`);
  return {
    reply: lines.join("\n"),
    speakText: `${crit.length} critically low. Top ones: ${crit
      .slice(0, 4)
      .map((i) => i.name)
      .join(", ")}.`,
  };
}

function houseSummaryReply(
  myItems: InventoryItem[],
  lowStockItems: InventoryItem[],
  needsCountItems: InventoryItem[]
): { reply: string; speakText: string } {
  const byFolder = new Map<string, { total: number; low: number }>();
  for (const i of myItems) {
    const cur = byFolder.get(i.folder) ?? { total: 0, low: 0 };
    cur.total++;
    if (isLowStock(i)) cur.low++;
    byFolder.set(i.folder, cur);
  }
  const lines = [
    `House check: ${myItems.length} active items, ${lowStockItems.length} low, ${needsCountItems.length} need counting.`,
  ];
  for (const [folder, s] of [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`· ${folder}: ${s.total} items, ${s.low} low`);
  }
  const reply = lines.join("\n");
  const speakText = `House looking ${
    lowStockItems.length === 0 ? "good" : "a bit thin"
  }: ${lowStockItems.length} low, ${needsCountItems.length} need counting.`;
  return { reply, speakText };
}

function compareFoldersReply(a: string, b: string, items: InventoryItem[]): string {
  const summary = (folder: string) => {
    const inFolder = items.filter((i) => normalize(i.folder) === normalize(folder));
    const low = inFolder.filter(isLowStock);
    return { count: inFolder.length, low: low.length, lowNames: low.slice(0, 5).map((i) => i.name) };
  };
  const sa = summary(a);
  const sb = summary(b);
  const lines = [
    `Compare ${a} vs ${b}:`,
    `· ${a}: ${sa.count} items, ${sa.low} low${sa.lowNames.length ? ` (${sa.lowNames.join(", ")})` : ""}`,
    `· ${b}: ${sb.count} items, ${sb.low} low${sb.lowNames.length ? ` (${sb.lowNames.join(", ")})` : ""}`,
  ];
  if (sa.low === sb.low) lines.push("Same low count.");
  else if (sa.low > sb.low) lines.push(`${a} needs more attention.`);
  else lines.push(`${b} needs more attention.`);
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

function multiItemReply(label: string, found: InventoryItem[]): ChatResult {
  if (found.length === 0) return { reply: `No ${label} found.` };
  const lines = [`${found.length} ${label}:`];
  for (const i of found.slice(0, 15)) {
    lines.push(`· ${describeItem(i)}`);
  }
  if (found.length > 15) lines.push(`…and ${found.length - 15} more.`);
  return {
    reply: lines.join("\n"),
    speakText: `${found.length} ${label}. ${found
      .slice(0, 4)
      .map((i) => `${i.name}: ${formatQty(i.quantity)}`)
      .join(". ")}.`,
    candidates: found.slice(0, 5),
  };
}

/** Resolve follow-up like "the large", "2", "kitchen one" against pending candidates. */
function resolveFollowUp(
  text: string,
  candidates: InventoryItem[],
  lastAssistantText?: string
): InventoryItem | null {
  if (!candidates.length) return null;
  const askedWhich =
    !lastAssistantText ||
    /which one|did you mean|pick one|choose/i.test(lastAssistantText);
  if (!askedWhich && candidates.length > 1) {
    // Still allow numbered / folder pick if we have candidates
  }

  const n = normalize(text);

  // Pure number index
  const numOnly = n.match(/^(?:the\s+)?(?:number\s+)?(\d+)$/);
  if (numOnly) {
    const idx = Number(numOnly[1]) - 1;
    if (idx >= 0 && idx < candidates.length) return candidates[idx];
  }

  // "first" / "second" / "third"
  const ord: Record<string, number> = { first: 0, second: 1, third: 2, last: candidates.length - 1 };
  for (const [word, idx] of Object.entries(ord)) {
    if (n === word || n === `the ${word}` || n === `the ${word} one`) {
      if (idx >= 0 && idx < candidates.length) return candidates[idx];
    }
  }

  // Folder hint: "kitchen one", "the bathroom", "laundry"
  for (const c of candidates) {
    const folder = normalize(c.folder);
    if (
      n === folder ||
      n === `the ${folder}` ||
      n === `${folder} one` ||
      n === `the ${folder} one` ||
      n.includes(folder)
    ) {
      return c;
    }
  }

  // Size / attribute words in name: large, small, black, kitchen trash, etc.
  const sizeWords = tokens(n).filter(
    (t) => !["the", "one", "that", "this", "please", "item"].includes(t)
  );
  if (sizeWords.length) {
    const scored = candidates
      .map((c) => {
        const name = normalize(c.name);
        const hit = sizeWords.filter((w) => name.includes(w)).length;
        return { c, hit };
      })
      .filter((x) => x.hit > 0)
      .sort((a, b) => b.hit - a.hit);
    if (scored.length === 1 || (scored.length > 1 && scored[0].hit > scored[1].hit)) {
      return scored[0].c;
    }
    // Fuzzy name match within candidates
    const matches = findMatches(text.replace(/^(the|that|this)\s+/i, ""), candidates, 3);
    if (matches.length === 1 && matches[0].score >= 50) return matches[0].item;
    if (matches.length > 0 && matches[0].score >= 70) return matches[0].item;
  }

  return null;
}

const FOLLOWUP_QUESTIONS = [
  "Want me to mark anything restocked?",
  "Should we count Bathroom next?",
  "Need the critically low list?",
  "Want a folder status — Kitchen or Laundry?",
  "Shall I check what's low?",
];

function maybeProactiveFollowUp(reply: string, seed: string): string {
  // Occasional (~28%) — deterministic-ish from seed so same message isn't random every render
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  if (h % 100 > 28) return reply;
  // Don't stack if reply already asks a question ending
  if (/\?\s*$/.test(reply.trim())) return reply;
  // Skip for help / which-one / errors
  if (/^which one|^couldn|^not sure|^inventory online/i.test(reply.trim())) return reply;
  const q = FOLLOWUP_QUESTIONS[h % FOLLOWUP_QUESTIONS.length];
  return `${reply}\n\n${q}`;
}

/**
 * Parse a user message against inventory. Pure — no side effects.
 * Caller applies `action` via useInventory hooks.
 */
export function handleChatMessage(raw: string, ctx: ChatContext): ChatResult {
  const text = raw.trim();
  if (!text) return { reply: "Say something — or tap a suggestion." };

  if (/^log a purchase/i.test(text) || text === "Log a purchase…") {
    return {
      reply:
        "Say it like: “bought toilet paper for 22.50 at Costco” or “paid 15 for detergent pods with 33% off”. Or use Log purchase on the Restock list (2 taps: Log purchase → type price → Save).",
    };
  }

  const n = normalize(text);
  const { myItems, ideaItems, lowStockItems, needsCountItems, pendingCandidates, lastAssistantText } =
    ctx;

  const searchItems = wantsIdeasQuery(n) ? [...myItems, ...ideaItems] : myItems;

  // Conversational follow-up against pending candidates
  if (pendingCandidates && pendingCandidates.length > 0) {
    const picked = resolveFollowUp(text, pendingCandidates, lastAssistantText);
    if (picked) {
      const low = isLowStock(picked);
      const minBit =
        picked.minLevel !== null && picked.minLevel !== undefined
          ? ` Min ${formatQty(picked.minLevel)}.`
          : "";
      return {
        reply: maybeProactiveFollowUp(
          `${picked.name}: ${formatQty(picked.quantity)} ${picked.unit} in ${picked.folder}.${minBit}${
            low ? " That's low." : " Looking fine."
          }`,
          text + picked.id
        ),
      };
    }
    // "use 1" / "set to 2" style with pending — try to apply action to follow-up pick later via normal intents if they include a name
  }

  // Help / greeting
  if (
    /^(help|commands|\?|what can you do|how does this work)$/i.test(n) ||
    n === "hi" ||
    n === "hello" ||
    n === "hey jarvis" ||
    n === "jarvis"
  ) {
    return { reply: helpReply() };
  }

  // Ideas / wishlist browse
  if (
    /^(what('?s| is) on (my )?(wishlist|ideas?)|show (my )?(wishlist|ideas?|suggested)|list (my )?(wishlist|ideas?|suggested)|my (wishlist|ideas?))$/i.test(
      n
    ) ||
    /^(wishlist|ideas?|suggested items)$/i.test(n)
  ) {
    if (ideaItems.length === 0) {
      return { reply: "No wishlist ideas right now." };
    }
    const lines = [`${ideaItems.length} idea${ideaItems.length === 1 ? "" : "s"} (not in stock until you move them):`];
    for (const i of ideaItems.slice(0, 20)) {
      lines.push(`· ${i.name}`);
    }
    if (ideaItems.length > 20) lines.push(`…and ${ideaItems.length - 20} more.`);
    return {
      reply: lines.join("\n"),
      speakText: `${ideaItems.length} ideas on the wishlist.`,
      candidates: ideaItems.slice(0, 5),
    };
  }

  // House summary
  if (
    /how('?s| is) the house|house (looking|status|check|summary)|inventory summary|overview|status report/.test(
      n
    )
  ) {
    const r = houseSummaryReply(myItems, lowStockItems, needsCountItems);
    return {
      reply: maybeProactiveFollowUp(r.reply, text),
      speakText: r.speakText,
    };
  }

  // Critically low
  if (
    /critical(ly)? low|out of stock|what('?s| is) (at )?zero|qty 0|quantity zero|completely out/.test(
      n
    )
  ) {
    const r = criticallyLowReply(myItems);
    return { reply: maybeProactiveFollowUp(r.reply, text), speakText: r.speakText };
  }

  // Compare folders
  {
    const cmp = n.match(
      /compare\s+(.+?)\s+(?:and|vs|versus|with|to)\s+(.+)$/
    );
    if (cmp) {
      const fa = matchFolder(cmp[1]);
      const fb = matchFolder(cmp[2]);
      if (fa && fb) {
        return {
          reply: maybeProactiveFollowUp(compareFoldersReply(fa, fb, myItems), text),
        };
      }
    }
  }

  // Low stock
  if (
    /^(what s low|whats low|what is low|low stock|whats running low|what do i need|what needs restock|running low|low items|show low)$/i.test(
      n
    ) ||
    /^(what('?s| is) low|low stock|what do i need|running low)/i.test(n)
  ) {
    const reply = lowStockReply(lowStockItems);
    return {
      reply: maybeProactiveFollowUp(reply, text),
      speakText:
        lowStockItems.length === 0
          ? "Nothing is low."
          : `${lowStockItems.length} low. ${lowStockItems
              .slice(0, 4)
              .map((i) => i.name)
              .join(", ")}.`,
    };
  }

  // Needs count
  if (/need(s)? count|uncounted|to count|what needs counting|items to count/.test(n)) {
    const reply = needsCountReply(needsCountItems);
    return {
      reply: maybeProactiveFollowUp(reply, text),
      speakText:
        needsCountItems.length === 0
          ? "All counted."
          : `${needsCountItems.length} need counting.`,
    };
  }

  // Folder status: "Bathroom status", "what's in Kitchen", "status of Laundry"
  {
    const m1 = n.match(/^(.+?)\s+status$/);
    const m2 = n.match(/^(?:what s in|whats in|what is in|status of|show)\s+(.+)$/);
    const folderRaw = m1?.[1] ?? m2?.[1];
    if (folderRaw) {
      const folder = matchFolder(folderRaw);
      if (folder) {
        const scope = folder === SUGGESTED_FOLDER ? ideaItems : myItems;
        const reply = folderStatusReply(folder, scope);
        return {
          reply: maybeProactiveFollowUp(reply, text),
          speakText: (() => {
            const inFolder = scope.filter(
              (i) => normalize(i.folder) === normalize(folder)
            );
            const low = inFolder.filter(isLowStock).length;
            return `${folder}: ${inFolder.length} items, ${low} low.`;
          })(),
        };
      }
    }
  }

  // Multi-item category: "all filters", "gloves", "show bags"
  {
    const prefixed = n.match(/^(?:all|show|list|find)\s+(.+)$/);
    const catKey = prefixed ? normalize(prefixed[1]) : n;
    const pred = CATEGORY_QUERIES[catKey];
    if (pred) {
      const found = searchItems.filter(pred);
      if (prefixed || found.length > 1) {
        const result = multiItemReply(catKey, found);
        return {
          ...result,
          reply: maybeProactiveFollowUp(result.reply, text),
        };
      }
    }
  }

  // Set quantity: "set X to N", "X is N", "I have N X"
  {
    const setMatch =
      text.match(
        /^set\s+(.+?)\s+to\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i
      ) ||
      text.match(
        /^(?:i\s+have|i've got|ive got|got)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i
      );

    if (setMatch) {
      const isHaveForm = /^(?:i\s+have|i've got|ive got|got)/i.test(text);
      const qtyStr = isHaveForm ? setMatch[1] : setMatch[2];
      const nameQ = isHaveForm ? setMatch[2] : setMatch[1];
      const qty = parseNumber(qtyStr);
      if (qty !== null) {
        // Follow-up: "set to 2" with pending
        if (
          pendingCandidates?.length &&
          (!nameQ.trim() || /^(it|that|this|the one)$/i.test(nameQ.trim()))
        ) {
          const picked =
            resolveFollowUp(nameQ || "1", pendingCandidates, lastAssistantText) ||
            pendingCandidates[0];
          return {
            reply: `Got it — ${picked.name} is now ${formatQty(qty)} ${picked.unit}.`,
            action: { type: "setQuantity", itemId: picked.id, quantity: qty },
          };
        }
        const resolved = resolveItem(nameQ, searchItems);
        if (resolved.reply && !resolved.item)
          return { reply: resolved.reply, candidates: resolved.candidates };
        if (resolved.item) {
          return {
            reply: maybeProactiveFollowUp(
              `Got it — ${resolved.item.name} is now ${formatQty(qty)} ${resolved.item.unit}.`,
              text
            ),
            action: { type: "setQuantity", itemId: resolved.item.id, quantity: qty },
          };
        }
      }
    }

    const isMatch = text.match(
      /^(.+?)\s+(?:is|=)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*$/i
    );
    if (isMatch && !/^(what|how|who|where|why|do|does|is there)/i.test(isMatch[1])) {
      const qty = parseNumber(isMatch[2]);
      if (qty !== null) {
        const resolved = resolveItem(isMatch[1], searchItems);
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
        const nameQ = addMatch[2];
        let target: InventoryItem | undefined;
        if (pendingCandidates?.length && /^(it|that|this|the one)$/i.test(nameQ.trim())) {
          target = pendingCandidates[0];
        } else {
          const resolved = resolveItem(nameQ, searchItems);
          if (resolved.reply && !resolved.item)
            return { reply: resolved.reply, candidates: resolved.candidates };
          target = resolved.item;
        }
        if (target) {
          const next = Math.max(0, target.quantity + qty);
          return {
            reply: `Added ${formatQty(qty)} — ${target.name} is now ${formatQty(next)} ${target.unit}.`,
            action: { type: "adjustQuantity", itemId: target.id, delta: qty },
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
      let target: InventoryItem | undefined;
      if (pendingCandidates?.length && /^(it|that|this|the one)$/i.test(nameQ.trim())) {
        target = pendingCandidates[0];
      } else {
        const resolved = resolveItem(nameQ, searchItems);
        if (resolved.reply && !resolved.item)
          return { reply: resolved.reply, candidates: resolved.candidates };
        target = resolved.item;
      }
      if (target) {
        const next = Math.max(0, target.quantity - qty);
        return {
          reply: `Used ${formatQty(qty)} — ${target.name} now ${formatQty(next)} ${target.unit}.`,
          action: { type: "adjustQuantity", itemId: target.id, delta: -qty },
        };
      }
    }
  }


  // Purchase / paid: "bought X for 22.50 at Costco", "paid 15 for Y with 33% off"
  {
    let nameQ: string | null = null;
    let pricePaid: number | null = null;
    let vendor: string | null = null;
    let discountPercent: number | null = null;
    let promoNotes: string | null = null;
    let qty = 1;

    const paidFor = text.match(
      /^(?:paid|pay|spent)\s+\$?(\d+(?:\.\d{1,2})?)\s+(?:for|on)\s+(.+?)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%\s*off)?(?:\s+(?:at|from)\s+(.+))?$/i
    );
    const atBeforeFor = text.match(
      /^(?:bought|purchased|got)\s+(.+?)\s+(?:at|from)\s+(.+?)\s+for\s+\$?(\d+(?:\.\d{1,2})?)$/i
    );
    const forThenAt = text.match(
      /^(?:bought|purchased|got)\s+(.+?)\s+for\s+\$?(\d+(?:\.\d{1,2})?)(?:\s+with\s+(\d+(?:\.\d+)?)\s*%\s*off)?(?:\s+(?:at|from)\s+(.+))?$/i
    );

    if (paidFor) {
      pricePaid = Number(paidFor[1]);
      nameQ = paidFor[2].trim();
      if (paidFor[3]) {
        discountPercent = Number(paidFor[3]);
        promoNotes = `${paidFor[3]}% off`;
      }
      vendor = paidFor[4]?.trim() || null;
    } else if (atBeforeFor) {
      nameQ = atBeforeFor[1].trim();
      vendor = atBeforeFor[2].trim();
      pricePaid = Number(atBeforeFor[3]);
    } else if (forThenAt) {
      nameQ = forThenAt[1].trim();
      pricePaid = Number(forThenAt[2]);
      if (forThenAt[3]) {
        discountPercent = Number(forThenAt[3]);
        promoNotes = `${forThenAt[3]}% off`;
      }
      vendor = forThenAt[4]?.trim() || null;
    }

    if (nameQ) {
      const qtyPref = nameQ.match(
        /^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i
      );
      if (qtyPref) {
        const q = parseNumber(qtyPref[1]);
        if (q !== null && q > 0) {
          qty = q;
          nameQ = qtyPref[2];
        }
      }
      nameQ = nameQ.replace(/^(the|some)\s+/i, "").trim();
    }

    if (nameQ && pricePaid !== null && Number.isFinite(pricePaid)) {
      const resolved = resolveItem(nameQ, searchItems);
      if (resolved.reply && !resolved.item)
        return { reply: resolved.reply, candidates: resolved.candidates };
      if (resolved.item) {
        const unit = Math.round((pricePaid / qty) * 100) / 100;
        const vendorBit = vendor ? ` at ${vendor}` : "";
        const promoBit = discountPercent != null ? ` (${discountPercent}% off)` : "";
        return {
          reply: maybeProactiveFollowUp(
            `Logged purchase — ${resolved.item.name}: $${pricePaid.toFixed(2)} for ${formatQty(qty)} ${resolved.item.unit}${vendorBit}${promoBit} · $${unit.toFixed(2)}/${resolved.item.unit}. Qty restocked.`,
            text
          ),
          action: {
            type: "logPurchase",
            itemId: resolved.item.id,
            qty,
            pricePaid,
            discountPercent,
            promoNotes,
            vendor,
            alsoRestock: true,
          },
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
      const resolved = resolveItem(restockMatch[1], searchItems);
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
      const folder = matchFolder(findMatch[1]);
      if (folder && /^(list|show)\s+/i.test(text)) {
        return { reply: folderStatusReply(folder, searchItems) };
      }
      // Category under find
      const catKey = normalize(findMatch[1]);
      if (CATEGORY_QUERIES[catKey]) {
        const found = searchItems.filter(CATEGORY_QUERIES[catKey]);
        if (found.length > 0) {
          const result = multiItemReply(catKey, found);
          return { ...result, reply: maybeProactiveFollowUp(result.reply, text) };
        }
      }
      const matches = findMatches(findMatch[1], searchItems, 10);
      if (matches.length === 0) {
        return { reply: `No items matching “${findMatch[1].trim()}”.` };
      }
      const lines = [`Found ${matches.length}:`];
      for (const m of matches) {
        lines.push(`· ${describeItem(m.item)}`);
      }
      return {
        reply: maybeProactiveFollowUp(lines.join("\n"), text),
        speakText: `Found ${matches.length}. ${matches
          .slice(0, 4)
          .map((m) => m.item.name)
          .join(", ")}.`,
        candidates: matches.slice(0, 3).map((m) => m.item),
      };
    }
  }

  // Query quantity: "do I have X", "how many X", "status of X"
  {
    const qMatch =
      text.match(
        /^(?:do\s+i\s+have|have\s+i\s+got|how\s+many|how\s+much|status\s+of|qty\s+(?:of|for)|quantity\s+(?:of|for)|check|what(?:'?s|\s+is)\s+(?:my|the)\s+(?:count|stock|qty|quantity)\s+(?:of|for))\s+(.+?)\??$/i
      ) || text.match(/^(?:do\s+i\s+have|got\s+any)\s+(.+?)\??$/i);
    if (qMatch) {
      let nameQ = qMatch[1].replace(/\?+$/, "").trim();
      nameQ = nameQ.replace(/\s+(left|in stock|available)$/i, "").trim();

      // Category under "do I have filters"
      const catKey = normalize(nameQ);
      if (CATEGORY_QUERIES[catKey]) {
        const found = searchItems.filter(CATEGORY_QUERIES[catKey]);
        if (found.length > 1) {
          const result = multiItemReply(catKey, found);
          return { ...result, reply: maybeProactiveFollowUp(result.reply, text) };
        }
      }

      const resolved = resolveItem(nameQ, searchItems);
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
          reply: maybeProactiveFollowUp(
            `You have ${formatQty(i.quantity)} ${i.unit} of ${i.name} (${i.folder}).${minBit}${lowBit}`,
            text
          ),
        };
      }
    }
  }

  // Bare item name → treat as query (or category)
  {
    if (CATEGORY_QUERIES[n]) {
      const found = searchItems.filter(CATEGORY_QUERIES[n]);
      if (found.length > 1) {
        const result = multiItemReply(n, found);
        return { ...result, reply: maybeProactiveFollowUp(result.reply, text) };
      }
    }

    const matches = findMatches(text, searchItems, 5);
    if (matches.length === 1 && matches[0].score >= 55) {
      const i = matches[0].item;
      const low = isLowStock(i);
      return {
        reply: maybeProactiveFollowUp(
          `${i.name}: ${formatQty(i.quantity)} ${i.unit} in ${i.folder}${low ? " — low" : ""}.`,
          text
        ),
      };
    }
    if (matches.length > 1 && matches[0].score >= 50) {
      // If all match a clear category pattern and scores close, list them
      const close = matches.filter((m) => m.score >= matches[0].score - 15);
      if (close.length >= 3 && matches[0].score < 90) {
        return multiItemReply("matches", close.map((m) => m.item));
      }
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
  "How's the house looking?",
  "Bathroom status",
  "Do I have toilet paper?",
  "What's critically low?",
  "Log a purchase…",
  "Find gloves",
] as const;
