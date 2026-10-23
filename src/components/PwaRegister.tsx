"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker. A new worker takes over immediately (skipWaiting + clients.claim)
 * without reloading the page: all app and sync state lives in localStorage/IndexedDB, Supabase traffic is never
 * routed through the worker, and the previous build's cache is kept one generation so a page still running the
 * old build can finish loading its chunks. The next navigation picks up the new build (pages are network-first).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    // Ask the active worker to warm the offline cache (route shells, chunks, bundled packshots) in the background.
    const warm = () => sw.controller?.postMessage({ type: "warm" });
    sw.register("/home-inventory/sw.js")
      .then(() => sw.ready)
      .then((reg) => reg.active?.postMessage({ type: "warm" }))
      .catch(() => {
        /* ignore — Pages still works without SW */
      });
    sw.addEventListener("controllerchange", warm);
    return () => sw.removeEventListener("controllerchange", warm);
  }, []);
  return null;
}
