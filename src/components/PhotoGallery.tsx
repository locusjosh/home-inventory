"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoInputs, usePhotoInputIds } from "./PhotoInputs";
import { ActionSheet, type ActionItem } from "./ui/Sheet";
import { Button, IconButton } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { MAX_PHOTOS } from "@/lib/photoOrder";

export type GallerySlot = { id: string; kind: "bundled" | "user"; url: string | null };

/**
 * Up-to-4 photo gallery: swipeable pager (scroll-snap), thumbnail strip with an
 * add tile, and per-photo controls (move left/right, make cover, delete with
 * confirmation). Slot 0 is the cover. Purely presentational — callers persist.
 */
export function PhotoGallery({
  name,
  slots,
  busy,
  error,
  onAddFile,
  onMove,
  onMakeCover,
  onDelete,
  extraAddActions = [],
  idPrefix,
  emptyClassName = "aspect-[4/3]",
}: {
  name: string;
  slots: GallerySlot[];
  busy?: boolean;
  error?: string | null;
  onAddFile: (file: File) => void;
  onMove: (from: number, to: number) => void;
  onMakeCover: (index: number) => void;
  onDelete: (index: number) => void;
  extraAddActions?: ActionItem[];
  idPrefix: string;
  /** Size of the empty "Add Photo" tile. */
  emptyClassName?: string;
}) {
  const { cameraId, libraryId } = usePhotoInputIds(idPrefix);
  const pagerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = slots.length;
  const full = count >= MAX_PHOTOS;
  const prevCount = useRef(count);
  const justAdded = useRef(false);

  // While we scroll programmatically, ignore intermediate scroll events so the
  // selection doesn't bounce through the pages in between.
  const target = useRef<number | null>(null);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const el = pagerRef.current;
    if (!el) return;
    target.current = i;
    if (targetTimer.current) clearTimeout(targetTimer.current);
    targetTimer.current = setTimeout(() => (target.current = null), 900);
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const select = useCallback(
    (i: number, smooth = true) => {
      setCurrent(i);
      scrollToIndex(i, smooth);
    },
    [scrollToIndex]
  );

  // Keep the selection valid; jump to a newly added photo.
  useEffect(() => {
    if (count > prevCount.current && justAdded.current) {
      justAdded.current = false;
      select(count - 1, false);
    }
    else if (current > count - 1) select(Math.max(0, count - 1), false);
    prevCount.current = count;
  }, [count, current, select]);

  const onScroll = () => {
    const el = pagerRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (target.current !== null) {
      if (i === target.current) target.current = null;
      return;
    }
    if (i !== current && i >= 0 && i < count) setCurrent(i);
  };

  const cur = slots[current];
  const addActions: ActionItem[] = full
    ? []
    : [
        { label: "Take Photo", htmlFor: cameraId, onSelect: () => {} },
        { label: "Choose from Library", htmlFor: libraryId, onSelect: () => {} },
        ...extraAddActions,
      ];

  return (
    <div data-testid="photo-gallery" data-count={count}>
      <PhotoInputs
        cameraId={cameraId}
        libraryId={libraryId}
        onFile={(f) => {
          justAdded.current = true;
          onAddFile(f);
        }}
        disabled={busy || full}
      />

      {count === 0 ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={busy}
          className={`pressable focus-ring flex ${emptyClassName} w-full flex-col items-center justify-center gap-2 rounded-[12px] bg-fill-4 text-tint`}
          aria-label={`Add a photo of ${name}`}
        >
          <Icon name="camera" size={44} strokeWidth={1.5} />
          <span className="text-headline">Add Photo</span>
          <span className="text-footnote text-label-2">Up to {MAX_PHOTOS} photos</span>
        </button>
      ) : (
        <div className="relative">
          <div
            ref={pagerRef}
            onScroll={onScroll}
            className="photo-plate scrollbar-none flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-plate"
            role="region"
            aria-roledescription="carousel"
            aria-label={`Photos of ${name}`}
            data-testid="photo-pager"
          >
            {slots.map((s, i) => (
              <div
                key={s.id}
                className={`relative h-full w-full shrink-0 snap-center snap-always ${s.kind === "bundled" ? "bg-white" : "bg-fill-3"}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`Photo ${i + 1} of ${count}${i === 0 ? ", cover" : ""}`}
                data-slot-id={s.id}
                data-slot-kind={s.kind}
              >
                {s.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.url}
                    alt={`${name}, photo ${i + 1}`}
                    draggable={false}
                    className={`h-full w-full ${s.kind === "bundled" ? "object-contain" : "object-cover"}`}
                  />
                ) : null}
              </div>
            ))}
          </div>
          {current === 0 ? (
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-footnote font-semibold text-white shadow-[0_1px_4px_rgba(0,0,0,0.18)]">
              Cover
            </span>
          ) : null}
          {count > 1 ? (
            <span
              className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-footnote font-semibold tabular-nums text-white shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
              data-testid="photo-position"
            >
              {current + 1} of {count}
            </span>
          ) : null}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/30" aria-live="polite">
              <span className="toast-pill rounded-full px-4 py-2 text-subhead font-semibold">Preparing photo…</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Thumbnail strip */}
      {count > 0 ? (
        <div className="mt-3 flex items-center gap-2" role="list" aria-label="Photo order">
          {slots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              onClick={() => select(i)}
              aria-label={`Show photo ${i + 1}${i === 0 ? " (cover)" : ""}`}
              aria-current={i === current ? "true" : undefined}
              className={`pressable focus-ring relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] ${
                s.kind === "bundled" ? "bg-white" : "bg-fill-3"
              } ${i === current ? "ring-2 ring-tint ring-offset-2 ring-offset-bg-grouped-2" : ""}`}
              data-thumb-id={s.id}
            >
              {s.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" className={`h-full w-full ${s.kind === "bundled" ? "object-contain" : "object-cover"}`} />
              ) : null}
            </button>
          ))}
          {!full ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={busy}
              aria-label="Add Photo"
              className="glass-control pressable focus-ring flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] text-tint disabled:text-label-2"
            >
              <Icon name="plus" size={24} strokeWidth={2.2} />
            </button>
          ) : null}
          <span className="ml-auto text-footnote tabular-nums text-label-2" data-testid="photo-count">
            {count} of {MAX_PHOTOS}
          </span>
        </div>
      ) : null}

      {/* Per-photo controls */}
      {count > 0 && cur ? (
        <div className="glass-control mt-2 flex items-center justify-between rounded-[14px] px-1">
          <IconButton label="Move photo left" onClick={() => { onMove(current, current - 1); select(current - 1); }} disabled={busy || current === 0}>
            <Icon name="chevron.left" size={20} strokeWidth={2.4} />
          </IconButton>
          <Button variant="plain" onClick={() => { onMakeCover(current); select(0); }} disabled={busy || current === 0}>
            {current === 0 ? "Cover Photo" : "Make Cover"}
          </Button>
          <IconButton label="Move photo right" onClick={() => { onMove(current, current + 1); select(current + 1); }} disabled={busy || current >= count - 1}>
            <Icon name="chevron.right" size={20} strokeWidth={2.4} />
          </IconButton>
          <IconButton label="Delete photo" tone="red" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <Icon name="trash" size={20} strokeWidth={2} />
          </IconButton>
        </div>
      ) : null}

      {full ? (
        <p className="mt-2 px-1 text-footnote text-label">That’s {MAX_PHOTOS} photos — the most an item can have. Delete one to add another.</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-2 px-1 text-subhead text-sys-red-text">
          <Icon name="exclamationmark.triangle" size={18} />
          <span>{error}</span>
        </p>
      ) : null}

      <ActionSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a Photo" actions={addActions} />
      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete This Photo?"
        message={
          cur?.kind === "bundled"
            ? "The original product photo will be removed from this item. You can add it back from Add Photo."
            : current === 0 && count > 1
              ? "The next photo will become the cover."
              : "This can’t be undone."
        }
        actions={[{ label: "Delete Photo", destructive: true, onSelect: () => onDelete(current) }]}
      />
    </div>
  );
}
