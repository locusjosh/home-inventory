"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInventory } from "@/context/InventoryContext";
import { FOLDERS, type Attribute } from "@/lib/types";
import { LogPurchaseSheet } from "@/components/LogPurchaseSheet";
import { ItemPhotoEditor } from "@/components/ItemPhotoEditor";
import { OpenProductLink, ProductUrlField } from "@/components/ProductLink";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/components/ui/Page";
import { ListRow, ListSection } from "@/components/ui/List";
import { MiniStepper, StatusTag } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/ui/Form";
import { formatPrice, formatQty, isLowStock, isSuggested, isTrashed, needsCount } from "@/lib/utils";
import { useCounts } from "@/lib/counts/useCounts";
import { QtyChange, entrySourceLabel, fmtDay } from "@/components/count/CountBits";
import { TRASH_DAYS } from "@/context/InventoryContext";

export default function ItemDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const { items, updateItem, updateQuantity, archiveItem, deleteItem, trashItem, recoverItem, logPurchase, getPurchasesForItem } =
    useInventory();
  const { entries } = useCounts();
  const item = items.find((i) => i.id === id);

  const [attrName, setAttrName] = useState("");
  const [attrOption, setAttrOption] = useState("");
  const [showPurchase, setShowPurchase] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const attrs = useMemo(() => item?.attributes ?? [], [item]);

  if (!item) {
    return (
      <Page title="Item" back={{ href: "/", label: "Back", useHistory: true }} hideLargeTitle>
        <EmptyState
          icon="magnifyingglass"
          title="Item Not Found"
          description="It may have been deleted."
          action={
            <ButtonLink href="/" variant="secondary">
              Go to Stock
            </ButtonLink>
          }
        />
      </Page>
    );
  }

  const setField = <K extends keyof typeof item>(key: K, value: (typeof item)[K]) => {
    updateItem(item.id, { [key]: value });
  };

  const addAttr = () => {
    if (!attrName.trim()) return;
    const next: Attribute[] = [...attrs, { name: attrName.trim(), option: attrOption.trim() }];
    updateItem(item.id, { attributes: next });
    setAttrName("");
    setAttrOption("");
  };

  const hist = getPurchasesForItem(item.id);
  const countLog = entries.filter((e) => e.itemId === item.id);
  const trashed = isTrashed(item);
  const trashDaysLeft = item.trashedAt
    ? Math.max(0, Math.ceil((Date.parse(item.trashedAt) + TRASH_DAYS * 86_400_000 - Date.now()) / 86_400_000))
    : 0;
  const low = isLowStock(item);
  const needs = needsCount(item);
  const idea = isSuggested(item);

  return (
    <Page
      title={item.name}
      hideLargeTitle
      back={{ href: idea ? "/ideas" : "/", label: idea ? "Ideas" : "Stock", useHistory: true }}
      actions={
        <IconButton label="Log purchase" onClick={() => setShowPurchase(true)}>
          <Icon name="bag" size={23} strokeWidth={1.9} />
        </IconButton>
      }
    >
      <div className="space-y-6 pt-2">
        {trashed ? (
          <div className="glass flex items-center gap-3 rounded-card px-4 py-3" data-testid="trashed-banner">
            <div className="min-w-0 flex-1">
              <p className="text-headline text-label">In Recently Deleted</p>
              <p className="text-subhead text-label-2">{trashDaysLeft <= 1 ? "Deletes within a day" : `Deletes in ${trashDaysLeft} days`}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => recoverItem(item.id)}>Recover</Button>
          </div>
        ) : null}
        <div className="glass overflow-hidden rounded-card p-3">
          <ItemPhotoEditor item={item} />
          <div className="px-1 pb-1 pt-3">
            <h1 className="text-title1 text-label">{item.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="text-subhead text-label-2">{item.folder}</span>
              {low ? <StatusTag tone="orange">Below minimum</StatusTag> : null}
              {needs ? <StatusTag tone="blue">Needs a count</StatusTag> : null}
              {item.archived && !trashed ? <StatusTag tone="gray">Archived</StatusTag> : null}
            </div>
            {item.productUrl ? <OpenProductLink url={item.productUrl} className="mt-3" /> : null}
          </div>
        </div>

        <div className="ios-group glass overflow-hidden rounded-card">
          <div className="ios-row flex items-center">
            <div className="ios-row-inner ml-4 flex min-h-[56px] flex-1 items-center justify-between gap-3 py-1.5 pr-3">
              <div>
                <p className="text-body text-label">On Hand</p>
                <p className="text-footnote text-label-2">{item.unit}</p>
              </div>
              <div className="w-40">
                <MiniStepper value={item.quantity} label={item.name} onChange={(q) => updateQuantity(item.id, q)} />
              </div>
            </div>
          </div>
          <FieldRow label="Keep at Least">
            <TextInput
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={item.minLevel ?? ""}
              placeholder="None"
              onChange={(e) => setField("minLevel", e.target.value === "" ? null : Number(e.target.value))}
              className="w-24"
            />
          </FieldRow>
        </div>

        <ListSection header="Details">
          <FieldRow label="Name">
            <TextInput value={item.name} onChange={(e) => setField("name", e.target.value)} />
          </FieldRow>
          <FieldRow label="Room">
            <SelectInput value={item.folder} onChange={(e) => setField("folder", e.target.value)}>
              {!FOLDERS.includes(item.folder as (typeof FOLDERS)[number]) ? (
                <option value={item.folder}>{item.folder}</option>
              ) : null}
              {FOLDERS.map((f) => (
                <option key={f} value={f}>
                  {f === "Suggested Items" ? "Ideas" : f}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Unit">
            <TextInput value={item.unit} onChange={(e) => setField("unit", e.target.value)} />
          </FieldRow>
          <FieldRow label="Price">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={item.price ?? ""}
              placeholder="None"
              onChange={(e) => setField("price", e.target.value === "" ? null : Number(e.target.value))}
            />
          </FieldRow>
          <FieldRow label="Store">
            <TextInput value={item.vendor ?? ""} placeholder="None" onChange={(e) => setField("vendor", e.target.value || null)} />
          </FieldRow>
          <ProductUrlField value={item.productUrl} onCommit={(url) => setField("productUrl", url)} />
          <FieldRow label="Notes" stacked>
            <TextArea
              value={item.notes ?? ""}
              rows={3}
              placeholder="Brand, size, deals…"
              onChange={(e) => setField("notes", e.target.value || null)}
            />
          </FieldRow>
        </ListSection>

        <ListSection
          header="Purchase History"
          footer={hist.length ? undefined : "Log what you paid to see price changes over time."}
        >
          {hist.slice(0, 12).map((p, idx) => {
            const prev = hist[idx + 1];
            let trend: { text: string; up: boolean } | null = null;
            if (prev && prev.unitPricePaid != null && p.unitPricePaid != null && prev.unitPricePaid > 0) {
              const pct = ((p.unitPricePaid - prev.unitPricePaid) / prev.unitPricePaid) * 100;
              if (Math.abs(pct) >= 0.5) trend = { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(0)}%`, up: pct > 0 };
            }
            const date = new Date(p.purchasedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            return (
              <ListRow
                key={p.id}
                title={
                  <span>
                    {formatPrice(p.pricePaid)}
                    <span className="ml-1.5 text-subhead text-label-2">
                      {formatPrice(p.unitPricePaid)}/{p.unit} × {formatQty(p.qty)}
                    </span>
                  </span>
                }
                subtitle={[
                  date,
                  p.vendor,
                  p.promoNotes,
                  p.discountPercent != null ? `${p.discountPercent}% off` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  trend ? (
                    <span className={`text-subhead font-semibold ${trend.up ? "text-sys-red-text" : "text-sys-green"}`}>
                      {trend.text}
                    </span>
                  ) : null
                }
              />
            );
          })}
          <ListRow
            onClick={() => setShowPurchase(true)}
            leading={
              <span className="text-tint">
                <Icon name="plus" size={20} strokeWidth={2.4} />
              </span>
            }
            title="Log Purchase"
            tint
          />
        </ListSection>

        <ListSection header="Attributes">
          {attrs.map((a, idx) => (
            <ListRow
              key={`${a.name}-${idx}`}
              title={a.name}
              value={a.option}
              trailing={
                <IconButton
                  label={`Remove ${a.name}`}
                  tone="red"
                  onClick={() => updateItem(item.id, { attributes: attrs.filter((_, i) => i !== idx) })}
                  className="-mr-2"
                >
                  <Icon name="minus" size={18} strokeWidth={2.6} />
                </IconButton>
              }
            />
          ))}
          <div className="ios-row flex items-center">
            <div className="ios-row-inner ml-4 flex min-h-tap flex-1 items-center gap-2 pr-2">
              <input
                placeholder="Name"
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                aria-label="Attribute name"
                className="min-h-tap min-w-0 flex-1 bg-transparent text-body text-label outline-none"
              />
              <input
                placeholder="Value"
                value={attrOption}
                onChange={(e) => setAttrOption(e.target.value)}
                aria-label="Attribute value"
                className="min-h-tap min-w-0 flex-1 bg-transparent text-body text-label outline-none"
              />
              <Button variant="plain" onClick={addAttr} disabled={!attrName.trim()}>
                Add
              </Button>
            </div>
          </div>
        </ListSection>

        <ListSection
          header="Count History"
          footer={!countLog.length ? (item.lastCountedAt ? `Last counted ${fmtDay(item.lastCountedAt, true)}.` : "Not counted yet.") : undefined}
        >
          {countLog.slice(0, 3).map((e) => (
            <ListRow
              key={e.id}
              title={fmtDay(e.at)}
              subtitle={entrySourceLabel(e)}
              trailing={<QtyChange from={e.oldQty} to={e.newQty} compact />}
            />
          ))}
          <ListRow href={`/count/item/?id=${encodeURIComponent(item.id)}`} title={countLog.length > 3 ? `Show All ${countLog.length}` : "Show History"} tint chevron />
        </ListSection>

        <ListSection>
          {trashed ? (
            <ListRow onClick={() => recoverItem(item.id)} title="Recover Item" tint />
          ) : (
            <ListRow onClick={() => archiveItem(item.id, !item.archived)} title={item.archived ? "Unarchive Item" : "Archive Item"} tint />
          )}
          <ListRow onClick={() => setConfirmDelete(true)} title={trashed ? "Delete Now" : "Delete Item"} destructive />
        </ListSection>
      </div>

      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={trashed ? `Delete “${item.name}” now?` : `Delete “${item.name}”?`}
        message={
          trashed
            ? "This removes the item, its photos and its purchase history from all your devices. It can’t be undone."
            : `It moves to Recently Deleted, where you can recover it for ${TRASH_DAYS} days.`
        }
        actions={[
          {
            label: trashed ? "Delete Now" : "Delete Item",
            destructive: true,
            onSelect: () => {
              if (trashed) deleteItem(item.id);
              else trashItem(item.id);
              router.push(trashed ? "/more/deleted" : idea ? "/ideas" : "/");
            },
          },
        ]}
      />

      {showPurchase ? (
        <LogPurchaseSheet
          item={item}
          lastPurchase={hist[0] ?? null}
          open
          onClose={() => setShowPurchase(false)}
          onSave={(data) => {
            logPurchase({ itemId: item.id, ...data, source: "manual", alsoRestock: false });
            setShowPurchase(false);
          }}
        />
      ) : null}
    </Page>
  );
}
