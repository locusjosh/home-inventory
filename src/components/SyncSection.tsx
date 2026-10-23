"use client";

import { useState, type ReactNode } from "react";
import { IconTile, ListRow, ListSection } from "./ui/List";
import { ActionSheet } from "./ui/Sheet";
import { Icon } from "./ui/Icon";
import { signOut, syncNow } from "@/lib/sync/engine";
import { statusText, useNow, useSyncStatus } from "@/lib/sync/useSync";
import { PinPad } from "./PinPad";

/** Full-width tinted row button (Settings style) with a real disabled state. */
function RowButton({
  children,
  onClick,
  disabled,
  destructive,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="ios-row pressable focus-ring flex w-full items-stretch text-left active:bg-fill-4 disabled:cursor-not-allowed disabled:active:bg-transparent"
    >
      <span
        className={`ios-row-inner ml-4 flex min-h-tap flex-1 items-center py-[11px] pr-4 text-body ${
          disabled ? "text-label-2" : destructive ? "text-sys-red-text" : "text-tint"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

function SyncTile({ error }: { error?: boolean }) {
  return (
    <IconTile color={error ? "#c93400" : "#0071e3"}>
      <Icon name={error ? "icloud.exclamation" : "icloud"} size={19} strokeWidth={2} />
    </IconTile>
  );
}

export function SyncSection() {
  const s = useSyncStatus();
  const now = useNow();

  if (!s.configured) {
    return (
      <ListSection header="Sync">
        <ListRow leading={<SyncTile />} title="Sync" value={<span data-testid="sync-status">Not set up</span>} />
      </ListSection>
    );
  }

  if (s.phase === "signed-out" || s.phase === "starting") return <SignIn starting={s.phase === "starting"} />;

  return <SignedIn text={statusText(s, now)} email={s.email} phase={s.phase} />;
}

function SignedIn({ text, email, phase }: { text: string; email: string | null; phase: string }) {
  const [confirm, setConfirm] = useState(false);
  const error = phase === "error";
  return (
    <>
      <ListSection
        header="Sync"
        footer="Changes save on this iPhone first and sync when you’re online. Signing out keeps everything on this device."
      >
        <div className="ios-row flex w-full items-stretch">
          <span className="flex shrink-0 items-center py-2 pl-4">
            <SyncTile error={error} />
          </span>
          <span className="ios-row-inner ml-3 flex min-h-tap min-w-0 flex-1 items-center py-[11px] pr-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-label">{email ?? "Signed in"}</span>
              <span
                data-testid="sync-status"
                role="status"
                className={`mt-0.5 block text-subhead ${error ? "text-sys-red-text" : "text-label-2"}`}
              >
                {text}
              </span>
            </span>
          </span>
        </div>
        <RowButton testId="sync-now" onClick={() => void syncNow()} disabled={phase === "syncing"}>
          {phase === "syncing" ? "Syncing…" : "Sync Now"}
        </RowButton>
        <RowButton testId="sync-sign-out" destructive onClick={() => setConfirm(true)}>
          Sign Out
        </RowButton>
      </ListSection>
      <ActionSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Sign out of sync?"
        message="Your inventory stays on this iPhone. Changes made while signed out sync the next time you sign in."
        actions={[{ label: "Sign Out", destructive: true, onSelect: () => void signOut() }]}
      />
    </>
  );
}

function SignIn({ starting }: { starting: boolean }) {
  return (
    <ListSection header="Sync" footer="Sign in to keep this inventory in sync on all your devices. You stay signed in until you sign out.">
      <div className="ios-row flex w-full items-stretch">
        <span className="flex shrink-0 items-center py-2 pl-4">
          <SyncTile />
        </span>
        <span className="ios-row-inner ml-3 flex min-h-tap flex-1 items-center gap-3 py-[11px] pr-4">
          <span className="flex-1 text-body text-label">Sync</span>
          <span data-testid="sync-status" className="text-body text-label-2">
            {starting ? "Starting…" : "Not signed in"}
          </span>
        </span>
      </div>
      <PinPad />
    </ListSection>
  );
}
