"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/types";
import { useInventory } from "@/context/InventoryContext";
import { PhotoGallery } from "./PhotoGallery";
import { deletePhoto, savePhoto } from "@/lib/photoStore";
import { BUNDLED, MAX_PHOTOS, moveSlot, newPhotoKey } from "@/lib/photoOrder";
import { useItemSlots } from "@/lib/useItemSlots";
import { ImageDecodeError, isImageFile, toJpeg } from "@/lib/imageFile";

export const PHOTO_MAX_EDGE = 1200;
export const PHOTO_QUALITY = 0.8;

export async function prepareItemPhoto(file: File) {
  if (!isImageFile(file)) throw new ImageDecodeError("That file isn’t a photo. Choose a JPEG, PNG or HEIC image.");
  return toJpeg(file, { maxEdge: PHOTO_MAX_EDGE, quality: PHOTO_QUALITY });
}

export function photoErrorMessage(err: unknown) {
  if (err instanceof ImageDecodeError) return err.message;
  if (err instanceof DOMException && err.name === "QuotaExceededError")
    return "There isn’t enough storage on this iPhone to save the photo.";
  return "The photo couldn’t be saved. Try again.";
}

/** Item detail gallery: up to 4 photos (bundled packshot counts as one), persisted on the item. */
export function ItemPhotoEditor({ item }: { item: InventoryItem }) {
  const { updateItem } = useInventory();
  const { slots, order } = useItemSlots(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOrder = (next: string[]) => updateItem(item.id, { photoOrder: next });

  const onAddFile = async (file: File) => {
    setError(null);
    if (order.length >= MAX_PHOTOS) {
      setError(`An item can have up to ${MAX_PHOTOS} photos. Delete one to add another.`);
      return;
    }
    setBusy(true);
    try {
      const { blob, width, height } = await prepareItemPhoto(file);
      const key = newPhotoKey(item.id);
      await savePhoto(key, blob, { width, height });
      setOrder([...order, key]);
    } catch (err) {
      console.error(err);
      setError(photoErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (i: number) => {
    const key = order[i];
    if (!key) return;
    if (key !== BUNDLED) await deletePhoto(key);
    setOrder(order.filter((k) => k !== key));
  };

  const canRestoreBundled = Boolean(item.image) && !order.includes(BUNDLED) && order.length < MAX_PHOTOS;

  return (
    <PhotoGallery
      idPrefix="item-photo"
      name={item.name}
      slots={slots}
      busy={busy}
      error={error}
      onAddFile={(f) => void onAddFile(f)}
      onMove={(from, to) => setOrder(moveSlot(order, from, to))}
      onMakeCover={(i) => setOrder(moveSlot(order, i, 0))}
      onDelete={(i) => void onDelete(i)}
      extraAddActions={
        canRestoreBundled
          ? [{ label: "Restore Product Photo", onSelect: () => setOrder([...order, BUNDLED]) }]
          : []
      }
    />
  );
}
