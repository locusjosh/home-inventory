"use client";

import { useEffect, useRef, useState } from "react";
import { FieldRow, TextInput } from "./ui/Form";
import { Icon } from "./ui/Icon";
import { buttonClass, IconButton } from "./ui/Button";
import { ListRow, ListSection } from "./ui/List";
import {
  MAX_LINK_LABEL,
  MAX_LINKS,
  normalizeLinkUrl,
  normalizeProductUrl,
  productHost,
  sanitizeItemLinks,
  storeLabel,
} from "@/lib/productUrl";
import type { ItemLink } from "@/lib/types";

/**
 * Grouped-form row for the optional product link. Validates/normalises on
 * blur (adds https:// when missing) and reports errors inline. `onCommit`
 * receives the normalised URL (or null when cleared) only when valid.
 */
export function ProductUrlField({
  value,
  onCommit,
  onValidityChange,
  label = "Default Link",
}: {
  label?: string;
  value: string | null | undefined;
  onCommit: (url: string | null) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(value ?? ""), [value]);

  const commit = () => {
    const r = normalizeProductUrl(text);
    if (!r.ok) {
      setError(r.error);
      onValidityChange?.(false);
      return;
    }
    setError(null);
    onValidityChange?.(true);
    setText(r.url ?? "");
    if ((r.url ?? null) !== (value ?? null)) onCommit(r.url);
  };

  return (
    <>
      <FieldRow label={label}>
        <TextInput
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="amazon.com/…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "product-url-error" : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) {
              setError(null);
              onValidityChange?.(true);
            }
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          data-testid="product-url-input"
        />
      </FieldRow>
      {error ? (
        <div className="ios-row">
          <p id="product-url-error" role="alert" className="ios-row-inner ml-4 flex min-h-tap items-center gap-2 pr-4 text-subhead text-sys-red-text">
            <Icon name="exclamationmark.triangle" size={16} />
            {error}
          </p>
        </div>
      ) : null}
    </>
  );
}

const linkBase = "max-w-full min-w-0";

/**
 * Open-only link buttons under the item photo: "Default · amazon.com" (the
 * item's productUrl) first, then one glass button per extra link. Nothing is
 * rendered when there are no links, so such items look exactly as before.
 */
export function ItemLinkButtons({
  productUrl,
  links,
  className = "",
}: {
  productUrl: string | null | undefined;
  links: ItemLink[] | undefined;
  className?: string;
}) {
  const extras = (links ?? []).filter((l) => l.url !== productUrl);
  if (!productUrl && !extras.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} data-testid="item-links">
      {productUrl ? (
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "secondary", size: "sm", className: linkBase })}
          data-testid="open-product-link"
        >
          <Icon name="arrow.up.right.square" size={18} strokeWidth={2} />
          <span className="truncate">Default · {productHost(productUrl)}</span>
          <span className="sr-only">, opens in a new tab</span>
        </a>
      ) : null}
      {extras.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "gray", size: "sm", className: linkBase })}
          data-testid="item-link"
        >
          <Icon name="arrow.up.right.square" size={18} strokeWidth={2} />
          <span className="truncate">{l.label}</span>
          <span className="sr-only">, opens {productHost(l.url)} in a new tab</span>
        </a>
      ))}
    </div>
  );
}

type LinkRow = { key: number; label: string; url: string; error: string | null };

/**
 * "More Links" editor: label + URL + remove per row, "Add Link" (max 6).
 * Validates on blur (https only). Only valid rows are saved, always through
 * sanitizeItemLinks; a row with an error stays on screen until it's fixed or
 * removed. `onCommit(undefined)` removes the field.
 */
