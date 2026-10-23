"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/types";
import { ItemImage } from "./ItemImage";
import { PhotoInputs, usePhotoInputIds } from "./PhotoInputs";
import { ActionSheet } from "./ui/Sheet";
import { Icon } from "./ui/Icon";
import { deletePhoto, savePhoto, useUserPhoto } from "@/lib/photoStore";
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

/** Item photo with tap-to-change: Take Photo / Choose from Library / Remove Photo. */
export function ItemPhotoEditor({ item }: { item: InventoryItem }) {
  const { cameraId, libraryId } = usePhotoInputIds("item-photo");
  const user = useUserPhoto(item.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const { blob, width, height } = await prepareItemPhoto(file);
      await savePhoto(item.id, blob, { width, height });
    } catch (err) {
      console.error(err);
      setError(photoErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const hasUser = Boolean(user.url);
  return (
    <div>
      <PhotoInputs cameraId={cameraId} libraryId={libraryId} onFile={(f) => void onFile(f)} disabled={busy} />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          aria-label={hasUser ? `Change photo of ${item.name}` : `Add a photo of ${item.name}`}
          className="pressable focus-ring relative block w-full rounded-[12px]"
        >
          <ItemImage item={item} aspect="aspect-[4/3]" symbolSize={72} />
          <span
            aria-hidden
            className="absolute bottom-2 right-2 inline-flex min-h-tap items-center gap-1.5 rounded-full bg-bg-grouped-2 px-4 text-subhead font-semibold text-tint shadow-[0_1px_6px_rgba(0,0,0,0.18)]"
          >
            <Icon name="camera" size={18} strokeWidth={2} />
            {hasUser ? "Edit" : "Add Photo"}
          </span>
        </button>
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/30" aria-live="polite">
            <span className="rounded-full bg-bg-grouped-2 px-4 py-2 text-subhead font-semibold text-label">Preparing photo…</span>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-2 px-1 text-subhead text-sys-red-text">
          <Icon name="exclamationmark.triangle" size={18} />
          <span>{error}</span>
        </p>
      ) : null}
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={hasUser ? "Item Photo" : "Add a Photo"}
        actions={[
          { label: "Take Photo", htmlFor: cameraId, onSelect: () => {} },
          { label: "Choose from Library", htmlFor: libraryId, onSelect: () => {} },
          ...(hasUser
            ? [{ label: "Remove Photo", destructive: true, onSelect: () => void deletePhoto(item.id) }]
            : []),
        ]}
      />
    </div>
  );
}
