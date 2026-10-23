"use client";

import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemImage } from "@/components/ItemImage";
import { EmptyState } from "@/components/EmptyState";
import { itemHref } from "@/components/ItemCard";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { formatQty, needToBuy } from "@/lib/utils";

export default function LowStockPage() {
  const { lowStockItems } = useInventory();
  const sorted = [...lowStockItems].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page
      title="Low Stock"
      subtitle={`${lowStockItems.length} below their minimum`}
      back={{ href: "/more", label: "More" }}
      actions={
        lowStockItems.length ? (
          <Link href="/restock" className="pressable focus-ring flex min-h-tap items-center px-2 text-body text-tint">
            Restock
          </Link>
        ) : null
      }
    >
      {sorted.length ? (
        <ListSection>
          {sorted.map((item) => (
            <ListRow
              key={item.id}
              href={itemHref(item.id)}
              leading={<ItemImage item={item} className="h-12 w-12" rounded="rounded-[8px]" symbolSize={22} />}
              title={item.name}
              subtitle={`Have ${formatQty(item.quantity)} · keep ${item.minLevel ?? 0} · buy ${formatQty(needToBuy(item))}`}
              chevron
            />
          ))}
        </ListSection>
      ) : (
        <EmptyState icon="checkmark.circle" title="Nothing Is Low" description="Stock levels look healthy." />
      )}
    </Page>
  );
}
