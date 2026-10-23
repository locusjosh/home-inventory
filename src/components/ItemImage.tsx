"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/types";
import { HUES, assetPath, itemSymbol } from "@/lib/assets";
import { Icon } from "./ui/Icon";
import { useItemSlots } from "@/lib/useItemSlots";

type Props = {
  item: Pick<InventoryItem, "name" | "folder" | "image"> & { id?: string; photoOrder?: string[] };
  className?: string;
  /** Tailwind aspect class; defaults to square */
  aspect?: string;
  /** Glyph size for the symbol fallback */
  symbolSize?: number;
  /** Packshots are on white: keep a white plate in dark mode too */
  rounded?: string;
};

/**
 * Product photo on a white plate (packshots are shot on white), or — when no
 * verified photo exists — a neutral tinted tile with an SF-style symbol.
 * Never emoji, never initials.
 */
export function ItemImage({
  item,
  className = "",
  aspect = "aspect-square",
  symbolSize,
  rounded = "rounded-[12px]",
}: Props) {
  const [failed, setFailed] = useState(false);
  const { slots, ready } = useItemSlots(item);
  const cover = slots[0];

  // Don't flash the packshot while we check IndexedDB for a user cover photo.
  if (!ready && item.id) {
    return <div className={`relative overflow-hidden bg-fill-4 ${aspect} ${rounded} ${className}`} role="img" aria-label={item.name} />;
  }

  // The cover (slot 0) is shown everywhere: user photos edge-to-edge, packshots on a white plate.
  if (cover?.kind === "user" && cover.url) {
    return (
      <div className={`relative overflow-hidden bg-fill-3 ${aspect} ${rounded} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.url} alt={item.name} decoding="async" className="h-full w-full object-cover" data-user-photo="" />
      </div>
    );
  }

  const src = cover?.kind === "bundled" && cover.url ? cover.url : item.id ? "" : item.image ? assetPath(item.image) : "";
  const showImg = Boolean(src) && !failed;
  if (showImg) {
    return (
      <div className={`relative overflow-hidden bg-white ${aspect} ${rounded} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const sym = itemSymbol(item.name);
  const hue = HUES[sym.hue];
  return (
    <div
      className={`sym-tile relative flex items-center justify-center overflow-hidden ${aspect} ${rounded} ${className}`}
      style={
        {
          background: hue.bg,
          "--sym-fg": hue.fg,
          "--sym-fg-dark": hue.fgDark,
        } as React.CSSProperties
      }
      role="img"
      aria-label={item.name}
    >
      <Icon name={sym.icon} size={symbolSize ?? 40} strokeWidth={1.6} />
    </div>
  );
}
