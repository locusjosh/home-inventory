"use client";

import { useMemo, useState } from "react";
import { useCounts } from "@/lib/counts/useCounts";
import type { CountEntry } from "@/lib/counts/model";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
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
  const days = useMemo(() => groupByDay(entries.slice(0, limit)), [entries, limit]);

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
            <ListSection>
              {sessions.map((s) => (
                <ListRow
                  key={s.id}
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
          ) : (
            <EmptyState icon="checklist" title="No Counts Yet" description="Counts you start from the Count tab show up here." />
          )
        ) : entries.length ? (
          <div className="space-y-5" data-testid="count-log">
            {days.map((g) => (
              <ListSection key={g.day} header={g.day}>
                {g.list.map((e) => (
                  <ListRow
                    key={e.id}
                    href={itemHref(e.itemId)}
                    title={e.itemName}
                    subtitle={`${entrySourceLabel(e)} · ${fmtTime(e.at)} · ${e.deviceLabel}`}
                    trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />}
                  />
                ))}
              </ListSection>
            ))}
            {entries.length > limit ? (
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