export function ItemLinksField({
  links,
  onCommit,
}: {
  links: ItemLink[] | undefined;
  onCommit: (links: ItemLink[] | undefined) => void;
}) {
  const nextKey = useRef(1);
  const toRows = (ls: ItemLink[] | undefined): LinkRow[] =>
    (ls ?? []).map((l) => ({ key: nextKey.current++, label: l.label, url: l.url, error: null }));
  const [rows, setRows] = useState<LinkRow[]>(() => toRows(links));
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const sig = JSON.stringify(links ?? null);
  const saved = useRef(sig);
  useEffect(() => {
    // Changed elsewhere (sync, another tab): show the stored links.
    if (sig !== saved.current) {
      saved.current = sig;
      setRows(toRows(links));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const commit = (next: LinkRow[]) => {
    const valid: ItemLink[] = [];
    const checked = next.map((r) => {
      if (!r.url.trim()) return { ...r, error: null };
      const res = normalizeLinkUrl(r.url);
      if (!res.ok || !res.url) return { ...r, error: res.ok ? null : res.error };
      valid.push({ label: r.label, url: res.url });
      return { ...r, url: res.url, error: null };
    });
    const clean = sanitizeItemLinks(valid);
    // Show what was stored: cleaned labels, duplicates dropped; keep empty/invalid rows being edited.
    const byUrl = new Map((clean ?? []).map((l) => [l.url, l]));
    const shown: LinkRow[] = [];
    for (const r of checked) {
      if (!r.url.trim() || r.error) {
        shown.push(r);
        continue;
      }
      const c = byUrl.get(r.url);
      if (!c) continue;
      byUrl.delete(r.url);
      shown.push({ ...r, label: c.label });
    }
    setRows(shown);
    const s = JSON.stringify(clean ?? null);
    if (s !== saved.current) {
      saved.current = s;
      onCommit(clean);
    }
  };

  const update = (key: number, patch: Partial<LinkRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ListSection header="More Links" footer={rows.length ? "Shown as buttons under the photo, after Default." : undefined}>
      {rows.map((r, i) => (
        <div className="ios-row" key={r.key} data-testid="link-row">
          <div className="ios-row-inner ml-4 flex min-h-tap items-center gap-2 pr-1">
            <input
              aria-label={`Link ${i + 1} label`}
              placeholder={r.url && !r.error ? storeLabel(r.url) : "Label"}
              maxLength={MAX_LINK_LABEL}
              value={r.label}
              autoFocus={focusKey === r.key}
              onChange={(e) => update(r.key, { label: e.target.value })}
              onBlur={() => commit(rows)}
              enterKeyHint="next"
              className="min-h-tap w-[36%] min-w-0 shrink-0 bg-transparent text-body text-label outline-none placeholder:text-label-2"
              data-testid="link-label-input"
            />
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-label={`Link ${i + 1} web address`}
              aria-invalid={r.error ? true : undefined}
              aria-describedby={r.error ? `link-error-${r.key}` : undefined}
              placeholder="https://…"
              value={r.url}
              onChange={(e) => update(r.key, { url: e.target.value, error: null })}
              onBlur={() => commit(rows)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="min-h-tap min-w-0 flex-1 bg-transparent text-right text-body text-label outline-none placeholder:text-label-2"
              data-testid="link-url-input"
            />
            <IconButton
              label={`Remove ${r.label.trim() || (r.url && !r.error ? storeLabel(r.url) : `link ${i + 1}`)}`}
              tone="red"
              onClick={() => commit(rows.filter((x) => x.key !== r.key))}
              data-testid="link-remove"
            >
              <Icon name="minus" size={18} strokeWidth={2.6} />
            </IconButton>
          </div>
          {r.error ? (
            <p
              id={`link-error-${r.key}`}
              role="alert"
              className="ml-4 flex min-h-tap items-center gap-2 pr-4 text-subhead text-sys-red-text"
            >
              <Icon name="exclamationmark.triangle" size={16} />
              {r.error}
            </p>
          ) : null}
        </div>
      ))}
      {rows.length < MAX_LINKS ? (
        <ListRow
          title="Add Link"
          tint
          onClick={() => {
            const key = nextKey.current++;
            setFocusKey(key);
            setRows((rs) => [...rs, { key, label: "", url: "", error: null }]);
          }}
        />
      ) : null}
    </ListSection>
  );
}
