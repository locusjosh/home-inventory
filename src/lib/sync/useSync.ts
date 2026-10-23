"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from "./engine";

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

/** Re-render every 30 s so "Synced · 2 min ago" stays current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function agoText(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (new Date(now).toDateString() === d.toDateString()) return `today at ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` at ${time}`;
}

/** The one-line status shown on More. */
export function statusText(s: SyncStatus, now: number): string {
  switch (s.phase) {
    case "off":
      return "Not set up";
    case "starting":
      return "Starting…";
    case "signed-out":
      return "Not signed in";
    case "syncing":
      return "Syncing…";
    case "offline":
      return s.pending ? `Offline · ${plural(s.pending, "change")} waiting` : "Offline";
    case "error":
      return s.error || "Sync didn’t finish. It will try again shortly.";
    case "idle":
    default:
      if (s.pending) return `${plural(s.pending, "change")} waiting`;
      return s.lastSyncAt ? `Synced · ${agoText(s.lastSyncAt, now)}` : "Not synced yet";
  }
}
