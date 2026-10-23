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
