/**
 * Link buttons: sanitizer, data-plan fail-on-change check, normalizeItem shape,
 * the sync-bookkeeping guard (unknown-field stamps are never trimmed) and
 * backup v6 compatibility. Run: npm run test:links
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// meta.ts reads/writes localStorage: give node a tiny in-memory one.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;

import { linksSanitizerDiff, MAX_LINKS, sanitizeItemLinks, storeLabel } from "../src/lib/productUrl";
import { getSeedState, importState, normalizeItem } from "../src/lib/storage";
import {
  _resetMetaCache,
  getMeta,
  itemData,
  itemMeta,
  lwwMerge,
  recordLocalChanges,
  type FieldMeta,
  type Stamp,
} from "../src/lib/sync/meta";
import type { InventoryItem, InventoryState } from "../src/lib/types";

const HD = "https://www.homedepot.com/p/321642191";
const WM = "https://www.walmart.com/ip/1147483870";

// ------------------------------------------------------------- sanitizer ---

test("sanitizer: keeps valid https links and normalises them", () => {
  assert.deepEqual(sanitizeItemLinks([{ label: "Home Depot", url: HD }]), [{ label: "Home Depot", url: HD }]);
  assert.deepEqual(sanitizeItemLinks([{ label: "X", url: "walmart.com/ip/1" }]), [{ label: "X", url: "https://walmart.com/ip/1" }]);
});

test("sanitizer: drops unsafe or invalid URLs", () => {
  const bad = [
    "http://www.walmart.com/ip/1",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:pw@evil.com/",
    "https://has space.com/",
    "ftp://x.com/a",
    "https://nodot/",
    "https://x.com/" + "a".repeat(2049),
    "",
  ];
  for (const url of bad) assert.equal(sanitizeItemLinks([{ label: "a", url }]), undefined, url);
  assert.equal(sanitizeItemLinks([{ label: "a" }, null, 3, "x", { url: 5 }]), undefined);
});

test("sanitizer: label rules", () => {
  assert.equal(sanitizeItemLinks([{ label: "", url: HD }])![0].label, "Home Depot");
  assert.equal(sanitizeItemLinks([{ url: WM }])![0].label, "Walmart");
  assert.equal(sanitizeItemLinks([{ label: " Default ", url: HD }])![0].label, "Home Depot");
  assert.equal(sanitizeItemLinks([{ label: "a\u0000b\nc\t  d", url: HD }])![0].label, "a b c d");
  assert.equal(sanitizeItemLinks([{ label: "x".repeat(40), url: HD }])![0].label, "x".repeat(24));
  assert.equal(sanitizeItemLinks([{ label: "<b>hi</b>", url: HD }])![0].label, "<b>hi</b>"); // rendered as text
  assert.equal(storeLabel("https://sameday.costco.com/store/x"), "Costco Same-Day");
  assert.equal(storeLabel("https://www.costco.com/x"), "Costco");
  assert.equal(storeLabel("https://shop.example.org/x"), "shop.example.org");
});

test("sanitizer: dedupe, max 6, only {label,url}, empty → undefined", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: `https://a.com/${i}`, extra: 1 }));
  const out = sanitizeItemLinks(many)!;
  assert.equal(out.length, MAX_LINKS);
  assert.deepEqual(Object.keys(out[0]), ["label", "url"]);
  assert.deepEqual(sanitizeItemLinks([{ label: "a", url: HD }, { label: "b", url: HD }]), [{ label: "a", url: HD }]);
  assert.equal(sanitizeItemLinks([]), undefined);
  assert.equal(sanitizeItemLinks("x"), undefined);
  assert.equal(sanitizeItemLinks({ url: HD }), undefined);
});

test("sanitizer is idempotent", () => {
  const inputs: unknown[] = [
    [{ label: "  Default ", url: "homedepot.com/p/1" }, { label: "x".repeat(30) + " y", url: WM }],
    [{ label: "a\u0085b", url: "https://www.amazon.com/dp/B0" }],
  ];
  for (const i of inputs) {
    const once = sanitizeItemLinks(i);
    assert.deepEqual(sanitizeItemLinks(once), once);
  }
});

// ------------------------------------------------- data plan fail-on-change ---

test("linksSanitizerDiff: clean plan values pass, anything the app would change fails", () => {
  assert.deepEqual(linksSanitizerDiff([{ label: "Home Depot", url: HD }, { label: "Walmart", url: WM }]), []);
  assert.deepEqual(linksSanitizerDiff(undefined), []);
  assert.notDeepEqual(linksSanitizerDiff([]), []);
  assert.notDeepEqual(linksSanitizerDiff([{ label: "", url: HD }]), []); // label would be filled
  assert.notDeepEqual(linksSanitizerDiff([{ label: "Walmart", url: "http://www.walmart.com/ip/1" }]), []); // dropped
  assert.notDeepEqual(linksSanitizerDiff([{ url: HD, label: "Home Depot" }]), []); // key order differs
  assert.notDeepEqual(linksSanitizerDiff([{ label: "A", url: HD, verified: true }]), []); // extra key
  assert.notDeepEqual(linksSanitizerDiff([{ label: "A", url: "https://www.homedepot.com" }]), []); // gets trailing /
});

// ----------------------------------------------------------- normalizeItem ---

test("normalizeItem: items without links keep exactly the same fields", () => {
  for (const it of getSeedState().items) {
    assert.equal("links" in it, false, it.id);
    const again = normalizeItem({ ...it, links: [] } as InventoryItem);
    assert.equal(JSON.stringify(again), JSON.stringify(it), it.id);
  }
});

test("normalizeItem: sanitises links on load/import/sync", () => {
  const base = getSeedState().items[0];
  const n = normalizeItem({ ...base, links: [{ label: "", url: "homedepot.com/p/1" }, { label: "x", url: "javascript:1" }] } as unknown as InventoryItem);
  assert.deepEqual(n.links, [{ label: "Home Depot", url: "https://homedepot.com/p/1" }]);
  const order = Object.keys(n);
  assert.equal(order.indexOf("links"), order.indexOf("productUrl") + 1);
});

// ------------------------------------------------------- sync bookkeeping ---

/** JS copy of public.lww_merge() (0001_init.sql): only pushed meta keys; strictly newer wins. */
function serverMerge(a: Record<string, unknown>, am: FieldMeta, b: Record<string, unknown>, bm: FieldMeta) {
  const data = { ...a };
  const meta = { ...am };
  for (const f of Object.keys(bm)) {
    const x = meta[f];
    const y = bm[f];
    if (!Array.isArray(y)) continue;
    const wins = !x || y[0] > x[0] || (y[0] === x[0] && (y[1] ?? "") > (x[1] ?? ""));
    if (wins) {
      meta[f] = y;
      if (f in b) data[f] = b[f];
      else delete data[f];
    }
  }
  return { data, meta };
}

