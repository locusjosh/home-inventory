"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const swUrl = "/home-inventory/sw.js";
    navigator.serviceWorker.register(swUrl).catch(() => {
      /* ignore — Pages still works without SW */
    });
  }, []);
  return null;
}
