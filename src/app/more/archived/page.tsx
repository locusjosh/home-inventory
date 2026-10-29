"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import type { InventoryItem } from "@/lib/types";
import { qtyUnit } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/Controls";
import { Button } from "@/components/ui/Button";
import { ActionSheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/EmptyState";
import { ItemActionRow } from "@/components/ItemListRows";
import { itemHref, useToast } from "@/components/count/CountBits";

export default function ArchivedPage() {
  const router = useRouter();
  const { archivedItems, archiveItem, trashItem } = useInventory();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const { toast, toastNode } = useToast();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? archivedItems.filter((i) => i.name.toLowerCase().includes(s) || i.folder.toLowerCase().includes(s)) : archivedItems;
  }, [archivedItems, q]);

  return (
    <Page title="Archived" back={{ href: "/more", label: "More" }}>
      {toastNode}
      {archivedItems.length ? (
        <>
          <SearchField value={q} onChange={setQ} placeholder="Search Archived" />
          <p className="px-4 pb-1.5 pt-5 eyebrow text-label-2">
            {list.length} {list.length === 1 ? "item" : "items"} · hidden from Stock, Count and Restock
          </p>
          {list.length ? (
            <ul className="ios-group glass overflow-hidden rounded-card" data-testid="archived-list">
              {list.map((item) => (
                <ItemActionRow
                  key={item.id}
                  item={item}
                  detail={`${item.folder === "Suggested Items" ? "Ideas" : item.folder} · ${qtyUnit(item.quantity, item.unit)}`}
                  onActions={() => setMenu(item)}
                  trailing={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        archiveItem(item.id, false);
                        toast("Unarchived");
                      }}
                      aria-label={`Unarchive ${item.name}`}
                    >
                      Unarchive
                    </Button>
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon="magnifyingglass" title="No Results" description="Try a different search." />
          )}
        </>
      ) : (
        <EmptyState icon="archivebox" title="No Archived Items" description="Items you archive are kept here, out of your lists, until you bring them back." />
      )}

      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        actions={
          menu
            ? [
                { label: "Unarchive", onSelect: () => { archiveItem(menu.id, false); toast("Unarchived"); } },
                { label: "Open Item", onSelect: () => router.push(itemHref(menu.id)) },
                { label: "Delete…", destructive: true, onSelect: () => setConfirmDelete(menu) },
              ]
            : []
        }
      />
      <ActionSheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `Delete “${confirmDelete.name}”?` : undefined}
        message="It moves to Recently Deleted, where you can recover it for 30 days."
        actions={
          confirmDelete
            ? [{ label: "Delete Item", destructive: true, onSelect: () => { trashItem(confirmDelete.id); toast("Moved to Recently Deleted"); } }]
            : []
        }
      />
    </Page>
  );
}
