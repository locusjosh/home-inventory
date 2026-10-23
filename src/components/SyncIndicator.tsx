"use client";

import Link from "next/link";
import { Icon } from "./ui/Icon";
import { useSyncStatus } from "@/lib/sync/useSync";

/** Small cloud in the large-title bar — only while syncing or when sync has a problem. */
export function SyncIndicator() {
  const s = useSyncStatus();
  if (!s.configured) return null;
  if (s.phase === "syncing") {
    return (
      <span
        role="status"
        aria-label="Syncing"
        data-testid="sync-indicator"
        data-state="syncing"
        className="inline-flex h-11 w-11 items-center justify-center text-label-2"
      >
        <Icon name="icloud.sync" size={24} strokeWidth={1.9} className="animate-pulse" />
      </span>
    );
  }
  if (s.phase === "error") {
    return (
      <Link
        href="/more"
        aria-label="Sync problem — open More for details"
        data-testid="sync-indicator"
        data-state="error"
        className="pressable focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-sys-red-text"
      >
        <Icon name="icloud.exclamation" size={24} strokeWidth={1.9} />
      </Link>
    );
  }
  return null;
}
