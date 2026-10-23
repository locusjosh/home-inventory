"use client";

import { useEffect, useState } from "react";
import { FieldRow, TextInput } from "./ui/Form";
import { Icon } from "./ui/Icon";
import { buttonClass } from "./ui/Button";
import { normalizeProductUrl, productHost } from "@/lib/productUrl";

/**
 * Grouped-form row for the optional product link. Validates/normalises on
 * blur (adds https:// when missing) and reports errors inline. `onCommit`
 * receives the normalised URL (or null when cleared) only when valid.
 */
export function ProductUrlField({
  value,
  onCommit,
  onValidityChange,
}: {
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
      <FieldRow label="Product Link">
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

/** Open-only link to the product page (new tab, rel=noopener). */
export function OpenProductLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant: "secondary", size: "sm", className })}
      data-testid="open-product-link"
    >
      <Icon name="arrow.up.right.square" size={18} strokeWidth={2} />
      Open Product · {productHost(url)}
    </a>
  );
}