function freshDevice() {
  mem.clear();
  _resetMetaCache();
  return getMeta();
}

test("sync meta keeps unknown-field stamps (guard: never trim meta to known fields)", () => {
  const m = freshDevice();
  const local = getSeedState().items[0];
  const state: InventoryState = { items: [local], purchases: [], receipts: [], version: 7 };
  // Cloud row written by a newer app: has a field this build doesn't know.
  const S: Stamp = [Date.now() + 1000, "zzz-newer-device"];
  const cloudData = { ...itemData(local), futureField: { a: 1 } };
  const cloudMeta: FieldMeta = { ...itemMeta(local), futureField: S };
  // Pull, exactly like engine.applyRemote: merge, keep res.meta, re-normalise (drops the field).
  const res = lwwMerge(itemData(local), itemMeta(local), cloudData, cloudMeta);
  m.items[local.id] = res.meta;
  const pulled = normalizeItem({ ...(res.data as Partial<InventoryItem>), id: local.id, name: local.name });
  assert.equal("futureField" in pulled, false);
  assert.deepEqual(getMeta().items[local.id].futureField, S, "stamp for the unknown field must be kept");
  // Plain local edit, then push.
  const next: InventoryState = { ...state, items: [{ ...pulled, quantity: pulled.quantity + 1 }] };
  recordLocalChanges({ ...state, items: [pulled] }, next, "edit");
  const pushedMeta = itemMeta(next.items[0]);
  const pushedData = itemData(next.items[0]);
  assert.deepEqual(pushedMeta.futureField, S, "pushed meta must carry the unknown field's stamp unchanged");
  const after = serverMerge(cloudData, cloudMeta, pushedData, pushedMeta);
  assert.deepEqual(after.data.futureField, { a: 1 }, "server keeps the unknown field");
  assert.equal(after.data.quantity, pulled.quantity + 1);
});

test("new client: removing every link deletes the field in the cloud", () => {
  freshDevice();
  const base = { ...getSeedState().items[0], links: [{ label: "Home Depot", url: HD }] };
  const prev: InventoryState = { items: [base], purchases: [], receipts: [], version: 7 };
  recordLocalChanges(null, prev, "edit");
  const cloud = { data: itemData(base), meta: itemMeta(base) };
  const next: InventoryState = { ...prev, items: [{ ...base, links: undefined }] };
  const keys = recordLocalChanges(prev, next, "edit");
  assert.deepEqual(keys, [`item:${base.id}`]);
  const after = serverMerge(cloud.data, cloud.meta, itemData(next.items[0]), itemMeta(next.items[0]));
  assert.equal("links" in after.data, false);
});

