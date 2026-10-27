"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { useCounts } from "@/lib/counts/useCounts";
import { sessionProgress, SCOPE_LABEL, type CountScope } from "@/lib/counts/model";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CountBadge, IconTile, ListRow, ListSection } from "@/components/ui/List";
import { StartCountSheet } from "@/components/count/StartCountSheet";
import { CountRunner } from "@/components/count/CountRunner";
import { fmtDay, sessionHref, sessionSummary, sessionTitle, useToast } from "@/components/count/CountBits";

function CountHome() {
  const router = useRouter();
  const params = useSearchParams();
  const paused = params.get("view") === "home";
  const { needsCountItems, myItems } = useInventory();
  const { sessions, active, start } = useCounts();
  const [startOpen, setStartOpen] = useState(false);
  const { toast, toastNode } = useToast();

  if (active && active.status !== "cancelled" && !paused) {
    return <CountRunner session={active} onPause={() => router.push("/count/?view=home")} />;
  }

  const finished = sessions.filter((s) => s.status === "completed" || s.status === "reverted");
  const last = finished[0];
  const recent = sessions.filter((s) => s.id !== active?.id).slice(0, 3);

  const begin = (scope: CountScope) => {
    const s = start(scope);
    setStartOpen(false);
    if (!s) toast("Nothing to count");
    else router.replace("/count/");
  };

  return (
    <Page title="Count" subtitle="Start a count, step through each item, then review before anything changes">
      {toastNode}
      <div className="space-y-6">
        {active ? (
          <section className="overflow-hidden rounded-card bg-bg-grouped-2 p-4" data-testid="resume-card">
            <div className="flex items-center gap-3">
              <IconTile color="var(--tint-fill)" size={40}>
                <Icon name="checklist" size={22} strokeWidth={2} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-headline text-label">Count in Progress</p>
                <p className="text-subhead tabular-nums text-label-2">
                  {SCOPE_LABEL(active.scope)} · {sessionProgress(active).counted + sessionProgress(active).skipped} of {active.itemIds.length}
                </p>
              </div>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-fill-3" aria-hidden>
              <div
                className="h-full rounded-full bg-tint"
                style={{ width: `${((sessionProgress(active).counted + sessionProgress(active).skipped) / Math.max(1, active.itemIds.length)) * 100}%` }}
              />
            </div>
            <Button variant="primary" size="lg" block className="mt-4" onClick={() => router.push("/count/")} data-testid="resume-count">
              Resume Count
            </Button>
          </section>
        ) : (
          <section className="overflow-hidden rounded-card bg-bg-grouped-2 px-5 pb-5 pt-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tint-soft text-tint" aria-hidden>
              <Icon name="checklist" size={30} strokeWidth={2} />
            </span>
            <p className="mt-3 text-title3 text-label">{last ? `Last count ${fmtDay(last.endedAt ?? last.startedAt)}` : "No counts yet"}</p>
            <p className="mt-1 text-subhead text-label-2">
              {last ? sessionSummary(last) : `${myItems.length} items across your rooms`}
            </p>
            <Button variant="primary" size="lg" block className="mt-5" onClick={() => setStartOpen(true)} data-testid="start-count">
              Start Count
            </Button>
          </section>
        )}

        {needsCountItems.length ? (
          <ListSection footer="Items with a minimum that were never counted or are at zero.">
            <ListRow
              leading={<IconTile color="#0071e3"><Icon name="info.circle" size={18} strokeWidth={2} /></IconTile>}
              title="Need a Count"
              trailing={<CountBadge count={needsCountItems.length} tone="red" />}
            />
          </ListSection>
        ) : null}

        <ListSection
          header="History"
          headerAction={
            sessions.length ? (
              <Link href="/count/history" className="focus-ring -my-2 flex min-h-tap items-center rounded px-1 text-subhead text-tint">
                See All
              </Link>
            ) : undefined
          }
        >
          {recent.map((s) => (
            <ListRow key={s.id} href={sessionHref(s.id)} title={sessionTitle(s)} subtitle={sessionSummary(s)} chevron />
          ))}
          <ListRow
            href="/count/history"
            leading={<IconTile color="#636366"><Icon name="list" size={18} strokeWidth={2} /></IconTile>}
            title="Count Log"
            subtitle="Every count and quantity change"
            chevron
          />
        </ListSection>
      </div>

      <StartCountSheet open={startOpen} onClose={() => setStartOpen(false)} onStart={begin} />
    </Page>
  );
}

export default function CountPage() {
  return (
    <Suspense fallback={null}>
      <CountHome />
    </Suspense>
  );
}
