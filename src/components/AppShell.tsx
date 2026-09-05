"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { ThemeToggle } from "./ThemeToggle";

const primaryTabs = [
  { href: "/", label: "Stock", icon: "stock" },
  { href: "/count", label: "Count", icon: "count" },
  { href: "/restock", label: "Restock", icon: "restock" },
  { href: "/assist", label: "Assist", icon: "assist" },
  { href: "/more", label: "More", icon: "more" },
] as const;

const desktopNav = [
  { href: "/", label: "Stock" },
  { href: "/ideas", label: "Ideas" },
  { href: "/count", label: "Count" },
  { href: "/low-stock", label: "Low" },
  { href: "/restock", label: "Restock" },
  { href: "/receipt", label: "Receipt" },
  { href: "/add", label: "Add" },
  { href: "/assist", label: "Assist", accent: true },
  { href: "/data", label: "Data" },
];

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "stock":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7" height="7" rx="1.5" />
          <rect x="14" y="4" width="7" height="7" rx="1.5" />
          <rect x="3" y="13" width="7" height="7" rx="1.5" />
          <rect x="14" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "count":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "restock":
      return (
        <svg {...common}>
          <path d="M6 6h15l-1.5 9H8L6 6Z" />
          <path d="M6 6 5 3H2" />
          <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "assist":
      return (
        <svg {...common}>
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, lowStockItems, needsCountItems, ideaItems } = useInventory();
  const low = lowStockItems.length;
  const needs = needsCountItems.length;
  const ideas = ideaItems.length;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/more"
        ? ["/more", "/ideas", "/low-stock", "/receipt", "/add", "/data"].some(
            (p) => pathname === p || pathname.startsWith(p + "/")
          )
        : pathname.startsWith(href);

  return (
    <div className="min-h-dvh text-ink">
      <header className="sticky top-0 z-40 glass-nav border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
              Home Inventory
            </Link>
            <p className="truncate text-xs text-ink-muted">Calm stock · restock · assist</p>
          </div>
          <ThemeToggle />
        </div>
        {/* Desktop nav */}
        <nav className="mx-auto hidden max-w-5xl gap-1 overflow-x-auto px-3 pb-3 scrollbar-none md:flex">
          {desktopNav.map((item) => {
            const active = isActive(item.href);
            const showBadge =
              (item.href === "/low-stock" && low > 0) ||
              (item.href === "/count" && needs > 0) ||
              (item.href === "/ideas" && ideas > 0);
            const badge =
              item.href === "/count" ? needs : item.href === "/ideas" ? ideas : low;
            const isAssist = item.href === "/assist";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium pressable focus-ring ${
                  active
                    ? isAssist
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lux"
                      : "bg-accent text-white shadow-soft"
                    : isAssist
                      ? "bg-accent-soft/70 text-accent ring-1 ring-accent/20"
                      : "bg-surface/80 text-ink-muted hover:bg-surface-3/60 hover:text-ink"
                }`}
              >
                {item.label}
                {showBadge ? (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-[max(7.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] md:pb-10">
        {!ready ? (
          <div className="card-lux p-10 text-center text-ink-muted">Loading inventory…</div>
        ) : (
          <div className="animate-fade-up">{children}</div>
        )}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-3/70 bg-[rgb(var(--glass)/0.85)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 pt-1.5">
          {primaryTabs.map((tab) => {
            const active = isActive(tab.href);
            const badge =
              tab.href === "/count" && needs > 0
                ? needs
                : tab.href === "/restock" && low > 0
                  ? low
                  : tab.href === "/more" && ideas > 0
                    ? ideas
                    : 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex min-h-tap flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium pressable focus-ring ${
                  active ? "text-accent" : "text-ink-muted"
                }`}
              >
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl ${
                    active ? "bg-accent-soft text-accent" : ""
                  }`}
                >
                  <TabIcon name={tab.icon} active={active} />
                  {badge > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[9px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
