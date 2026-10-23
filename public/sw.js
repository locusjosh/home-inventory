/* Home Inventory service worker.
 * - Pages and RSC payloads: network first, so new deploys show up right away; offline they come from cache.
 *   Static export pages ignore the query string (?id=…), so cache lookups use ignoreSearch.
 * - Hashed static assets: cache first.
 * - Bundled packshots (/item-photos/*): kept in their own cache that survives deploys.
 * - Supabase (auth, REST, storage, realtime, the pin-login function) is cross-origin and is never touched.
 * The precache list and build version are injected by scripts/gen-sw.mjs after `next build`.
 */
const PRECACHE = /*__PRECACHE__*/ { version: "dev", core: [], shell: [], photos: [] };
const BASE = "/home-inventory/";
const SHELL_PREFIX = "home-inventory-shell-v3-";
const SHELL_CACHE = SHELL_PREFIX + PRECACHE.version;
const PHOTO_CACHE = "home-inventory-photos-v1";
const CORE = [BASE, BASE + "manifest.webmanifest", BASE + "icon-192.png", BASE + "apple-touch-icon.png", ...PRECACHE.core];

self.addEventListener("install", (event) => {
  // Only the tiny core must succeed; everything else is warmed in the background (warm()).
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Keep this build's shell plus the newest previous shell (so a page still running the previous build can
      // lazy-load its chunks, even offline); delete every other cache (v2 and older, stray caches).
      const olderShells = keys.filter((k) => k.startsWith(SHELL_PREFIX) && k !== SHELL_CACHE);
      const keepPrev = olderShells[olderShells.length - 1];
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== PHOTO_CACHE && k !== keepPrev).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
  warm(); // best effort; the page also asks via postMessage so the browser keeps the worker alive for it
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm") event.waitUntil(warm());
});

let warming = null;
function warm() {
  if (!warming) {
    warming = (async () => {
      const fill = async (cacheName, urls) => {
        const cache = await caches.open(cacheName);
        const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
        const todo = urls.filter((u) => !have.has(u));
        // A few at a time; a failed fetch is just skipped (retried on the next warm).
        for (let i = 0; i < todo.length; i += 6) {
          await Promise.allSettled(
            todo.slice(i, i + 6).map(async (u) => {
              const res = await fetch(u, { cache: "no-cache" });
              if (res.ok) await cache.put(u, res);
            })
          );
        }
        return todo.length;
      };
      await fill(SHELL_CACHE, PRECACHE.shell);
      await fill(PHOTO_CACHE, PRECACHE.photos);
      // Drop packshots that are no longer bundled.
      const pc = await caches.open(PHOTO_CACHE);
      const keep = new Set(PRECACHE.photos);
      if (keep.size) for (const r of await pc.keys()) if (!keep.has(new URL(r.url).pathname)) await pc.delete(r);
    })().finally(() => setTimeout(() => (warming = null), 1000));
  }
  return warming;
}

/** Never intercept Supabase or anything outside this app. */
function bypass(url) {
  if (url.origin !== self.location.origin) return true; // *.supabase.co, CDNs, …
  if (!url.pathname.startsWith("/home-inventory")) return true;
  return /\/(auth|rest|storage|realtime|functions)\/v1\//.test(url.pathname);
}

const keyOf = (url) => url.origin + url.pathname; // static export: the query never changes the file

function put(cacheName, url, res) {
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(keyOf(url), copy)).catch(() => {});
  }
  return res;
}

async function fromCache(url) {
  return (
    (await caches.match(keyOf(url), { ignoreSearch: true })) ||
    // /home-inventory/items/edit → /home-inventory/items/edit/
    (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname)
      ? await caches.match(url.origin + url.pathname + "/", { ignoreSearch: true })
      : undefined)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (bypass(url)) return;

  const accept = req.headers.get("accept") || "";
  const isPage = req.mode === "navigate" || accept.includes("text/html");
  const isRsc = url.pathname.endsWith(".txt") || req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

  if (isPage || isRsc) {
    event.respondWith(
      fetch(req)
        .then((res) => put(SHELL_CACHE, url, res))
        .catch(async () => {
          const hit = await fromCache(url);
          if (hit) return hit;
          if (isPage) return (await caches.match(BASE)) || Response.error();
          return Response.error();
        })
    );
    return;
  }

  const isPhoto = url.pathname.startsWith(BASE + "item-photos/");
  event.respondWith(
    (async () => {
      const cached = await fromCache(url);
      const fetched = fetch(req)
        .then((res) => put(isPhoto ? PHOTO_CACHE : SHELL_CACHE, url, res))
        .catch(() => cached || Response.error());
      if (cached) {
        if (!isPhoto && !url.pathname.includes("/_next/static/")) event.waitUntil(fetched.catch(() => {})); // refresh unhashed files
        return cached;
      }
      return fetched;
    })()
  );
});
