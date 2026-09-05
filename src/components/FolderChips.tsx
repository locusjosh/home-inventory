"use client";

import { STOCK_FOLDERS } from "@/lib/types";

type Props = {
  selected: string | "all" | "low" | "needs";
  counts: Record<string, number>;
  lowCount: number;
  needsCount?: number;
  onSelect: (folder: string | "all" | "low" | "needs") => void;
};

export function FolderChips({ selected, counts, lowCount, needsCount = 0, onSelect }: Props) {
  const chips: { key: string | "all" | "low" | "needs"; label: string; count: number }[] = [
    { key: "all", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
    { key: "low", label: "Low stock", count: lowCount },
    { key: "needs", label: "Needs count", count: needsCount },
    ...STOCK_FOLDERS.map((f) => ({ key: f, label: f, count: counts[f] ?? 0 })),
  ];

  return (
    <div className="chip-scroll">
      <div className="flex gap-2 overflow-x-auto pb-1 pr-8 scrollbar-none">
        {chips.map((c) => {
          const active = selected === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect(c.key)}
              className={`shrink-0 rounded-full px-3.5 py-2.5 text-sm font-semibold pressable focus-ring transition ${
                active
                  ? c.key === "low"
                    ? "bg-warn text-white shadow-soft"
                    : c.key === "needs"
                      ? "bg-accent text-white shadow-soft"
                      : "bg-ink text-surface shadow-soft"
                  : "bg-surface text-ink ring-1 ring-surface-3 hover:bg-surface-3/50"
              }`}
            >
              {c.label}
              <span className={`ml-1.5 tabular-nums ${active ? "opacity-90" : "text-ink-muted"}`}>
                {c.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="chip-scroll-fade" aria-hidden />
    </div>
  );
}
