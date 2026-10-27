"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCounts } from "@/lib/counts/useCounts";
import { getSession } from "@/lib/counts/store";
import { SCOPE_LABEL, sessionProgress, signed } from "@/lib/counts/model";
import { formatQty } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListRow, ListSection } from "@/components/ui/List";
import { ActionSheet } from "@/components/ui/Sheet";
import { StatusTag } from "@/components/ui/Controls";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { QtyChange, StatTile, fmtDay, fmtDuration, fmtTime, itemHref, useToast } from "@/components/count/CountBits";

function SessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const justDone = params.get("done") === "1";
  const { entries, revert } = useCounts();
  const s = getSession(id);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [showSame, setShowSame] = useState(false);
  const { toast, toastNode } = useToast();

  if (!s) {
    return (
      <Page title="Count" back={{ href: "/count/history", label: "History" }} hideLargeTitle>
        <EmptyState icon="checklist" title="Count Not Found" action={<ButtonLink href="/count/history" variant="secondary">Count History</ButtonLink>} />
      </Page>
    );
  }

  const mine = entries.filter((e) => e.sessionId === s.id && e.source === "count");
  const reverts = entries.filter((e) => e.sessionId === s.id && e.source === "revert");
  const changedEntries = mine.filter((e) => e.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const same = mine.filter((e) => e.delta === 0);
  const t = s.totals;
  const prog = sessionProgress(s);
  const finished = s.status === "completed" || s.status === "reverted";

  const statusTag =
    s.status === "completed" ? <StatusTag tone="green">Completed</StatusTag>
    : s.status === "reverted" ? <StatusTag tone="orange">Reverted</StatusTag>
    : s.status === "cancelled" ? <StatusTag tone="gray">Cancelled</StatusTag>
    : <StatusTag tone="blue">In Progress</StatusTag>;

  return (
    <Page
      title={justDone ? "Count Complete" : fmtDay(s.startedAt)}
      back={justDone ? undefined : { href: "/count/history", label: "History", useHistory: true }}
      hideLargeTitle={!justDone}
    >
      {toastNode}
      <div className="space-y-6 pt-2">
        {justDone ? (
          <div className="flex flex-col items-center pt-2 text-center" data-testid="count-complete">
            <span className="animate-pop-in flex h-16 w-16 items-center justify-center rounded-full bg-sys-green text-white" aria-hidden>
              <Icon name="checkmark" size={34} strokeWidth={3} />
            </span>
            <p className="mt-3 text-subhead text-label-2">
              {SCOPE_LABEL(s.scope)} · {fmtDuration(s.startedAt, s.endedAt)}
            </p>
          </div>
        ) : (
          <div className="rounded-card bg-bg-grouped-2 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-headline text-label">{SCOPE_LABEL(s.scope)}</p>
              {statusTag}
            </div>
            <p className="mt-1 text-subhead text-label-2">
              Started {fmtTime(s.startedAt)}
              {s.endedAt ? ` · ${s.status === "cancelled" ? "cancelled" : "ended"} ${fmtTime(s.endedAt)}` : ""}
              {s.endedAt && s.status !== "cancelled" ? ` · ${fmtDuration(s.startedAt, s.endedAt)}` : ""}
            </p>
            <p className="text-subhead text-label-2">{s.deviceLabel}</p>
          </div>
        )}

        {finished && t ? (
          <div className="grid grid-cols-2 gap-3" data-testid="summary-totals">
            <StatTile label="Counted" value={t.counted} sub={`of ${t.items} items`} />
            <StatTile label="Changed" value={t.changed} sub={t.changed === 1 ? "item" : "items"} />
            <StatTile label="Skipped" value={t.skipped} sub="kept as they were" />
            <StatTile label="Net Difference" value={signed(t.net)} sub={`${formatQty(t.abs)} units off in total`} />
          </div>
        ) : s.status === "cancelled" ? (
          <p className="rounded-card bg-bg-grouped-2 px-4 py-4 text-subhead text-label-2">
            This count was cancelled after {prog.counted} of {prog.total} items. No quantities were changed.
          </p>
        ) : (
          <div className="rounded-card bg-bg-grouped-2 px-4 py-4">
            <p className="text-subhead text-label-2">{prog.counted} counted · {prog.skipped} skipped · {prog.pending} left</p>
            <Button variant="primary" block className="mt-3" onClick={() => router.push("/count/")}>Resume Count</Button>
          </div>
        )}

        {changedEntries.length ? (
          <ListSection header={`Changes · ${changedEntries.length}`}>
            {changedEntries.map((e) => (
              <ListRow key={e.id} href={itemHref(e.itemId)} title={e.itemName} trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />} />
            ))}
          </ListSection>
        ) : null}

        {same.length ? (
          <ListSection header={`No Change · ${same.length}`}>
            {showSame ? (
              same.map((e) => <ListRow key={e.id} href={itemHref(e.itemId)} title={e.itemName} value={formatQty(e.newQty)} />)
            ) : (
              <ListRow onClick={() => setShowSame(true)} title={`Show ${same.length} items`} tint />
            )}
          </ListSection>
        ) : null}

        {reverts.length ? (
          <ListSection header="Reverted" footer="These items went back to their quantity from before the count.">
            {reverts.map((e) => (
              <ListRow key={e.id} href={itemHref(e.itemId)} title={e.itemName} trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />} />
            ))}
          </ListSection>
        ) : null}

        <div className="space-y-2 pb-2">
          {justDone ? (
            <Button variant="primary" size="lg" block onClick={() => router.replace("/count/")} data-testid="summary-done">
              Done
            </Button>
          ) : null}
          {s.status === "completed" ? (
            <Button variant="plain-destructive" block onClick={() => setConfirmRevert(true)} data-testid="revert-count">
              Revert This Count
            </Button>
          ) : null}
        </div>
      </div>

      <ActionSheet
        open={confirmRevert}
        onClose={() => setConfirmRevert(false)}
        title="Revert this count?"
        message="Items go back to the quantity they had before this count. Any item you’ve changed since is left alone."
        actions={[
          {
            label: "Revert Count",
            destructive: true,
            onSelect: () => {
              const r = revert(s.id);
              if (r) toast(r.skipped.length ? `Reverted ${r.reverted} · ${r.skipped.length} changed since, kept` : `Reverted ${r.reverted} ${r.reverted === 1 ? "item" : "items"}`);
            },
          },
        ]}
      />
    </Page>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionInner />
    </Suspense>
  );
}
