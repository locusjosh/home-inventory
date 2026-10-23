"use client";

import { useMemo } from "react";
import type { InventoryItem } from "./types";
import { assetPath } from "./assets";
import { BUNDLED, resolveSlots } from "./photoOrder";
import { usePhotoIndex, usePhotoUrls } from "./photoStore";

export type Slot = { id: string; kind: "bundled" | "user"; url: string | null };

type GalleryItem = Pick<InventoryItem, "image"> & { id?: string; photoOrder?: string[] };

/** Resolved, ordered gallery for an item. `ready` is false until IndexedDB has been read. */
export function useItemSlots(item: GalleryItem): { slots: Slot[]; order: string[]; ready: boolean } {
  const index = usePhotoIndex();
  const order = useMemo(
    () => resolveSlots(item, index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id, item.image, (item.photoOrder ?? []).join("|"), item.photoOrder === undefined, index]
  );
  const userKeys = order.filter((k) => k !== BUNDLED);
  const { urls, loaded } = usePhotoUrls(userKeys);
  const slots: Slot[] = order.map((k) =>
    k === BUNDLED
      ? { id: k, kind: "bundled", url: item.image ? assetPath(item.image) : null }
      : { id: k, kind: "user", url: urls[k] ?? null }
  );
  const ready = index !== null && loaded;
  return { slots, order, ready };
}
