"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/types";
import { assetPath, folderGradient, itemMonogram } from "@/lib/assets";

type Props = {
  item: Pick<InventoryItem, "name" | "folder" | "image">;
  className?: string;
  /** aspect-square | aspect-[4/3] etc */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
};

export function ItemImage({
  item,
  className = "",
  aspect = "aspect-square",
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = item.image ? assetPath(item.image) : "";
  const showImg = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${aspect} ${className}`}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${folderGradient(item.folder)}`}
          aria-hidden
        >
          <span className="font-display text-2xl font-semibold tracking-wide text-white/95 drop-shadow-sm sm:text-3xl">
            {itemMonogram(item.name)}
          </span>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
        </div>
      )}
    </div>
  );
}
