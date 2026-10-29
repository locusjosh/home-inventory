"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** UISegmentedControl look; each segment ≥ 44pt tall hit area. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid rounded-[11px] bg-fill-3 p-[2px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`focus-ring min-h-tap truncate rounded-[9px] px-2 text-subhead font-semibold transition ${
              active
                ? "bg-bg-grouped-2 text-label shadow-[inset_0_1px_0_var(--glass-edge),0_3px_8px_rgba(0,0,0,0.14),0_1px_1px_rgba(0,0,0,0.06)] dark:bg-[#2c303d]"
                : "text-label"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** UISwitch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 before:absolute before:-inset-x-1 before:-inset-y-[7px] before:content-[''] ${
        checked ? "bg-sys-green-fill" : "bg-fill"
      }`}
    >
      <span
        className={`absolute left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ${
          checked ? "translate-x-[20px]" : ""
        }`}
      />
    </button>
  );
}

/** Horizontally scrolling filter chips, 44pt tall, count as trailing badge. */
export function ChipBar<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  ariaLabel?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 scrollbar-none" role="tablist" aria-label={ariaLabel}>
      <div className="flex w-max gap-2 pb-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={`pressable focus-ring inline-flex min-h-tap shrink-0 items-center gap-2 rounded-full px-4 text-subhead font-semibold ${
                active ? "bg-label text-bg-grouped-2 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]" : "glass-control text-label"
              }`}
            >
              <span>{o.label}</span>
              {o.count != null ? (
                <span
                  className={`text-caption font-semibold tabular-nums ${
                    active ? "opacity-75" : "text-label-2"
                  }`}
                >
                  {o.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** iOS search field (44pt hit area). */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="glass-control relative flex min-h-tap items-center rounded-[14px] pl-3 pr-1.5">
      <span className="shrink-0 text-label-2">
        <Icon name="magnifyingglass" size={18} strokeWidth={2.2} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="min-h-tap min-w-0 flex-1 bg-transparent px-2 text-body text-label outline-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center text-label-3"
        >
          <Icon name="xmark.circle" size={18} />
        </button>
      ) : null}
    </label>
  );
}

/** Pill-shaped status tag. */
export function StatusTag({
  tone,
  children,
}: {
  tone: "orange" | "blue" | "gray" | "green";
  children: ReactNode;
}) {
  const map = {
    orange: "text-sys-orange",
    blue: "text-tint",
    gray: "text-label-2",
    green: "text-sys-green",
  } as const;
  const dot = {
    orange: "bg-sys-orange",
    blue: "bg-tint",
    gray: "bg-label-3",
    green: "bg-sys-green",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 text-footnote font-semibold ${map[tone]}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${dot[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

/** Compact quantity stepper: tinted − / value / + (44pt hit targets). */
export function MiniStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const fmt = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return (
    <div className="glass-control flex items-center justify-between rounded-full" role="group" aria-label={`${label} quantity`}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="pressable focus-ring flex h-11 w-11 items-center justify-center rounded-full text-tint disabled:text-label-3"
      >
        <Icon name="minus" size={18} strokeWidth={2.4} />
      </button>
      <span className="min-w-[2ch] text-center text-headline tabular-nums text-label" aria-live="polite">
        {fmt}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(value + 1)}
        className="pressable focus-ring flex h-11 w-11 items-center justify-center rounded-full text-tint"
      >
        <Icon name="plus" size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}
