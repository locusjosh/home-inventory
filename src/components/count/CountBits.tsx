"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CountEntry, CountSession, LineState } from "@/lib/counts/model";
import { SCOPE_LABEL, round2, signed } from "@/lib/counts/model";
import { formatQty } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

export const itemHref = (id: string) => `/items/edit/?id=${encodeURIComponent(id)}`;
export const sessionHref = (id: string, done = false) => `/count/session/?id=${encodeURIComponent(id)}${done ? "&done=1" : ""}`;

export function fmtDay(iso: string, withYear = false) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(withYear || !sameYear ? { year: "numeric" } : {}) });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
export function fmtDuration(a: string, b?: string | null) {
  if (!b) return "";
  const m = Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} hr ${m % 60 ? `${m % 60} min` : ""}`.trim();
}

/** "3 → 1" with the change after it; decreases in red, increases with a plus. */
export function QtyChange({ from, to, compact = false }: { from: number; to: number; compact?: boolean }) {
  const d = round2(to - from);
  return (
    <span className="inline-flex shrink-0 items-baseline gap-2 tabular-nums">
      <span className={`${compact ? "text-subhead" : "text-body"} text-label-2`}>
        {formatQty(from)} → <span className="text-label">{formatQty(to)}</span>
      </span>
      <span className={`min-w-[2.25rem] text-right text-subhead font-semibold ${d < 0 ? "text-sys-red-text" : d > 0 ? "text-label" : "text-label-2"}`}>
        {d === 0 ? "—" : signed(d)}
      </span>
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="glass rounded-card px-4 py-3.5">
      <p className="text-footnote font-semibold text-label-2">{label}</p>
      <p className="mt-0.5 text-title1 tabular-nums text-label">{value}</p>
      {sub ? <p className="text-footnote text-label-2">{sub}</p> : null}
    </div>
  );
}

/** Small state glyph for the jump list. */
export function LineGlyph({ state, excluded }: { state: LineState; excluded?: boolean }) {
  if (excluded)
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-fill-3 text-label-2" aria-label="Excluded">
        <Icon name="xmark" size={14} strokeWidth={2.6} />
      </span>
    );
  if (state === "counted")
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sys-green text-white" aria-label="Counted">
        <Icon name="checkmark" size={15} strokeWidth={3} />
      </span>
    );
  if (state === "skipped")
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-fill-3 text-sys-orange" aria-label="Skipped">
        <Icon name="arrow.counterclockwise" size={14} strokeWidth={2.4} />
      </span>
    );
  return <span className="h-[26px] w-[26px] rounded-full border-2 border-fill" aria-label="Not counted yet" />;
}

export function sessionTitle(s: CountSession) {
  return `${fmtDay(s.startedAt)} · ${SCOPE_LABEL(s.scope)}`;
}

export function sessionSummary(s: CountSession): string {
  if (s.status === "cancelled") return "Cancelled · no quantities changed";
  if (s.status === "active" || s.status === "reviewing") return "In progress";
  const t = s.totals;
  if (!t) return "";
  const parts = [`${t.counted} counted`, `${t.changed} changed`];
  if (t.net !== 0) parts.push(`${signed(t.net)} net`);
  return parts.join(" · ") + (s.status === "reverted" ? " · reverted" : "");
}

export function entrySourceLabel(e: CountEntry) {
  if (e.source === "count") return "Count";
  if (e.source === "revert") return "Count reverted";
  const via = e.via && e.via !== "edit" ? ` · ${e.via[0].toUpperCase()}${e.via.slice(1)}` : "";
  return `Manual${via}`;
}

/** Transient HUD message (iOS-style pill under the nav bar). */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2400);
    return () => window.clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div
      role="status"
      className="animate-fade-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+52px)] z-[75] -translate-x-1/2 whitespace-nowrap toast-pill rounded-full px-4 py-2.5 text-footnote font-semibold "
    >
      {msg}
    </div>
  ) : null;
  return { toast: setMsg, toastNode: node };
}
