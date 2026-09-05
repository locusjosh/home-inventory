"use client";

import { formatQty } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (next: number) => void;
  unit?: string;
  compact?: boolean;
};

export function QuantityStepper({ value, onChange, unit, compact }: Props) {
  const bump = (delta: number) => onChange(Math.max(0, value + delta));
  const btn = compact ? "h-12 w-12" : "h-12 w-12";
  const inputW = compact ? "w-14" : "w-[4.5rem]";

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-2xl bg-surface-2 p-1 ring-1 ring-surface-3 ${
        compact ? "" : "shadow-soft"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className={`flex ${btn} items-center justify-center rounded-xl bg-surface text-xl font-semibold text-ink hover:bg-surface-3 pressable focus-ring`}
        onClick={() => bump(-1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label="Quantity"
        className={`h-11 ${inputW} rounded-xl border-0 bg-transparent text-center text-base font-semibold tabular-nums text-ink outline-none focus:ring-2 focus:ring-accent/40`}
        value={formatQty(value)}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isNaN(n)) onChange(0);
          else onChange(Math.max(0, n));
        }}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className={`flex ${btn} items-center justify-center rounded-xl bg-accent text-xl font-semibold text-white hover:opacity-90 pressable focus-ring`}
        onClick={() => bump(1)}
      >
        +
      </button>
      {unit && !compact ? (
        <span className="hidden px-2 text-xs text-ink-muted sm:inline">{unit}</span>
      ) : null}
    </div>
  );
}
