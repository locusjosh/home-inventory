"use client";

import { FOLDERS } from "@/lib/types";

type Props = {
  open: boolean;
  itemName?: string;
  onClose: () => void;
  onPick: (folder: string) => void;
};

export function MoveFolderModal({ open, itemName, onClose, onPick }: Props) {
  if (!open) return null;
  const realFolders = FOLDERS.filter((f) => f !== "Suggested Items");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-4 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">Move to folder</h2>
        {itemName ? <p className="mt-1 text-sm text-ink-muted">{itemName}</p> : null}
        <div className="mt-4 grid gap-2">
          {realFolders.map((f) => (
            <button
              key={f}
              type="button"
              className="rounded-xl bg-surface-2 px-4 py-3 text-left text-sm font-medium text-ink hover:bg-accent hover:text-white"
              onClick={() => onPick(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm text-ink-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
