"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { useCounts } from "@/lib/counts/useCounts";
import { getSession, patchSession } from "@/lib/counts/store";
import { reviewRows, signed, totalsFor, type ReviewRow } from "@/lib/counts/model";
import { formatQty, plural } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListRow, ListSection } from "@/components/ui/List";
import { ActionSheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { QtyChange, StatTile, sessionHref } from "@/components/count/CountBits";

function Row({ r, onTap }: { r: ReviewRow; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="ios-row pressable focus-ring flex w-full items-stretch text-left active:bg-fill-4" data-testid={`review-row-${r.itemId}`}>
      <span className="ios-row-inner ml-4 flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-2 pr-4">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-body ${r.excluded ? "text-label-2 line-through" : "text-label"}`}>{r.name}</span>
          <span className="block truncate text-footnote text-label-2">
            {r.missing
              ? "Deleted · won’t change"
              : r.excluded
                ? "Excluded · won’t change"
                : r.changedElsewhere
                  ? `Changed to ${formatQty(r.current as number)} elsewhere during this count`
                  : r.folder}
          </span>
        </span>
        {r.state === "counted" ? (
          <QtyChange from={r.current ?? r.expected} to={r.counted as number} compact />
        ) : (
          <span className="shrink-0 text-subhead text-label-2">{r.state === "skipped" ? "Skipped" : "Not counted"}</span>
        )}
        {r.changedElsewhere && !r.excluded ? (
          <span className="shrink-0 text-sys-orange" aria-label="Changed elsewhere">
            <Icon name="exclamationmark.triangle" size={17} strokeWidth={2.2} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ReviewInner() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const { items } = useInventory();
  const { end, cancel } = useCounts();
  const session = getSession(id);
  const [menu, setMenu] = useState<ReviewRow | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showMatched, setShowMatched] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  const rows = useMemo(() => (session ? reviewRows(session, items) : []), [session, items]);
  const t = totalsFor(rows);

  if (!session || (session.status !== "active" && session.status !== "reviewing")) {
    return (
      <Page title="Review" back={{ href: "/count", label: "Count" }} hideLargeTitle>
        <EmptyState
          icon="checklist"
          title="No Count to Review"
          description={session ? "This count is already finished." : undefined}
          action={
            session ? (
              <ButtonLink href={sessionHref(session.id)} variant="secondary">View Count</ButtonLink>
            ) : (
              <ButtonLink href="/count" variant="secondary">Go to Count</ButtonLink>
            )
          }
        />
      </Page>
    );
  }

  const counted = rows.filter((r) => r.state === "counted");
  const changed = counted.filter((r) => r.delta !== 0 || r.changedElsewhere || r.excluded || r.missing).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const matched = counted.filter((r) => !changed.includes(r));
  const skippedRows = rows.filter((r) => r.state === "skipped");
  const open = rows.filter((r) => r.state === "pending");
  const apply = counted.filter((r) => !r.excluded && !r.missing);
  const willChange = apply.filter((r) => r.delta !== 0).length;

  const editAt = (itemId: string) => {
    const pos = session.itemIds.indexOf(itemId);
    patchSession(session.id, { pos, status: "active" });
    router.push("/count/");
  };

  const finish = () => {
    end(session.id);
    router.replace(sessionHref(session.id, true));
  };

  return (
    <Page title="Review" back={{ href: "/count", label: "Count" }}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3" data-testid="review-totals">
          <StatTile label="Counted" value={`${t.counted}`} sub={`of ${plural(t.items, "item")}`} />
          <StatTile label="Changed" value={`${t.changed}`} sub={`${t.counted - t.changed} matched`} />
          <StatTile label="Net Difference" value={signed(t.net)} sub="units, all items" />
          <StatTile label="Total Off By" value={formatQty(t.abs)} sub="units, ignoring sign" />
        </div>

        {changed.length ? (
          <ListSection header={`Changes · ${changed.length}`} footer="Tap an item to recount it or leave it out of this count.">
            {changed.map((r) => <Row key={r.itemId} r={r} onTap={() => setMenu(r)} />)}
          </ListSection>
        ) : null}

        {skippedRows.length ? (
          <ListSection header={`Skipped · ${skippedRows.length}`} footer="Skipped items keep their current quantity. Tap one to count it now.">
            {skippedRows.map((r) => <Row key={r.itemId} r={r} onTap={() => editAt(r.itemId)} />)}
          </ListSection>
        ) : null}

        {open.length ? (
          <ListSection header={`Not Counted · ${open.length}`} footer="These keep their current quantity.">
            {showOpen ? (
              open.map((r) => <Row key={r.itemId} r={r} onTap={() => editAt(r.itemId)} />)
            ) : (
              <ListRow onClick={() => setShowOpen(true)} title={`Show ${plural(open.length, "item")}`} tint />
            )}
          </ListSection>
        ) : null}

        {matched.length ? (
          <ListSection header={`Matched · ${matched.length}`}>
            {showMatched ? (
              matched.map((r) => <Row key={r.itemId} r={r} onTap={() => setMenu(r)} />)
            ) : (
              <ListRow onClick={() => setShowMatched(true)} title={`Show ${plural(matched.length, "item")}`} tint />
            )}
          </ListSection>
        ) : null}

        <ListSection>
          <ListRow onClick={() => setConfirmCancel(true)} title="Cancel Count" destructive />
        </ListSection>

        {/* keeps the last rows clear of the sticky bar */}
        <div className="h-[76px]" aria-hidden />
      </div>

      <div className="ios-bar hairline-t fixed inset-x-0 z-40" style={{ bottom: "var(--tabbar-space)" }} data-testid="review-bar">
        <div className="mx-auto grid max-w-2xl grid-cols-[auto_1fr] items-center gap-3 px-4 py-3">
          <Button variant="plain" onClick={() => editAt(session.itemIds[Math.max(0, session.pos)] ?? session.itemIds[0])}>
            Keep Counting
          </Button>
          <Button variant="primary" size="lg" block onClick={() => setConfirmEnd(true)} data-testid="end-count">
            End Count
          </Button>
        </div>
      </div>

      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        message={menu?.changedElsewhere ? `Its quantity was changed to ${formatQty(menu.current as number)} after this count started. Ending the count sets it to what you counted.` : undefined}
        actions={
          menu
            ? [
                { label: "Recount", onSelect: () => editAt(menu.itemId) },
                ...(menu.missing
                  ? []
                  : [
                      {
                        label: menu.excluded ? "Include in This Count" : "Leave Out of This Count",
                        onSelect: () =>
                          patchSession(session.id, { lines: { [menu.itemId]: { ...session.lines[menu.itemId], excluded: !menu.excluded, at: Date.now() } } }),
                      },
                    ]),
              ]
            : []
        }
      />
      <ActionSheet
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={willChange ? `Update ${willChange} ${willChange === 1 ? "item" : "items"}?` : "End this count?"}
        message={`${apply.length} counted ${apply.length === 1 ? "item gets" : "items get"} today’s count date. Skipped and uncounted items stay as they are. You can revert this count afterwards.`}
        actions={[{ label: "End Count", onSelect: finish }]}
      />
      <ActionSheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this count?"
        message="Nothing you counted will be saved to your items. Quantities stay as they are."
        actions={[
          {
            label: "Discard Count",
            destructive: true,
            onSelect: () => {
              cancel(session.id);
              router.replace("/count/");
            },
          },
        ]}
      />
    </Page>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewInner />
    </Suspense>
  );
}
