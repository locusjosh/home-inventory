"use client";

import { FOLDERS } from "@/lib/types";

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
    ...FOLDERS.map((f) => ({ key: f, label: f, count: counts[f] ?? 0 })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {chips.map((c) => {
        const active = selected === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
              active
                ? c.key === "low" || c.key === "needs"
                  ? "bg-warn text-white"
                  : "bg-accent text-white"
                : "bg-surface-2 text-ink hover:bg-surface-3"
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
  );
}