// ------------------------------------------------------------- backup v6 ---

test("backup v6: export keeps links; import round-trips; old files import", () => {
  freshDevice();
  const seed = getSeedState();
  const withLinks = { ...seed.items[0], links: [{ label: "Walmart", url: WM }] };
  const file = { version: 6, stateVersion: 7, items: [withLinks, ...seed.items.slice(1)], purchases: [], receipts: [], photos: {}, counts: {} };
  const restored = importState(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(restored.items[0].links, [{ label: "Walmart", url: WM }]);
  const old = { version: 5, items: seed.items.map((i) => ({ ...i })) };
  const r2 = importState(old);
  assert.equal(r2.items.some((i) => "links" in i), false);
});

test("backup: restoring a pre-links file clears links (file wins) and syncs the removal", () => {
  freshDevice();
  const seed = getSeedState();
  const cur = { ...seed.items[0], links: [{ label: "Walmart", url: WM }] };
  const prev: InventoryState = { items: [cur, ...seed.items.slice(1)], purchases: [], receipts: [], version: 7 };
  recordLocalChanges(null, prev, "edit");
  const cloud = { data: itemData(cur), meta: itemMeta(cur) };
  const next = importState({ version: 6, stateVersion: 7, items: seed.items });
  const keys = recordLocalChanges(prev, next, "import");
  assert.ok(keys.includes(`item:${cur.id}`));
  const it = next.items.find((i) => i.id === cur.id)!;
  assert.equal("links" in it, false);
  const after = serverMerge(cloud.data, cloud.meta, itemData(it), itemMeta(it));
  assert.equal("links" in after.data, false);
});

// ------------------------------------------- jsonb key order: no ping-pong ---

/** Postgres jsonb object key order: shorter keys first, then bytewise. */
function jsonbOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(jsonbOrder);
  if (v && typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    const o: Record<string, unknown> = {};
    for (const k of keys) o[k] = jsonbOrder((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}

test("jsonb key order: pulled links ({url,label}) cause no dirty field, re-push or outbox entry", () => {
  const m = freshDevice();
  const base = normalizeItem({ ...getSeedState().items[0], links: [{ label: "Home Depot", url: HD }, { label: "Walmart", url: WM }] } as InventoryItem);
  const prev: InventoryState = { items: [base], purchases: [], receipts: [], version: 7 };
  recordLocalChanges(null, prev, "edit");
  // Push → server stores jsonb → pull returns the same row with keys reordered.
  const pushed = { data: itemData(base), meta: itemMeta(base) };
  const pulledData = jsonbOrder(pushed.data) as Record<string, unknown>;
  const pulledMeta = jsonbOrder(pushed.meta) as FieldMeta;
  assert.equal(JSON.stringify((pulledData.links as unknown[])[0]), JSON.stringify({ url: HD, label: "Home Depot" }));
  // 1) equal stamps (our own push echoed back)
  let res = lwwMerge(itemData(base), itemMeta(base), pulledData, pulledMeta);
  assert.equal(res.remoteChanged, false);
  assert.equal(res.localNewer, false, "would re-push");
  // 2) a newer stamp with identical content (e.g. a data-plan write) and list objects with swapped keys
  const newer: FieldMeta = { ...pulledMeta, links: [Date.now() + 5000, "release-data-test"] };
  const swapped = { ...pulledData, links: [{ url: HD, label: "Home Depot" }, { label: "Walmart", url: WM }] };
  res = lwwMerge(itemData(base), itemMeta(base), swapped, newer);
  assert.equal(res.remoteChanged, false, "same content in another key order is not a change");
  assert.equal(res.localNewer, false);
  m.items[base.id] = res.meta;
  // applyRemote re-normalises; the dirty check must see nothing to push.
  const after = normalizeItem({ ...(res.data as Partial<InventoryItem>), id: base.id, name: base.name });
  assert.equal(JSON.stringify(after.links![0]), JSON.stringify({ label: "Home Depot", url: HD }), "sanitizer output is canonical {label,url}");
  const keys = recordLocalChanges(prev, { ...prev, items: [after] }, "edit");
  assert.deepEqual(keys, [], "no outbox entry");
  // and with the raw (un-normalised) pulled object too
  const keys2 = recordLocalChanges({ ...prev, items: [after] }, { ...prev, items: [{ ...after, links: swapped.links } as InventoryItem] }, "edit");
  assert.deepEqual(keys2, [], "key order alone never marks the item dirty");
  assert.deepEqual(getMeta().items[base.id].links, newer.links, "stamp unchanged by the no-op");
});
