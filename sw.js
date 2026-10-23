/* Home Inventory shell cache — network-first for pages so new deploys show up immediately */
const CACHE = "home-inventory-shell-v2";
const SHELL = [
  "/home-inventory/",
  "/home-inventory/manifest.webmanifest",
  "/home-inventory/icon-192.png",
  "/home-inventory/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/home-inventory")) return;

  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isPage) {
    // Network first: always try the latest deploy, fall back to cache offline.
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((c) => c || caches.match("/home-inventory/")))
    );
    return;
  }

  // Static assets (hashed): cache first, refresh in background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
