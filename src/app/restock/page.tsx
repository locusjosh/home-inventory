"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInventory } from "@/context/InventoryContext";
import { LogPurchaseSheet } from "@/components/LogPurchaseSheet";
import { ItemImage } from "@/components/ItemImage";
import { EmptyState } from "@/components/EmptyState";
import { itemHref } from "@/components/ItemCard";
import { Page } from "@/components/ui/Page";
import { ChipBar } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { InventoryItem } from "@/lib/types";
import {
  formatPrice,
  formatQty,
  needToBuy,
  shopAmazonUrl,
  shopCostcoUrl,
  shopWalmartUrl,
} from "@/lib/utils";

const OTHER = "Other";
const COLLAPSED_LIMIT = 6;

function storeOf(item: InventoryItem) {
  return item.lastVendor?.trim() || item.vendor?.trim() || OTHER;
}

export default function RestockPage() {
  const { lowStockItems, markRestocked, logPurchase, getLastPurchase } = useInventory();
  const [copied, setCopied] = useState(false);
  const [store, setStore] = useState<string>("all");
  const [sheetItem, setSheetItem] = useState<InventoryItem | null>(null);
  const [sheetAlsoRestock, setSheetAlsoRestock] = useState(true);
  const [menuItem, setMenuItem] = useState<InventoryItem | null>(null);
  const [payPromptItem, setPayPromptItem] = useState<InventoryItem | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const byStore = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of lowStockItems) {
      const key = storeOf(item);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    // Named stores first (by size), "Other" last
    return [...map.entries()].sort(([a, al], [b, bl]) => {
      if (a === OTHER) return 1;
      if (b === OTHER) return -1;
      return bl.length - al.length || a.localeCompare(b);
    });
  }, [lowStockItems]);

  const visible = store === "all" ? byStore : byStore.filter(([s]) => s === store);
  const total = lowStockItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const priced = lowStockItems.some((i) => i.price != null);

  const copyList = async () => {
    const lines: string[] = ["Restock list", ""];
    for (const [vendor, items] of byStore) {
      lines.push(`## ${vendor}`);
      for (const item of items) {
        const need = needToBuy(item);
        const last = getLastPurchase(item.id);
        lines.push(
          `- ${item.name}: buy ${need} ${item.unit} (have ${item.quantity}, min ${item.minLevel})` +
            (item.price != null ? ` · ${formatPrice(item.price)}` : "") +
            (last ? ` · last ${formatPrice(last.pricePaid)}${last.vendor ? ` @ ${last.vendor}` : ""}` : "")
        );
      }
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Page
      title="Restock"
      subtitle={
        lowStockItems.length
          ? `${lowStockItems.length} items to buy${priced ? ` · about ${formatPrice(total)}` : ""}`
          : "Everything is stocked"
      }
      actions={
        <>
          <Link
            href="/receipt"
            aria-label="Scan receipt"
            className="pressable focus-ring flex h-11 w-11 items-center justify-center rounded-full text-tint"
          >
            <Icon name="receipt" size={23} strokeWidth={1.9} />
          </Link>
          {lowStockItems.length > 0 ? (
            <IconButton label={copied ? "Copied" : "Copy list"} onClick={() => void copyList()}>
              {copied ? (
                <Icon name="checkmark" size={22} strokeWidth={2.2} />
              ) : (
                <Icon name="square.and.arrow.up" size={23} strokeWidth={1.9} />
              )}
            </IconButton>
          ) : null}
        </>
      }
    >
      {byStore.length > 1 ? (
        <div className="mb-4">
          <ChipBar
            value={store}
            onChange={setStore}
            ariaLabel="Filter by store"
            options={[
              { value: "all", label: "All", count: lowStockItems.length },
              ...byStore.map(([s, items]) => ({ value: s, label: s, count: items.length })),
            ]}
          />
        </div>
      ) : null}

      <div className="space-y-6">
        {visible.map(([vendor, items]) => {
          const collapsible = store === "all" && items.length > COLLAPSED_LIMIT;
          const open = !collapsible || expanded[vendor];
          const shown = open ? items : items.slice(0, COLLAPSED_LIMIT);
          return (
            <section key={vendor}>
              <div className="flex items-end justify-between px-4 pb-1.5">
                <h2 className="text-footnote font-semibold text-label-2">
                  {vendor === OTHER ? "No Store Set" : vendor}
                </h2>
                <span className="text-footnote tabular-nums text-label-2">{items.length}</span>
              </div>
              <ul className="ios-group overflow-hidden rounded-card bg-bg-grouped-2">
                {shown.map((item) => {
                  const need = needToBuy(item);
                  const last = getLastPurchase(item.id);
                  return (
                    <li key={item.id} className="ios-row flex items-center">
                      <Link
                        href={itemHref(item.id)}
                        className="pressable focus-ring shrink-0 py-2.5 pl-4"
                        aria-label={`${item.name} details`}
                      >
                        <ItemImage item={item} className="h-16 w-16" rounded="rounded-[10px]" symbolSize={28} />
                      </Link>
                      <div className="ios-row-inner ml-3 flex min-h-[84px] min-w-0 flex-1 items-center gap-1 py-2.5 pr-2">
                        <Link href={itemHref(item.id)} className="focus-ring min-w-0 flex-1 rounded">
                          <p className="line-clamp-2 text-headline text-label">{item.name.replace(/\//g, "/\u200b")}</p>
                          <p className="mt-0.5 text-subhead tabular-nums text-label-2">
                            Need {formatQty(need)}
                            {item.price != null ? ` · ${formatPrice(item.price)}` : ""}
                          </p>
                          {last ? (
                            <p className="mt-0.5 truncate text-footnote text-label-2">
                              Last paid {formatPrice(last.pricePaid)}
                              {last.vendor ? ` at ${last.vendor}` : ""}
                            </p>
                          ) : null}
                        </Link>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSheetAlsoRestock(true);
                            setSheetItem(item);
                          }}
                          aria-label={`Bought ${item.name}`}
                        >
                          Bought
                        </Button>
                        <IconButton label={`More actions for ${item.name}`} onClick={() => setMenuItem(item)}>
                          <Icon name="ellipsis" size={22} />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
                {collapsible ? (
                  <li className="ios-row">
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [vendor]: !open }))}
                      className="pressable focus-ring flex w-full"
                    >
                      <span className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center justify-between pr-4 text-body text-tint">
                        {open ? "Show Less" : `Show All ${items.length}`}
                        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
                          <Icon name="chevron.down" size={18} strokeWidth={2.2} />
                        </span>
                      </span>
                    </button>
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      {lowStockItems.length === 0 ? (
        <EmptyState
          icon="checkmark.circle"
          title="All Stocked Up"
          description="Nothing is below its minimum right now."
          action={
            <ButtonLink href="/receipt" variant="secondary">
              Scan a Receipt
            </ButtonLink>
          }
        />
      ) : null}

      <ActionSheet
        open={Boolean(menuItem)}
        onClose={() => setMenuItem(null)}
        title={menuItem?.name}
        actions={
          menuItem
            ? [
                {
                  label: "Log Purchase…",
                  onSelect: () => {
                    setSheetAlsoRestock(true);
                    setSheetItem(menuItem);
                  },
                },
                {
                  label: "Mark Restocked",
                  onSelect: () => {
                    markRestocked(menuItem.id);
                    setPayPromptItem(menuItem);
                  },
                },
                { label: "Shop on Amazon", href: shopAmazonUrl(menuItem), external: true, onSelect: () => {} },
                { label: "Shop at Costco", href: shopCostcoUrl(menuItem.name), external: true, onSelect: () => {} },
                { label: "Shop at Walmart", href: shopWalmartUrl(menuItem.name), external: true, onSelect: () => {} },
              ]
            : []
        }
      />

      <ActionSheet
        open={Boolean(payPromptItem)}
        onClose={() => setPayPromptItem(null)}
        title={payPromptItem ? `${payPromptItem.name} restocked` : undefined}
        message="Log what you paid to track price changes over time."
        actions={
          payPromptItem
            ? [
                {
                  label: "Log Price…",
                  onSelect: () => {
                    setSheetAlsoRestock(false);
                    setSheetItem(payPromptItem);
                  },
                },
              ]
            : []
        }
      />

      {sheetItem ? (
        <LogPurchaseSheet
          item={sheetItem}
          lastPurchase={getLastPurchase(sheetItem.id)}
          open
          onClose={() => setSheetItem(null)}
          onSave={(data) => {
            logPurchase({
              itemId: sheetItem.id,
              ...data,
              source: "restock",
              alsoRestock: sheetAlsoRestock,
            });
            setSheetItem(null);
          }}
        />
      ) : null}
    </Page>
  );
}
