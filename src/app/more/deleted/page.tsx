"use client";

import { useState } from "react";
import { useInventory, TRASH_DAYS } from "@/context/InventoryContext";
import type { InventoryItem } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { ActionSheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/EmptyState";
import { ItemActionRow } from "@/components/ItemListRows";
import { useToast } from "@/components/count/CountBits";

function daysLeft(item: InventoryItem) {
  if (!item.trashedAt) return TRASH_DAYS;
  return Math.max(0, Math.ceil((Date.parse(item.trashedAt) + TRASH_DAYS * 86_400_000 - Date.now()) / 86_400_000));
}

export default function RecentlyDeletedPage() {
  const { trashedItems, recoverItem, deleteItem } = useInventory();
  const [menu, setMenu] = useState<InventoryItem | null>(null);
  const [confirmNow, setConfirmNow] = useState<InventoryItem | null>(null);
  const { toast, toastNode } = useToast();

  return (
    <Page title="Recently Deleted" back={{ href: "/more", label: "More" }}>
      {toastNode}
      {trashedItems.length ? (
        <>
          <p className="px-4 pb-1.5 text-footnote text-label-2">
            Items are kept here for {TRASH_DAYS} days with their photos and purchase history, then deleted for good.
          </p>
          <ul className="ios-group glass overflow-hidden rounded-card" data-testid="deleted-list">
            {trashedItems.map((item) => {
              const d = daysLeft(item);
              return (
                <ItemActionRow
                  key={item.id}
                  item={item}
                  detail={d <= 1 ? "Deletes within a day" : `${d} days left`}
                  onActions={() => setMenu(item)}
                  trailing={
                    <Button variant="secondary" size="sm" onClick={() => { recoverItem(item.id); toast("Recovered"); }} aria-label={`Recover ${item.name}`}>
                      Recover
                    </Button>
                  }
                />
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState icon="trash" title="No Recently Deleted Items" description={`Deleted items stay here for ${TRASH_DAYS} days, so you can bring them back.`} />
      )}

      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        actions={
          menu
            ? [
                { label: "Recover", onSelect: () => { recoverItem(menu.id); toast("Recovered"); } },
                { label: "Delete Now…", destructive: true, onSelect: () => setConfirmNow(menu) },
              ]
            : []
        }
      />
      <ActionSheet
        open={Boolean(confirmNow)}
        onClose={() => setConfirmNow(null)}
        title={confirmNow ? `Delete “${confirmNow.name}” now?` : undefined}
        message="This removes the item, its photos and its purchase history from all your devices. It can’t be undone."
        actions={
          confirmNow
            ? [{ label: "Delete Now", destructive: true, onSelect: () => { deleteItem(confirmNow.id); toast("Deleted"); } }]
            : []
        }
      />
    </Page>
  );
}
