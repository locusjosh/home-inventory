"use client";

import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";

const links = [
  {
    href: "/ideas",
    title: "Ideas",
    desc: "Wishlist items — not stock until you move them",
    badgeKey: "ideas" as const,
  },
  {
    href: "/low-stock",
    title: "Low stock",
    desc: "Everything below its min level",
    badgeKey: "low" as const,
  },
  {
    href: "/receipt",
    title: "Scan receipt",
    desc: "OCR allocate purchases to inventory",
  },
  {
    href: "/add",
    title: "Add item",
    desc: "Create a new stock or idea item",
  },
  {
    href: "/data",
    title: "Data & backup",
    desc: "Export, import, reset, install tips",
  },
];

export default function MorePage() {
  const { lowStockItems, ideaItems } = useInventory();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">More</h1>
        <p className="mt-1 text-sm text-ink-muted">Ideas, receipts, and tools</p>
      </div>

      <div className="space-y-2">
        {links.map((l) => {
          const badge =
            l.badgeKey === "ideas"
              ? ideaItems.length
              : l.badgeKey === "low"
                ? lowStockItems.length
                : 0;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="card-lux flex items-center gap-4 px-4 py-4 pressable focus-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{l.title}</p>
                  {badge > 0 ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{l.desc}</p>
              </div>
              <span className="text-ink-muted" aria-hidden>
                →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
