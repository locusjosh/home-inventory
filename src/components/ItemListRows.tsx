"use client";

import type { ReactNode } from "react";
import type { InventoryItem } from "@/lib/types";
import { ItemImage } from "@/components/ItemImage";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Thumbnail + name + detail line + an actions button (opens an action sheet). */
export function ItemActionRow({ item, detail, onActions, trailing }: { item: InventoryItem; detail: ReactNode; onActions: () => void; trailing?: ReactNode }) {
  return (
    <li className="ios-row flex items-center" data-testid={`row-${item.id}`}>
      <button type="button" onClick={onActions} className="pressable shrink-0 py-2 pl-4" aria-label={`${item.name} actions`} tabIndex={-1}>
        <ItemImage item={item} className="h-11 w-11" rounded="rounded-[10px]" symbolSize={22} />
      </button>
      <div className="ios-row-inner ml-3 flex min-h-[60px] min-w-0 flex-1 items-center gap-1 pr-2">
        <button type="button" onClick={onActions} className="pressable focus-ring flex min-h-tap min-w-0 flex-1 flex-col justify-center rounded py-1 text-left">
          <span className="truncate text-body text-label">{item.name}</span>
          <span className="truncate text-subhead text-label-2">{detail}</span>
        </button>
        {trailing}
        <IconButton label={`More actions for ${item.name}`} onClick={onActions}>
          <Icon name="ellipsis" size={22} />
        </IconButton>
      </div>
    </li>
  );
}
