"use client";

import type { ComponentProps, ReactNode, SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** Grouped form row: label on the leading edge, control trailing. */
export function FieldRow({
  label,
  children,
  stacked,
}: {
  label: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <label className="ios-row block">
        <span className="ios-row-inner ml-4 block pb-2 pr-4 pt-2.5">
          <span className="block text-footnote text-label-2">{label}</span>
          {children}
        </span>
      </label>
    );
  }
  return (
    <label className="ios-row flex items-center">
      <span className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center gap-3 pr-4">
        <span className="shrink-0 text-body text-label">{label}</span>
        <span className="flex min-w-0 flex-1 justify-end">{children}</span>
      </span>
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`min-h-tap w-full min-w-0 bg-transparent text-right text-body text-label outline-none placeholder:text-label-2 ${className}`}
    />
  );
}

export function TextArea(props: ComponentProps<"textarea">) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`mt-1 w-full resize-none bg-transparent text-body text-label outline-none placeholder:text-label-2 ${className}`}
    />
  );
}

export function SelectInput({
  children,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <span className="relative flex min-w-0 items-center gap-1 text-label-2">
      <select
        {...rest}
        className={`min-h-tap min-w-0 appearance-none bg-transparent pr-5 text-right text-body text-label-2 outline-none ${className}`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-0">
        <Icon name="chevron.down" size={14} strokeWidth={2.4} />
      </span>
    </span>
  );
}
