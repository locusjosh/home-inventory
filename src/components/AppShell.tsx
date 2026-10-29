"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Icon, type IconName } from "./ui/Icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Stock", icon: "square.grid" },
  { href: "/count", label: "Count", icon: "checklist" },
  { href: "/restock", label: "Restock", icon: "cart" },
  { href: "/assist", label: "Assistant", icon: "waveform" },
  { href: "/more", label: "More", icon: "ellipsis.circle" },
];

/** Routes that live under the More tab. */
const MORE_NESTED = ["/ideas", "/low-stock", "/receipt", "/add", "/data"];

function HydrationSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-14" aria-busy="true" aria-label="Loading inventory">
      <div className="skeleton h-10 w-40" />
      <div className="skeleton mt-2 h-5 w-32" />
      <div className="skeleton mt-6 h-11 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-card p-2.5">
            <div className="skeleton aspect-square w-full" />
            <div className="skeleton mt-3 h-4 w-3/4" />
            <div className="skeleton mt-2 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { ready, lowStockItems, needsCountItems } = useInventory();
  const low = lowStockItems.length;
  // Remember the current screen; nested pages read it (before this effect
  // runs for the new route) to label their back button with the prior title.
  useEffect(() => {
    try {
      sessionStorage.setItem("hi-current-path", pathname);
    } catch {
      /* ignore */
    }
  }, [pathname]);
  const needs = needsCountItems.length;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/more") {
      return (
        pathname.startsWith("/more") ||
        MORE_NESTED.some((p) => pathname === p || pathname.startsWith(p + "/"))
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="min-h-dvh text-label">
      <main className="pb-[calc(var(--tabbar-space)+20px)]">
        {!ready ? <HydrationSkeleton /> : <div className="animate-fade-up">{children}</div>}
      </main>

      <nav
        className="ios-bar glass-float fixed inset-x-3 z-50 mx-auto max-w-md"
        style={{ bottom: "var(--tabbar-gap)" }}
        aria-label="Tabs"
      >
        <div className="grid h-[var(--tabbar-h)] grid-cols-5 px-1">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            const badge = tab.href === "/count" ? needs : tab.href === "/restock" ? low : 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`pressable focus-ring relative flex min-h-tap flex-col items-center justify-center gap-[3px] rounded-[22px] ${
                  active ? "text-tint" : "text-label-2"
                }`}
              >
                {active ? (
                  <span className="absolute inset-x-0.5 inset-y-1 rounded-[20px] bg-tint-soft shadow-[inset_0_1px_0_var(--glass-edge)]" aria-hidden />
                ) : null}
                <span className="relative flex h-[26px] items-center justify-center">
                  <Icon name={tab.icon} size={26} strokeWidth={active ? 2.1 : 1.7} />
                  {badge > 0 ? (
                    <span
                      className="absolute -top-1 left-[calc(50%+6px)] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sys-red px-[5px] text-caption font-bold tabular-nums text-white shadow-[0_0_0_2px_var(--bar-solid)]"
                      aria-label={`${badge} ${tab.href === "/count" ? "to count" : "low"}`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className={`relative text-caption2 leading-none tracking-[0.1px] sm:text-caption ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
