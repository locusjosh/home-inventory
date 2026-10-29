import type { ItemLink } from "./types";

/**
 * Product links are open-only: we never fetch or scrape the page. Normalise
 * what the user typed (add https:// when missing) and only ever allow http(s)
 * so a restored backup can't smuggle in javascript:/data: URLs.
 */
export type UrlResult = { ok: true; url: string | null } | { ok: false; error: string };

export function normalizeProductUrl(input: string | null | undefined): UrlResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, url: null };
  if (/\s/.test(raw)) return { ok: false, error: "Links can’t contain spaces." };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (hasScheme && !/^https?:\/\//i.test(raw)) return { ok: false, error: "Use a web link starting with https://." };
  const candidate = hasScheme ? raw : `https://${raw.replace(/^\/+/, "")}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn’t look like a web link." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Use a web link starting with https://." };
  const host = u.hostname;
  if (!host || (!host.includes(".") && host !== "localhost") || host.startsWith(".") || host.endsWith("."))
    return { ok: false, error: "That doesn’t look like a web link." };
  if (u.username || u.password) return { ok: false, error: "That doesn’t look like a web link." };
  return { ok: true, url: u.href };
}

/** Safe value for storage/import: valid normalised URL or null. */
export function sanitizeProductUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const r = normalizeProductUrl(input);
  return r.ok ? r.url : null;
}

/** "amazon.com" for display. */
export function productHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ------------------------------------------------------------ extra links ---


export const MAX_LINKS = 6;
export const MAX_LINK_LABEL = 24;
export const MAX_LINK_URL = 2048;

/** Like normalizeProductUrl, but extra links must be https (and ≤ 2048 chars). */
export function normalizeLinkUrl(input: string | null | undefined): UrlResult {
  const r = normalizeProductUrl(input);
  if (!r.ok || !r.url) return r;
  if (!r.url.startsWith("https://")) return { ok: false, error: "Use a link starting with https://." };
  if (r.url.length > MAX_LINK_URL) return { ok: false, error: "That link is too long." };
  return r;
}

const STORE_LABELS: Array<[string, string]> = [
  ["sameday.costco.com", "Costco Same-Day"],
  ["amazon.com", "Amazon"],
  ["homedepot.com", "Home Depot"],
  ["walmart.com", "Walmart"],
  ["target.com", "Target"],
  ["costco.com", "Costco"],
  ["chewy.com", "Chewy"],
  ["lowes.com", "Lowe’s"],
];

/** "Home Depot" for homedepot.com links; otherwise the bare host. */
export function storeLabel(url: string): string {
  const host = productHost(url).toLowerCase();
  for (const [suffix, label] of STORE_LABELS) if (host === suffix || host.endsWith("." + suffix)) return label;
  return clip(host);
}

function isControl(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x20 || (c >= 0x7f && c <= 0x9f);
}

function clip(s: string): string {
  const chars = Array.from(s);
  return chars.length > MAX_LINK_LABEL ? chars.slice(0, MAX_LINK_LABEL).join("").trim() : s;
}

/** Trim, drop control characters, collapse spaces, cap at 24 chars. Empty or "Default" → store name. */
export function cleanLinkLabel(label: unknown, url: string): string {
  const t = Array.from(typeof label === "string" ? label : "", (ch) => (isControl(ch) ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.toLowerCase() === "default") return storeLabel(url);
  return clip(t);
}

/**
 * The only way `links` gets into app state (load, import, sync pull, edit).
 * Never throws: invalid entries are dropped, duplicates (same URL) keep the
 * first, max 6, only {label, url} survive. Returns undefined when nothing is
 * left so the field is omitted rather than stored as [].
 */
export function sanitizeItemLinks(raw: unknown): ItemLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ItemLink[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    if (out.length >= MAX_LINKS) break;
    if (!e || typeof e !== "object") continue;
    const rawUrl = (e as { url?: unknown }).url;
    if (typeof rawUrl !== "string") continue;
    const r = normalizeLinkUrl(rawUrl);
    if (!r.ok || !r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({ label: cleanLinkLabel((e as { label?: unknown }).label, r.url), url: r.url });
  }
  return out.length ? out : undefined;
}

/**
 * Fail-on-change check for anything that writes `links` outside the app (the
 * data plan): returns the problems, [] when `raw` is exactly what the app's
 * sanitizer would store. Values must pass this so local and cloud copies are
 * byte-identical.
 */
export function linksSanitizerDiff(raw: unknown): string[] {
  const clean = sanitizeItemLinks(raw);
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return ["links must be an array"];
  if (!raw.length) return ["empty links must be omitted, not []"];
  if (JSON.stringify(clean) === JSON.stringify(raw)) return [];
  const problems: string[] = [];
  raw.forEach((e, i) => {
    const one = sanitizeItemLinks([e]);
    if (!one) problems.push(`entry ${i} would be dropped (invalid or not https)`);
    else if (JSON.stringify(one[0]) !== JSON.stringify(e)) problems.push(`entry ${i} would be stored as ${JSON.stringify(one[0])}`);
  });
  if (!problems.length && raw.length > MAX_LINKS) problems.push(`more than ${MAX_LINKS} links`);
  if (!problems.length) problems.push("duplicate URLs would be dropped");
  return problems.length ? problems : ["differs from sanitizer output"];
}
