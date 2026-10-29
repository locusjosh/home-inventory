"use client";

import { useMemo, useState } from "react";
import { useCounts } from "@/lib/counts/useCounts";
import { shortDevice, type CountEntry } from "@/lib/counts/model";
import { Page } from "@/components/ui/Page";
import { IconTile, ListRow, ListSection } from "@/components/ui/List";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl, StatusTag } from "@/components/ui/Controls";
import { EmptyState } from "@/components/EmptyState";
import { QtyChange, entrySourceLabel, fmtDay, fmtTime, itemHref, sessionHref, sessionSummary, sessionTitle } from "@/components/count/CountBits";

type Tab = "counts" | "log";

function groupByDay(entries: CountEntry[]) {
  const out: { day: string; list: CountEntry[] }[] = [];
  for (const e of entries) {
    const day = fmtDay(e.at);
    const g = out[out.length - 1];
    if (g && g.day === day) g.list.push(e);
    else out.push({ day, list: [e] });
  }
  return out;
}

export default function CountHistoryPage() {
  const { sessions, entries } = useCounts();
  const [tab, setTab] = useState<Tab>("counts");
  const [limit, setLimit] = useState(150);
  // Items a count confirmed with no change (e.g. 0 → 0) are listed on that count's page, not in the change log.
  const changes = useMemo(() => entries.filter((e) => !(e.source === "count" && e.delta === 0)), [entries]);
  const days = useMemo(() => groupByDay(changes.slice(0, limit)), [changes, limit]);

  return (
    <Page title="Count History" back={{ href: "/count", label: "Count", useHistory: true }}>
      <div className="space-y-5">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          ariaLabel="Show"
          options={[
            { value: "counts", label: "Counts" },
            { value: "log", label: "All Changes" },
          ]}
        />

        {tab === "counts" ? (
          sessions.length ? (
            <>
            <section className="glass glass-lift flex items-center gap-3.5 rounded-card px-4 py-4" data-testid="history-summary">
              <IconTile color="var(--tint-fill)" size={44}>
                <Icon name="checklist" size={24} strokeWidth={2} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-title3 tabular-nums text-label">
                  {sessions.length} {sessions.length === 1 ? "count" : "counts"}
                </p>
                <p className="text-subhead text-label-2">
                  {(() => {
                    const done = sessions.find((x) => x.status === "completed" || x.status === "reverted");
                    return done ? `Last finished ${fmtDay(done.endedAt ?? done.startedAt)}` : "None finished yet";
                  })()}
                </p>
              </div>
            </section>
            <ListSection>
              {sessions.map((s) => (
                <ListRow
                  key={s.id}
                  leading={
                    s.status === "completed" ? <IconTile color="var(--green-fill)"><Icon name="checkmark" size={17} strokeWidth={2.6} /></IconTile>
                    : s.status === "reverted" ? <IconTile color="var(--orange-fill)"><Icon name="arrow.counterclockwise" size={17} strokeWidth={2.4} /></IconTile>
                    : s.status === "cancelled" ? <IconTile color="#8e8e93"><Icon name="xmark" size={16} strokeWidth={2.6} /></IconTile>
                    : <IconTile color="var(--tint-fill)"><Icon name="checklist" size={17} strokeWidth={2.2} /></IconTile>
                  }
                  href={sessionHref(s.id)}
                  title={sessionTitle(s)}
                  subtitle={sessionSummary(s)}
                  trailing={
                    s.status === "cancelled" ? <StatusTag tone="gray">Cancelled</StatusTag>
                    : s.status === "reverted" ? <StatusTag tone="orange">Reverted</StatusTag>
                    : s.status === "active" || s.status === "reviewing" ? <StatusTag tone="blue">In Progress</StatusTag>
                    : undefined
                  }
                  chevron
                />
              ))}
            </ListSection>
            </>
          ) : (
            <EmptyState icon="checklist" title="No Counts Yet" description="Counts you start from the Count tab show up here." />
          )
        ) : changes.length ? (
          <div className="space-y-5" data-testid="count-log">
            {days.map((g) => (
              <ListSection key={g.day} header={g.day}>
                {g.list.map((e) => (
                  <ListRow
                    key={e.id}
                    href={itemHref(e.itemId)}
                    title={e.itemName}
                    subtitle={<span className="block truncate">{`${entrySourceLabel(e)} · ${fmtTime(e.at)} · ${shortDevice(e.deviceLabel)}`}</span>}
                    trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />}
                  />
                ))}
              </ListSection>
            ))}
            {changes.length > limit ? (
              <ListSection>
                <ListRow onClick={() => setLimit((n) => n + 300)} title="Show More" tint />
              </ListSection>
            ) : null}
          </div>
        ) : (
          <EmptyState icon="list" title="No Changes Yet" description="Counts and quantity changes are logged here from now on." />
        )}
      </div>
    </Page>
  );
}
