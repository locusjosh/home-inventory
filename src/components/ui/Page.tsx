"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { SyncIndicator } from "../SyncIndicator";

type Back = { href: string; label: string; useHistory?: boolean };

const TITLES: Record<string, string> = {
  "/": "Stock",
  "/count": "Count",
  "/restock": "Restock",
  "/assist": "Assistant",
  "/more": "More",
  "/ideas": "Ideas",
  "/low-stock": "Low Stock",
  "/receipt": "Receipt",
  "/data": "Data",
  "/add": "New Item",
  "/count/history": "History",
  "/count/item": "Item History",
  "/count/session": "Count",
  "/count/review": "Review",
  "/more/archived": "Archived",
  "/more/deleted": "Recently Deleted",
};

function prevTitle(current: string): string | null {
  try {
    const p = sessionStorage.getItem("hi-current-path");
    if (!p) return null;
    const clean = p.replace(/\/$/, "") || "/";
    const here = current.replace(/\/$/, "") || "/";
    if (clean === here) return null;
    return TITLES[clean] ?? null;
  } catch {
    return null;
  }
}

/**
 * iOS screen scaffold: a translucent navigation bar that is transparent at
 * rest and gains material + an inline title once the large title scrolls
 * away, followed by the 34pt large title and the screen content.
 */
export function Page({
  title,
  subtitle,
  back,
  leading,
  actions,
  children,
  hideLargeTitle,
  contentClassName = "",
}: {
  title: string;
  subtitle?: ReactNode;
  back?: Back;
  /** Custom leading bar item (used instead of a back button). */
  leading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hideLargeTitle?: boolean;
  contentClassName?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [backLabel, setBackLabel] = useState(back?.label ?? "");
  const router = useRouter();
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (back?.useHistory) setBackLabel(prevTitle(pathname) ?? back.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back?.useHistory, back?.label]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showBar = Boolean(back || actions || leading) || scrolled;
  const inlineTitle = hideLargeTitle || scrolled;

  return (
    <div>
      <div
        className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-200 ${
          scrolled ? "ios-bar hairline-b" : ""
        } ${showBar ? "" : "pointer-events-none"}`}
        style={{ paddingTop: "var(--sat)" }}
      >
        <div className="relative mx-auto flex h-11 max-w-2xl items-center justify-between px-2">
          <div className="z-10 flex min-w-0 items-center">
            {leading ? leading : back ? (
              back.useHistory ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1) router.back();
                    else router.push(back.href);
                  }}
                  className="pressable focus-ring flex h-11 items-center gap-0.5 rounded-lg pr-2 text-body text-tint"
                >
                  <Icon name="chevron.left" size={24} strokeWidth={2.2} />
                  <span className="max-w-[9rem] truncate">{backLabel}</span>
                </button>
              ) : (
                <Link
                  href={back.href}
                  className="pressable focus-ring flex h-11 items-center gap-0.5 rounded-lg pr-2 text-body text-tint"
                >
                  <Icon name="chevron.left" size={24} strokeWidth={2.2} />
                  <span className="max-w-[9rem] truncate">{back.label}</span>
                </Link>
              )
            ) : null}
          </div>
          <div
            className={`pointer-events-none absolute inset-x-24 truncate text-center text-headline text-label transition-opacity duration-200 ${
              inlineTitle ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!inlineTitle}
          >
            {title}
          </div>
          <div className="z-10 flex items-center gap-1">{actions}</div>
        </div>
      </div>

      {!hideLargeTitle ? (
        <header className="mx-auto max-w-2xl px-4 pb-3 pt-1">
          <div className="flex items-end justify-between gap-2">
            <h1 className="min-w-0 text-large-title text-label">{title}</h1>
            <span className="-mb-1 -mr-2 shrink-0">
              <SyncIndicator />
            </span>
          </div>
          {subtitle ? <p className="mt-0.5 text-subhead text-label-2">{subtitle}</p> : null}
        </header>
      ) : null}

      <div className={`mx-auto max-w-2xl px-4 ${contentClassName}`}>{children}</div>
    </div>
  );
}
