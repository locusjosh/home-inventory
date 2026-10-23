"use client";

import { useId } from "react";

/**
 * Two visually-hidden (not display:none) file inputs: one that opens the
 * camera, one that opens the photo library. Trigger them with
 * `<label htmlFor={cameraId}>` / `<label htmlFor={libraryId}>` so the picker is
 * opened by the user's tap itself rather than a scripted `.click()`.
 *
 * `accept` lists HEIC/HEIF explicitly — iOS sometimes reports them with an
 * empty or octet-stream MIME type.
 */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,image/heic,image/heif";

export function usePhotoInputIds(prefix = "photo") {
  const id = useId().replace(/:/g, "");
  return { cameraId: `${prefix}-camera-${id}`, libraryId: `${prefix}-library-${id}` };
}

export function PhotoInputs({
  cameraId,
  libraryId,
  onFile,
  disabled,
}: {
  cameraId: string;
  libraryId: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };
  return (
    <>
      <input
        id={cameraId}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="visually-hidden-input"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={handle}
        data-testid={`${cameraId}`}
      />
      <input
        id={libraryId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="visually-hidden-input"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={handle}
        data-testid={`${libraryId}`}
      />
    </>
  );
}
