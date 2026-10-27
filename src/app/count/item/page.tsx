"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { useCounts } from "@/lib/counts/useCounts";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { EmptyState } from "@/components/EmptyState";
import { QtyChange, entrySourceLabel, fmtDay, fmtTime, sessionHref } from "@/components/count/CountBits";

function ItemHistoryInner() {
  const id = useSearchParams().get("id") ?? "";
  const { items } = useInventory();
  const { entries } = useCounts();
  const item = items.find((i) => i.id === id);
  const list = entries.filter((e) => e.itemId === id);
  const name = item?.name ?? list[0]?.itemName ?? "Item";

  return (
    <Page title={name} back={{ href: `/items/edit/?id=${encodeURIComponent(id)}`, label: "Item", useHistory: true }}>
      {list.length ? (
        <ListSection header="Count History" footer={item?.lastCountedAt ? `Last counted ${fmtDay(item.lastCountedAt, true)}.` : undefined}>
          {list.map((e) => (
            <ListRow
              key={e.id}
              href={e.sessionId ? sessionHref(e.sessionId) : undefined}
              title={`${fmtDay(e.at)} · ${fmtTime(e.at)}`}
              subtitle={`${entrySourceLabel(e)} · ${e.deviceLabel}`}
              trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />}
              chevron={Boolean(e.sessionId)}
            />
          ))}
        </ListSection>
      ) : (
        <EmptyState
          icon="list"
          title="No History Yet"
          description={item?.lastCountedAt ? `Last counted ${fmtDay(item.lastCountedAt, true)}, before the count log existed.` : "Counts and quantity changes for this item will show up here."}
        />
      )}
    </Page>
  );
}

export default function ItemHistoryPage() {
  return (
    <Suspense fallback={null}>
      <ItemHistoryInner />
    </Suspense>
  );
}
