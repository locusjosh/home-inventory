"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { useCounts } from "@/lib/counts/useCounts";
import { lineState, sessionProgress, SCOPE_LABEL, type CountSession, type LineState } from "@/lib/counts/model";
import { formatQty } from "@/lib/utils";
import { ItemImage } from "@/components/ItemImage";
import { Page } from "@/components/ui/Page";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ActionSheet, Sheet } from "@/components/ui/Sheet";
import { SegmentedControl, StatusTag } from "@/components/ui/Controls";
import { LineGlyph } from "./CountBits";

type Filter = "all" | "pending" | "skipped" | "counted";

export function CountRunner({ session, onPause }: { session: CountSession; onPause: () => void }) {
  const router = useRouter();
  const { items } = useInventory();
  const { record, move, cancel, start } = useCounts();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ids = session.itemIds;
  const total = ids.length;

  const [idx, setIdx] = useState(() => Math.min(Math.max(0, session.pos), Math.max(0, total - 1)));
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const itemId = ids[idx];
  const item = itemId ? byId.get(itemId) : undefined;
  const line = itemId ? session.lines[itemId] : undefined;
  const st = lineState(line);
  const expected = itemId ? (session.expected[itemId] ?? item?.quantity ?? 0) : 0;
  const [draft, setDraft] = useState<number>(0);
  const [jump, setJump] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setDraft(st === "counted" ? (line!.counted as number) : expected);
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prog = sessionProgress(session);
  const done = prog.counted + prog.skipped;

  const go = (next: number, d: "left" | "right") => {
    if (next < 0 || next >= total || next === idx) return;
    setDir(d);
    setIdx(next);
    move(session.id, next);
  };

  /** Next item still to count after `from` (wraps around), skipping `except`. */
  const nextPending = (from: number, except: string) => {
    for (let k = 1; k <= total; k++) {
      const j = (from + k) % total;
      const id = ids[j];
      if (id === except) continue;
      if (lineState(session.lines[id]) === "pending") return j;
    }
    return -1;
  };

  const toReview = () => router.push(`/count/review/?id=${encodeURIComponent(session.id)}`);

  const advanceAfter = (recordedId: string) => {
    const j = nextPending(idx, recordedId);
    if (j === -1) {
      toReview();
      return;
    }
    setDir("right");
    setIdx(j);
    move(session.id, j);
  };

  const confirm = () => {
    if (!itemId) return;
    record(session.id, itemId, { counted: Math.max(0, Math.round(draft * 100) / 100) });
    advanceAfter(itemId);
  };

  const skip = () => {
    if (!itemId) return;
    record(session.id, itemId, { skipped: true });
    advanceAfter(itemId);
  };

  // Swipe the card: left → next, right → previous.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) go(idx + 1, "right");
    else go(idx - 1, "left");
  };

  const list = useMemo(() => {
    const rows = ids.map((id, i) => ({ id, i, item: byId.get(id), state: lineState(session.lines[id]) as LineState }));
    return filter === "all" ? rows : rows.filter((r) => r.state === filter);
  }, [ids, byId, session.lines, filter]);

  const groups = useMemo(() => {
    const out: { room: string; rows: typeof list }[] = [];
    for (const r of list) {
      const room = r.item?.folder ?? "Deleted";
      const g = out[out.length - 1];
      if (g && g.room === room) g.rows.push(r);
      else out.push({ room, rows: [r] });
    }
    return out;
  }, [list]);

  const bump = (d: number) => setDraft((q) => Math.max(0, Math.round((q + d) * 100) / 100));

  return (
    <Page
      title={`${Math.min(idx + 1, total)} of ${total}`}
      hideLargeTitle
      leading={
        <button type="button" onClick={onPause} className="pressable focus-ring flex h-11 items-center rounded-lg px-2 text-body text-tint" data-testid="count-pause">
          Pause
        </button>
      }
      actions={
        <>
          <IconButton label="Count options" onClick={() => setMenu(true)}>
            <Icon name="ellipsis.circle" size={23} strokeWidth={1.9} />
          </IconButton>
          <button type="button" onClick={toReview} className="pressable focus-ring flex h-11 items-center rounded-lg px-2 text-body font-semibold text-tint" data-testid="count-review">
            Review
          </button>
        </>
      }
    >
      {/* progress */}
      <div className="pt-1">
        <div
          className="h-1 overflow-hidden rounded-full bg-fill-3"
          role="progressbar"
          aria-label="Count progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-tint transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-footnote text-label-2">
          <span className="tabular-nums" data-testid="count-progress">
            {prog.counted} counted{prog.skipped ? ` · ${prog.skipped} skipped` : ""} · {prog.pending} left
          </span>
          <button type="button" onClick={() => setJump(true)} className="pressable focus-ring -mr-2 flex min-h-tap items-center gap-1 rounded-lg px-2 font-semibold text-tint" data-testid="count-jump">
            <Icon name="list" size={17} strokeWidth={2.2} />
            All Items
          </button>
        </div>
      </div>

      <section
        key={itemId}
        className={`mt-1 overflow-hidden rounded-card bg-bg-grouped-2 ${dir === "right" ? "animate-slide-from-right" : dir === "left" ? "animate-slide-from-left" : ""}`}
        aria-live="polite"
        style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="count-card"
      >
        {item ? (
          <>
            <div className="p-3 pb-0">
              <ItemImage item={item} aspect="aspect-[2/1]" symbolSize={64} />
            </div>
            <div className="px-5 pb-4 pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-subhead text-label-2">{item.folder}</p>
                {st === "counted" ? (
                  <StatusTag tone="green">Counted</StatusTag>
                ) : st === "skipped" ? (
                  <StatusTag tone="orange">Skipped</StatusTag>
                ) : (
                  <span className="text-subhead tabular-nums text-label-2">Expected {formatQty(expected)}</span>
                )}
              </div>
              <h2 className="mt-2 text-title1 text-label" data-testid="count-item-name">{item.name}</h2>
              <p className="mt-1 text-subhead text-label-2">
                {item.unit}
                {item.minLevel != null ? ` · keep at least ${formatQty(item.minLevel)}` : ""}
                {st !== "pending" ? ` · expected ${formatQty(expected)}` : ""}
              </p>

              <div className="mt-5 flex items-center justify-center gap-5">
                <button type="button" aria-label="Decrease" onClick={() => bump(-1)} className="pressable focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-fill-3 text-tint">
                  <Icon name="minus" size={28} strokeWidth={2.4} />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label="Counted quantity"
                  data-testid="count-qty"
                  value={formatQty(draft)}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setDraft(Number.isNaN(n) ? 0 : Math.max(0, n));
                  }}
                  className="focus-ring h-16 w-24 rounded-[14px] bg-transparent text-center text-[44px] font-bold leading-none tabular-nums text-label outline-none"
                />
                <button type="button" aria-label="Increase" onClick={() => bump(1)} className="pressable focus-ring flex h-16 w-16 items-center justify-center rounded-full bg-fill-3 text-tint">
                  <Icon name="plus" size={28} strokeWidth={2.4} />
                </button>
              </div>
              <p className="mt-2 h-5 text-center text-footnote tabular-nums text-label-2">
                {draft !== expected ? `${draft > expected ? "+" : "−"}${formatQty(Math.abs(Math.round((draft - expected) * 100) / 100))} from expected` : "Matches expected"}
              </p>
            </div>
          </>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-headline text-label">This item was deleted</p>
            <p className="mt-1 text-subhead text-label-2">It won’t be changed. Skip it to keep going.</p>
          </div>
        )}
      </section>

      {/* spacer so the bottom panel never covers content */}
      <div className="h-[124px]" aria-hidden />

      <div
        className="ios-bar hairline-t fixed inset-x-0 z-40"
        style={{ bottom: "calc(49px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <Button variant="primary" size="lg" block onClick={confirm} disabled={!item} data-testid="count-confirm">
            {st === "counted" ? "Update Count" : "Confirm Count"}
          </Button>
        </div>
        <div className="mx-auto grid h-[52px] max-w-2xl grid-cols-3 items-center px-2">
          <button
            type="button"
            onClick={() => go(idx - 1, "left")}
            disabled={idx === 0}
            className="pressable focus-ring flex min-h-tap items-center justify-start gap-0.5 rounded-lg px-2 text-body text-tint disabled:text-label-3"
            data-testid="count-prev"
          >
            <Icon name="chevron.left" size={22} strokeWidth={2.4} />
            Previous
          </button>
          <button type="button" onClick={skip} className="pressable focus-ring min-h-tap rounded-lg px-2 text-body text-tint" data-testid="count-skip">
            Skip
          </button>
          <button
            type="button"
            onClick={() => go(idx + 1, "right")}
            disabled={idx >= total - 1}
            className="pressable focus-ring flex min-h-tap items-center justify-end gap-0.5 rounded-lg px-2 text-body text-tint disabled:text-label-3"
            data-testid="count-next"
          >
            Next
            <Icon name="chevron.right" size={22} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <Sheet
        open={jump}
        onClose={() => setJump(false)}
        title="All Items"
        trailing={
          <button type="button" onClick={() => setJump(false)} className="pressable focus-ring min-h-tap rounded-lg px-2 text-body font-semibold text-tint">
            Done
          </button>
        }
      >
        <div className="sticky top-0 z-10 -mx-4 bg-bg-grouped px-4 pb-3 pt-2">
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            ariaLabel="Show"
            options={[
              { value: "all", label: "All" },
              { value: "pending", label: `Left ${prog.pending}` },
              { value: "skipped", label: `Skipped ${prog.skipped}` },
              { value: "counted", label: "Counted" },
            ]}
          />
        </div>
        {list.length ? (
          <div className="space-y-4" data-testid="jump-list">
            {groups.map((g) => (
              <section key={g.room}>
                <p className="px-4 pb-1.5 text-footnote font-semibold text-label-2">{g.room}</p>
                <ul className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
                  {g.rows.map((r) => {
                    const ln = session.lines[r.id];
                    return (
                      <li key={r.id} className="ios-row">
                        <button
                          type="button"
                          onClick={() => {
                            setJump(false);
                            go(r.i, r.i > idx ? "right" : "left");
                          }}
                          aria-current={r.i === idx ? "true" : undefined}
                          className={`pressable focus-ring flex w-full items-center active:bg-fill-4 ${r.i === idx ? "bg-tint-soft" : ""}`}
                        >
                          <span className="flex shrink-0 py-2 pl-4">
                            <LineGlyph state={r.state} excluded={ln?.excluded} />
                          </span>
                          <span className="ios-row-inner ml-3 flex min-h-tap min-w-0 flex-1 items-center gap-3 py-2 pr-4">
                            <span className="min-w-0 flex-1 truncate text-left text-body text-label">{r.item?.name ?? "Deleted item"}</span>
                            <span className="shrink-0 text-subhead tabular-nums text-label-2">
                              {r.state === "counted" ? formatQty(ln!.counted as number) : formatQty(session.expected[r.id] ?? 0)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-subhead text-label-2">Nothing here.</p>
        )}
      </Sheet>

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={`${SCOPE_LABEL(session.scope)} · ${total} items`}
        actions={[
          { label: "Review & End Count", onSelect: toReview },
          {
            label: "Restart Count",
            onSelect: () => {
              cancel(session.id);
              start(session.scope);
            },
          },
          { label: "Cancel Count…", destructive: true, onSelect: () => setConfirmCancel(true) },
        ]}
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
