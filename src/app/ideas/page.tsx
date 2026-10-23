"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { ItemImage } from "@/components/ItemImage";
import { EmptyState } from "@/components/EmptyState";
import { itemHref } from "@/components/ItemCard";
import { Page } from "@/components/ui/Page";
import { SearchField } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { STOCK_FOLDERS, type InventoryItem } from "@/lib/types";

export default function IdeasPage() {
  const { ideaItems, moveToFolder, archiveItem, deleteItem } = useInventory();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<InventoryItem | null>(null);
  const [menu, setMenu] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...ideaItems].sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q) ||
          (i.vendor ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ideaItems, query]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <Page
      title="Ideas"
      subtitle="Saved ideas — not in stock until you add them."
      back={{ href: "/more", label: "More" }}
    >
      {toast ? (
        <div
          role="status"
          className="animate-fade-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+52px)] z-[55] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2.5 text-footnote font-semibold text-white backdrop-blur"
        >
          {toast}
        </div>
      ) : null}

      <SearchField value={query} onChange={setQuery} placeholder="Search ideas" />

      {filtered.length ? (
        <>
          <p className="px-4 pb-1.5 pt-5 text-footnote font-semibold text-label-2">
            {filtered.length} {filtered.length === 1 ? "idea" : "ideas"}
          </p>
          <ul className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
            {filtered.map((item) => (
              <li key={item.id} className="ios-row flex items-center">
                <Link href={itemHref(item.id)} className="pressable shrink-0 py-2 pl-4" aria-label={`${item.name} details`}>
                  <ItemImage item={item} className="h-11 w-11" rounded="rounded-[10px]" symbolSize={22} />
                </Link>
                <div className="ios-row-inner ml-3 flex min-h-[60px] min-w-0 flex-1 items-center gap-1 pr-2">
                  <Link href={itemHref(item.id)} className="focus-ring flex min-h-tap min-w-0 flex-1 flex-col justify-center rounded py-1">
                    <p className="truncate text-body text-label">{item.name}</p>
                    {item.vendor || item.notes ? (
                      <p className="truncate text-subhead text-label-2">{item.vendor || item.notes}</p>
                    ) : null}
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setAdding(item)} aria-label={`Add ${item.name} to stock`}>
                    Add
                  </Button>
                  <IconButton label={`More actions for ${item.name}`} onClick={() => setMenu(item)}>
                    <Icon name="ellipsis" size={22} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          icon="lightbulb"
          title={ideaItems.length === 0 ? "No Ideas Left" : "No Results"}
          description={ideaItems.length === 0 ? "Everything you saved is now in stock or archived." : "Try a different search."}
        />
      )}

      <ActionSheet
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        title={adding ? `Add ${adding.name} to…` : undefined}
        actions={STOCK_FOLDERS.map((f) => ({
          label: f,
          onSelect: () => {
            if (adding) {
              moveToFolder(adding.id, f);
              flash(`Added to ${f}`);
            }
          },
        }))}
      />

      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        actions={
          menu
            ? [
                {
                  label: "Archive",
                  onSelect: () => {
                    archiveItem(menu.id);
                    flash("Archived");
                  },
                },
                { label: "Delete…", destructive: true, onSelect: () => setConfirmDelete(menu) },
              ]
            : []
        }
      />

      <ActionSheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `Delete “${confirmDelete.name}”?` : undefined}
        message="This can’t be undone."
        actions={
          confirmDelete
            ? [
                {
                  label: "Delete Idea",
                  destructive: true,
                  onSelect: () => {
                    deleteItem(confirmDelete.id);
                    flash("Deleted");
                  },
                },
              ]
            : []
        }
      />
    </Page>
  );
}
