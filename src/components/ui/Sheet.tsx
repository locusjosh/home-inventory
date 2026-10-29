"use client";

import { useEffect, type ReactNode } from "react";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (document.activeElement as HTMLElement | null)?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
}

/** Card-style modal sheet with grabber and an iOS navigation row. */
export function Sheet({
  open,
  onClose,
  title,
  leading,
  trailing,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  useLockScroll(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        className="scrim animate-fade-in absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="animate-sheet-up relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden sheet-surface rounded-t-[24px] sm:rounded-[24px]">
        <div className="flex justify-center pt-1.5">
          <span className="h-[5px] w-9 rounded-full bg-fill" aria-hidden />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2">
          <div className="flex justify-start">{leading}</div>
          <h2 className="truncate px-2 text-headline text-label">{title}</h2>
          <div className="flex justify-end">{trailing}</div>
        </div>
        <div
          className="overflow-y-auto overscroll-contain px-4 pb-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export type ActionItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  href?: string;
  external?: boolean;
  checked?: boolean;
  /**
   * Render as a <label for=…> targeting a (visually hidden) file input, so the
   * native picker opens from the user's own tap — iOS keeps the gesture chain.
   */
  htmlFor?: string;
};

/** iOS action sheet: grouped actions + separate Cancel. */
export function ActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionItem[];
}) {
  useLockScroll(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title ?? "Actions"}>
      <button
        type="button"
        aria-label="Cancel"
        className="scrim animate-fade-in absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className="animate-sheet-up relative z-10 w-full max-w-lg space-y-2 px-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sheet-surface overflow-hidden rounded-[20px]">
          {title || message ? (
            <div className="px-4 py-3.5 text-center">
              {title ? <p className="text-footnote font-semibold text-label-2">{title}</p> : null}
              {message ? <p className="mt-0.5 text-footnote text-label-2">{message}</p> : null}
            </div>
          ) : null}
          {actions.map((a, i) => {
            const cls = `pressable flex min-h-[57px] w-full items-center justify-center px-4 text-[20px] leading-6 active:bg-fill-4 ${
              a.destructive ? "text-sys-red-text" : "text-tint"
            } ${i > 0 || title || message ? "shadow-[inset_0_0.5px_0_var(--separator)]" : ""}`;
            if (a.href) {
              return (
                <a
                  key={a.label}
                  href={a.href}
                  target={a.external ? "_blank" : undefined}
                  rel={a.external ? "noopener noreferrer" : undefined}
                  className={cls}
                  onClick={() => {
                    a.onSelect();
                    onClose();
                  }}
                >
                  {a.label}
                </a>
              );
            }
            if (a.htmlFor) {
              return (
                <label
                  key={a.label}
                  htmlFor={a.htmlFor}
                  role="button"
                  className={`${cls} cursor-pointer`}
                  onClick={() => {
                    a.onSelect();
                    // Close after the label's native activation has opened the picker.
                    setTimeout(onClose, 0);
                  }}
                >
                  {a.label}
                </label>
              );
            }
            return (
              <button
                key={a.label}
                type="button"
                className={cls}
                onClick={() => {
                  onClose();
                  a.onSelect();
                }}
                aria-pressed={a.checked}
              >
                <span className={a.checked ? "font-semibold" : undefined}>{a.label}</span>
                {a.checked ? <span className="ml-2" aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pressable flex min-h-[57px] w-full items-center justify-center sheet-surface sheet-opaque rounded-[20px] text-[20px] font-semibold leading-6 text-tint active:bg-fill-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
