"use client";

import { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { itemsForScope, type CountScope } from "@/lib/counts/model";
import { STOCK_FOLDERS } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { SegmentedControl } from "@/components/ui/Controls";
import { ListSection } from "@/components/ui/List";
import { Icon } from "@/components/ui/Icon";

type Kind = CountScope["kind"];
const STALE_DAYS = 30;

const BLURB: Record<Kind, string> = {
  all: "Every item in every room.",
  rooms: "Only the rooms you pick.",
  low: "Items at or below the minimum you keep.",
  stale: `Items not counted in the last ${STALE_DAYS} days, or never.`,
};

export function StartCountSheet({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (scope: CountScope) => void;
}) {
  const { items, folderCounts } = useInventory();
  const [kind, setKind] = useState<Kind>("all");
  const rooms = useMemo(() => STOCK_FOLDERS.filter((f) => (folderCounts[f] ?? 0) > 0), [folderCounts]);
  const [picked, setPicked] = useState<string[]>([]);

  const scope: CountScope =
    kind === "rooms" ? { kind, rooms: picked } : kind === "stale" ? { kind, days: STALE_DAYS } : { kind };
  const n = useMemo(() => (kind === "rooms" && !picked.length ? 0 : itemsForScope(items, scope).length), [items, kind, picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const minutes = Math.max(1, Math.round((n * 12) / 60));

  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New Count"
      leading={
        <button type="button" onClick={onClose} className="pressable focus-ring min-h-tap rounded-lg px-2 text-body text-tint">
          Cancel
        </button>
      }
      trailing={
        <button
          type="button"
          data-testid="start-count-confirm"
          disabled={n === 0}
          onClick={() => onStart(scope)}
          className="pressable focus-ring min-h-tap rounded-lg px-2 text-body font-semibold text-tint disabled:text-label-3"
        >
          Start
        </button>
      }
    >
      <div className="space-y-5 pt-3">
        <div>
          <SegmentedControl<Kind>
            value={kind}
            onChange={setKind}
            ariaLabel="What to count"
            options={[
              { value: "all", label: "All" },
              { value: "rooms", label: "Rooms" },
              { value: "low", label: "Low" },
              { value: "stale", label: `${STALE_DAYS}+ Days` },
            ]}
          />
          <p className="px-4 pt-2 text-footnote text-label-2">{BLURB[kind]}</p>
        </div>

        {kind === "rooms" ? (
          <ListSection header="Rooms">
            {rooms.map((r) => {
              const on = picked.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(r)}
                  className="ios-row pressable focus-ring flex w-full items-stretch active:bg-fill-4"
                >
                  <span className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center gap-3 py-[11px] pr-4">
                    <span className="flex-1 text-left text-body text-label">{r}</span>
                    <span className="text-body tabular-nums text-label-2">{folderCounts[r] ?? 0}</span>
                    <span className={`flex w-6 justify-end ${on ? "text-tint" : "text-transparent"}`} aria-hidden>
                      <Icon name="checkmark" size={20} strokeWidth={2.6} />
                    </span>
                  </span>
                </button>
              );
            })}
          </ListSection>
        ) : null}

        <div className="glass rounded-card px-4 py-4 text-center">
          <p className="text-title2 tabular-nums text-label" data-testid="start-count-n">
            {n} {n === 1 ? "item" : "items"}
          </p>
          <p className="mt-0.5 text-subhead text-label-2">
            {n ? `About ${minutes} min` : kind === "rooms" ? "Pick at least one room" : "Nothing to count here"}
          </p>
        </div>

        <p className="px-4 text-footnote text-label-2">
          Quantities change only when you end the count. Anything you skip or don’t get to stays as it is. Ideas aren’t included.
        </p>
      </div>
    </Sheet>
  );
}
