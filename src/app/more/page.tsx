"use client";

import { useEffect, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { Switch } from "@/components/ui/Controls";
import { readSolidSurfaces, writeSolidSurfaces } from "@/lib/solidSurfaces";
import { Page } from "@/components/ui/Page";
import { CountBadge, IconTile, ListRow, ListSection } from "@/components/ui/List";
import { Icon } from "@/components/ui/Icon";
import { SyncSection } from "@/components/SyncSection";

export default function MorePage() {
  const { lowStockItems, ideaItems, archivedItems, trashedItems } = useInventory();
  const [solid, setSolid] = useState(false);
  useEffect(() => setSolid(readSolidSurfaces()), []);

  return (
    <Page title="More">
      <div className="space-y-6">
        <ListSection>
          <ListRow
            href="/low-stock"
            leading={<IconTile color="#c93400"><Icon name="exclamationmark.triangle" size={18} strokeWidth={2} /></IconTile>}
            title="Low Stock"
            trailing={<CountBadge count={lowStockItems.length} tone="red" />}
            chevron
          />
          <ListRow
            href="/ideas"
            leading={<IconTile color="#a86f00"><Icon name="lightbulb" size={18} strokeWidth={2} /></IconTile>}
            title="Ideas"
            trailing={<CountBadge count={ideaItems.length} />}
            chevron
          />
        </ListSection>

        <ListSection>
          <ListRow
            href="/receipt"
            leading={<IconTile color="#248a3d"><Icon name="receipt" size={18} strokeWidth={2} /></IconTile>}
            title="Scan Receipt"
            chevron
          />
          <ListRow
            href="/add"
            leading={<IconTile color="#0071e3"><Icon name="plus" size={18} strokeWidth={2.4} /></IconTile>}
            title="Add Item"
            chevron
          />
        </ListSection>

        <ListSection>
          <ListRow
            href="/count/history"
            leading={<IconTile color="#5e5ce6"><Icon name="list" size={18} strokeWidth={2} /></IconTile>}
            title="Count History"
            chevron
          />
          <ListRow
            href="/more/archived"
            leading={<IconTile color="#8e8e93"><Icon name="archivebox" size={18} strokeWidth={2} /></IconTile>}
            title="Archived"
            trailing={<CountBadge count={archivedItems.length} />}
            chevron
          />
          <ListRow
            href="/more/deleted"
            leading={<IconTile color="#d70015"><Icon name="trash" size={18} strokeWidth={2} /></IconTile>}
            title="Recently Deleted"
            trailing={<CountBadge count={trashedItems.length} />}
            chevron
          />
        </ListSection>

        <SyncSection />

        <ListSection header="Display" footer="Turns off the see-through glass on this device only. It isn’t synced.">
          <ListRow
            leading={<IconTile color="#3d5af1"><Icon name="circle.lefthalf" size={18} strokeWidth={2} /></IconTile>}
            title="Solid Surfaces"
            trailing={
              <span data-testid="solid-surfaces">
                <Switch
                  checked={solid}
                  label="Solid Surfaces"
                  onChange={(v) => {
                    setSolid(v);
                    writeSolidSurfaces(v);
                  }}
                />
              </span>
            }
          />
        </ListSection>

        <ListSection>
          <ListRow
            href="/data"
            leading={<IconTile color="#636366"><Icon name="externaldrive" size={18} strokeWidth={2} /></IconTile>}
            title="Data & Backup"
            chevron
          />
        </ListSection>
      </div>
    </Page>
  );
}
