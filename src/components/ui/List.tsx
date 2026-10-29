"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** iOS inset grouped section: optional header + rounded group + optional footer. */
export function ListSection({
  header,
  footer,
  children,
  className = "",
  headerAction,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}) {
  return (
    <section className={className}>
      {header || headerAction ? (
        <div className="flex min-h-[28px] items-end justify-between gap-3 px-4 pb-1.5">
          {header ? (
            <h2 className={`${typeof header === "string" && header.trim().split(/\s+/).length > 3 ? "eyebrow-long" : "eyebrow"} text-label-2`}>{header}</h2>
          ) : (
            <span />
          )}
          {headerAction}
        </div>
      ) : null}
      <div className="ios-group glass overflow-hidden rounded-card">{children}</div>
      {footer ? <p className="px-4 pt-1.5 text-footnote text-label-2">{footer}</p> : null}
    </section>
  );
}

/** Rounded-square symbol tile, Settings style. */
export function IconTile({
  children,
  color = "var(--tint)",
  size = 30,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[9px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
      style={{ width: size, height: size, background: `linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 55%), ${color}` }}
      aria-hidden
    >
      {children}
    </span>
  );
}

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  tint?: boolean;
  className?: string;
  /** Leading inset for separator alignment */
  multiline?: boolean;
  ariaLabel?: string;
  /** Render as <label for=…> to open a (visually hidden) file input from the tap itself. */
  htmlFor?: string;
};

/** Single list row. Hairline separator is inset to the text column. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  value,
  href,
  onClick,
  chevron,
  destructive,
  tint,
  className = "",
  ariaLabel,
  htmlFor,
}: RowProps) {
  const interactive = Boolean(href || onClick || htmlFor);
  const titleColor = destructive ? "text-sys-red-text" : tint ? "text-tint" : "text-label";
  const body = (
    <>
      {leading ? <span className="flex shrink-0 items-center py-2 pl-4">{leading}</span> : null}
      <span
        className={`ios-row-inner flex min-h-tap min-w-0 flex-1 items-center gap-3 py-[11px] pr-4 ${
          leading ? "ml-3" : "ml-4"
        }`}
      >
        <span className="min-w-0 flex-1 text-left">
          <span className={`block text-body ${titleColor}`}>{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-subhead text-label-2">{subtitle}</span>
          ) : null}
        </span>
        {value != null ? (
          <span className="shrink-0 text-body text-label-2">{value}</span>
        ) : null}
        {trailing}
        {chevron ? (
          <span className="-mr-1 shrink-0 text-label-3">
            <Icon name="chevron.right" size={18} strokeWidth={2.4} />
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = `ios-row flex w-full items-stretch ${
    interactive ? "pressable focus-ring active:bg-fill-4" : ""
  } ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} role="button" className={`${cls} cursor-pointer`} aria-label={ariaLabel}>
        {body}
      </label>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Gray count capsule (non-actionable) or red (actionable). */
export function CountBadge({ count, tone = "gray" }: { count: number; tone?: "gray" | "red" }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-2 text-subhead font-semibold tabular-nums ${
        tone === "red" ? "bg-sys-red text-white" : "bg-fill-3 text-label-2"
      }`}
    >
      {count > 999 ? "999+" : count}
    </span>
  );
}
