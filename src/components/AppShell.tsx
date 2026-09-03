"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", label: "Stock" },
  { href: "/count", label: "Count" },
  { href: "/low-stock", label: "Low" },
  { href: "/restock", label: "Restock" },
  { href: "/add", label: "Add" },
  { href: "/data", label: "Data" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, lowStockItems, needsCountItems } = useInventory();
  const low = lowStockItems.length;
  const needs = needsCountItems.length;

  return (
    <div className="min-h-dvh bg-surface-2 text-ink">
      <header className="sticky top-0 z-40 border-b border-surface-3/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight text-ink">
              Home Inventory
            </Link>
            <p className="text-xs text-ink-muted">Stock counts · wishlist · restock</p>
          </div>
          <ThemeToggle />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-3">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const showBadge =
              (item.href === "/low-stock" && low > 0) ||
              (item.href === "/count" && needs > 0);
            const badge = item.href === "/count" ? needs : low;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
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
      <main className="mx-auto max-w-5xl px-4 py-4 pb-24">
        {!ready ? (
          <div className="rounded-2xl bg-surface p-8 text-center text-ink-muted shadow-soft">
            Loading inventory…
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
