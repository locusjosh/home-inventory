/* Home Inventory service worker.
 * - Pages and RSC payloads: network first, so new deploys show up right away; offline they come from cache.
 *   Static export pages ignore the query string (?id=…), so cache lookups use ignoreSearch.
 * - Hashed static assets: cache first.
 * - Bundled packshots (/item-photos/*): kept in their own cache that survives deploys.
 * - Supabase (auth, REST, storage, realtime, the pin-login function) is cross-origin and is never touched.
 * The precache list and build version are injected by scripts/gen-sw.mjs after `next build`.
 */
const PRECACHE = /*__PRECACHE__*/ {"version":"7975e175f168","core":["/home-inventory/items/edit/","/home-inventory/add/"],"shell":["/home-inventory/_next/static/chunks/152-b3deaac814241d9d.js","/home-inventory/_next/static/chunks/173-4cb1829ff158ebda.js","/home-inventory/_next/static/chunks/175-782f8028de38df73.js","/home-inventory/_next/static/chunks/176-b06c1d1e6e69b017.js","/home-inventory/_next/static/chunks/255-7ffa141d0bdd81b3.js","/home-inventory/_next/static/chunks/268.81df4d55df6540c3.js","/home-inventory/_next/static/chunks/44530001.d5aaf038c7515165.js","/home-inventory/_next/static/chunks/486-198e6daccbff03cc.js","/home-inventory/_next/static/chunks/4bd1b696-c023c6e3521b1417.js","/home-inventory/_next/static/chunks/554-4aa988b5dbf2e3e1.js","/home-inventory/_next/static/chunks/597.895dc403d72d483d.js","/home-inventory/_next/static/chunks/673-f22ba15a630eb47e.js","/home-inventory/_next/static/chunks/817.216ae96264773204.js","/home-inventory/_next/static/chunks/app/_not-found/page-4d5727f8ed61b0f8.js","/home-inventory/_next/static/chunks/app/add/page-224fae0000e30157.js","/home-inventory/_next/static/chunks/app/assist/page-ccc3eb3657b697ad.js","/home-inventory/_next/static/chunks/app/count/history/page-5fe781a03fd32deb.js","/home-inventory/_next/static/chunks/app/count/item/page-b5940769e7099c48.js","/home-inventory/_next/static/chunks/app/count/page-6c946fc8d689c4a6.js","/home-inventory/_next/static/chunks/app/count/review/page-2ff9fbfdee3b08b3.js","/home-inventory/_next/static/chunks/app/count/session/page-89c439251dccabf4.js","/home-inventory/_next/static/chunks/app/data/page-35de8a3cbc521f78.js","/home-inventory/_next/static/chunks/app/ideas/page-7578e78507300428.js","/home-inventory/_next/static/chunks/app/items/edit/page-baefa83cc4440615.js","/home-inventory/_next/static/chunks/app/layout-70d1f9d4c0727338.js","/home-inventory/_next/static/chunks/app/low-stock/page-0e54abcc7e1e6feb.js","/home-inventory/_next/static/chunks/app/more/archived/page-b9566aa3125d32c0.js","/home-inventory/_next/static/chunks/app/more/deleted/page-f70b947997f9d3a9.js","/home-inventory/_next/static/chunks/app/more/page-64d13578dd9a2b32.js","/home-inventory/_next/static/chunks/app/page-11f7a09a553f78b6.js","/home-inventory/_next/static/chunks/app/receipt/page-e4a0d6fe3befee97.js","/home-inventory/_next/static/chunks/app/restock/page-6d4f60ae37777e4e.js","/home-inventory/_next/static/chunks/e99863e0.6290cb84bf7aeef3.js","/home-inventory/_next/static/chunks/framework-b1e5f14688f9ffe6.js","/home-inventory/_next/static/chunks/main-5dd37cbd0f2a63d6.js","/home-inventory/_next/static/chunks/main-app-9a98d33a6e15bf2f.js","/home-inventory/_next/static/chunks/pages/_app-7d307437aca18ad4.js","/home-inventory/_next/static/chunks/pages/_error-cb2a52f75f2162e2.js","/home-inventory/_next/static/chunks/polyfills-42372ed130431b0a.js","/home-inventory/_next/static/chunks/webpack-63be091a1ad21ca0.js","/home-inventory/_next/static/css/fc53437722742243.css","/home-inventory/_next/static/y3OUuZZUEEyYiVoFs7NFd/_buildManifest.js","/home-inventory/_next/static/y3OUuZZUEEyYiVoFs7NFd/_ssgManifest.js","/home-inventory/add/","/home-inventory/add/index.txt","/home-inventory/assist/","/home-inventory/assist/index.txt","/home-inventory/count/history/","/home-inventory/count/history/index.txt","/home-inventory/count/","/home-inventory/count/index.txt","/home-inventory/count/item/","/home-inventory/count/item/index.txt","/home-inventory/count/review/","/home-inventory/count/review/index.txt","/home-inventory/count/session/","/home-inventory/count/session/index.txt","/home-inventory/data/","/home-inventory/data/index.txt","/home-inventory/icon-512.png","/home-inventory/ideas/","/home-inventory/ideas/index.txt","/home-inventory/","/home-inventory/index.txt","/home-inventory/items/edit/","/home-inventory/items/edit/index.txt","/home-inventory/low-stock/","/home-inventory/low-stock/index.txt","/home-inventory/manifest.webmanifest","/home-inventory/more/archived/","/home-inventory/more/archived/index.txt","/home-inventory/more/deleted/","/home-inventory/more/deleted/index.txt","/home-inventory/more/","/home-inventory/more/index.txt","/home-inventory/receipt/","/home-inventory/receipt/index.txt","/home-inventory/restock/","/home-inventory/restock/index.txt"],"photos":["/home-inventory/item-photos/SBO59T3189.jpg","/home-inventory/item-photos/SBO59T3190.jpg","/home-inventory/item-photos/SBO59T3191.jpg","/home-inventory/item-photos/SBO59T3193-forks.jpg","/home-inventory/item-photos/SBO59T3193.jpg","/home-inventory/item-photos/SBO59T3194.jpg","/home-inventory/item-photos/SBO59T3195.jpg","/home-inventory/item-photos/SBO59T3196.jpg","/home-inventory/item-photos/SBO59T3197.jpg","/home-inventory/item-photos/SBO59T3198-foil.jpg","/home-inventory/item-photos/SBO59T3198.jpg","/home-inventory/item-photos/SBO59T3199-pods.jpg","/home-inventory/item-photos/SBO59T3199.jpg","/home-inventory/item-photos/SBO59T3200.jpg","/home-inventory/item-photos/SBO59T3201.jpg","/home-inventory/item-photos/SBO59T3202.jpg","/home-inventory/item-photos/SBO59T3203.jpg","/home-inventory/item-photos/SBO59T3204-bleach.jpg","/home-inventory/item-photos/SBO59T3204.jpg","/home-inventory/item-photos/SBO59T3205-wand.jpg","/home-inventory/item-photos/SBO59T3205.jpg","/home-inventory/item-photos/SBO59T3206.jpg","/home-inventory/item-photos/SBO59T3207-spray.jpg","/home-inventory/item-photos/SBO59T3207.jpg","/home-inventory/item-photos/SBO59T3208.jpg","/home-inventory/item-photos/SBO59T3209.jpg","/home-inventory/item-photos/SBO59T3210.jpg","/home-inventory/item-photos/SBO59T3211.jpg","/home-inventory/item-photos/SBO59T3212-towels.jpg","/home-inventory/item-photos/SBO59T3212.jpg","/home-inventory/item-photos/SBO59T3213.jpg","/home-inventory/item-photos/SBO59T3214.jpg","/home-inventory/item-photos/SBO59T3215.jpg","/home-inventory/item-photos/SBO59T3216.jpg","/home-inventory/item-photos/SBO59T3217.jpg","/home-inventory/item-photos/SBO59T3218.jpg","/home-inventory/item-photos/SBO59T3219.jpg","/home-inventory/item-photos/SBO59T3220.jpg","/home-inventory/item-photos/SBO59T3221-kitchen.jpg","/home-inventory/item-photos/SBO59T3221.jpg","/home-inventory/item-photos/SBO59T3222-black.jpg","/home-inventory/item-photos/SBO59T3222.jpg","/home-inventory/item-photos/SBO59T3223.jpg","/home-inventory/item-photos/SBO59T3224.jpg","/home-inventory/item-photos/SBO59T3225.jpg","/home-inventory/item-photos/SBO59T3226.jpg","/home-inventory/item-photos/SBO59T3227.jpg","/home-inventory/item-photos/SBO59T3228.jpg","/home-inventory/item-photos/SBO59T3229.jpg","/home-inventory/item-photos/SBO59T3230.jpg","/home-inventory/item-photos/SBO59T3232.jpg","/home-inventory/item-photos/SBO59T3240-hangers.jpg","/home-inventory/item-photos/SBO59T3240.jpg","/home-inventory/item-photos/SBO59T3251.jpg","/home-inventory/item-photos/SBO59T3253.jpg","/home-inventory/item-photos/SBO59T3258.jpg","/home-inventory/item-photos/SBO59T3264-peroxide.jpg","/home-inventory/item-photos/SBO59T3264.jpg","/home-inventory/item-photos/SBO59T3273.jpg","/home-inventory/item-photos/SBO59T3292-alcohol.jpg","/home-inventory/item-photos/SBO59T3292.jpg","/home-inventory/item-photos/SBO59T3300.jpg","/home-inventory/item-photos/SBO59T3314.jpg","/home-inventory/item-photos/SBO59T3358.jpg","/home-inventory/item-photos/SBO59T3359.jpg","/home-inventory/item-photos/SBO59T3360.jpg","/home-inventory/item-photos/SBO59T3361.jpg"]};
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
