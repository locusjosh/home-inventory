"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "gray" | "destructive" | "plain" | "plain-destructive";
export type ButtonSize = "lg" | "md" | "sm";

const base =
  "pressable focus-ring inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  lg: "min-h-[52px] rounded-[16px] px-5 text-headline",
  md: "min-h-tap rounded-[13px] px-4 text-body font-semibold",
  sm: "min-h-tap rounded-full px-3.5 text-subhead font-semibold",
};

/**
 * Disabled state never uses opacity on a filled button: it switches to a
 * neutral fill + secondary label so contrast stays ≥ 4.5:1.
 */
const variants: Record<ButtonVariant, string> = {
  primary: "accent-fill",
  secondary:
    "bg-tint-soft text-tint disabled:bg-fill-3 disabled:text-label-2",
  gray: "glass-control text-label disabled:text-label-2",
  destructive:
    "glass-control text-sys-red-text disabled:text-label-2",
  plain: "bg-transparent text-tint disabled:text-label-2",
  "plain-destructive": "bg-transparent text-sys-red-text disabled:text-label-2",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export function buttonClass({
  variant = "primary",
  size = "md",
  block,
  className = "",
}: Omit<CommonProps, "children">) {
  return `${base} ${sizes[size]} ${variants[variant]} ${block ? "w-full" : ""} ${className}`;
}

export function Button({
  variant,
  size,
  block,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass({ variant, size, block, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  block,
  className,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, className })}>
      {children}
    </Link>
  );
}

/** Round icon button (44pt hit target). */
export function IconButton({
  label,
  children,
  className = "",
  tone = "tint",
  filled = false,
  ...rest
}: {
  label: string;
  children: ReactNode;
  className?: string;
  tone?: "tint" | "label" | "red";
  filled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const color =
    tone === "tint" ? "text-tint" : tone === "red" ? "text-sys-red-text" : "text-label";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`pressable focus-ring inline-flex h-11 min-w-11 items-center justify-center rounded-full ${
        filled ? "glass-control" : ""
      } ${color} disabled:text-label-3 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
