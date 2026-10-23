"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconTile, ListRow, ListSection } from "./ui/List";
import { FieldRow, TextInput } from "./ui/Form";
import { ActionSheet } from "./ui/Sheet";
import { Icon } from "./ui/Icon";
import { requestCode, signOut, syncNow, verifyCode, SyncAuthError } from "@/lib/sync/engine";
import { statusText, useNow, useSyncStatus } from "@/lib/sync/useSync";
import { PinPad } from "./PinPad";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [mode, setMode] = useState<"pin" | "email">("pin");
  if (mode === "pin") {
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
        <PinPad onUseEmail={() => setMode("email")} />
      </ListSection>
    );
  }
  return <EmailSignIn starting={starting} onUsePin={() => setMode("pin")} />;
}

function EmailSignIn({ starting, onUsePin }: { starting: boolean; onUsePin: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const emailOk = EMAIL_RE.test(email.trim());
  const codeOk = /^\d{6}$/.test(code.trim());

  const send = async () => {
    if (!emailOk) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestCode(email);
      setStep("code");
      setCode("");
      setNotice(`We sent a 6-digit code to ${email.trim()}.`);
    } catch (err) {
      setError(err instanceof SyncAuthError ? err.message : "Couldn’t send the code. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!codeOk) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, code);
    } catch (err) {
      setError(err instanceof SyncAuthError ? err.message : "Couldn’t sign in. Try again in a moment.");
      setBusy(false);
    }
  };

  const footer = (
    <>
      {error ? (
        <span role="alert" data-testid="sync-error" className="block text-sys-red-text">
          {error}
        </span>
      ) : null}
      <span className="block">
        {step === "email"
          ? "We’ll email you a 6-digit code — use this if the 4-digit code is locked or forgotten."
          : notice ?? "Enter the 6-digit code from the email."}
      </span>
    </>
  );

  return (
    <ListSection header="Sync" footer={footer}>
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
      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <FieldRow label="Email">
            <TextInput
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              data-testid="sync-email"
            />
          </FieldRow>
          <RowButton testId="sync-send-code" onClick={() => void send()} disabled={busy || !email.trim() || starting}>
            {busy ? "Sending…" : "Send Code"}
          </RowButton>
          <RowButton testId="sync-use-pin" onClick={onUsePin} disabled={busy}>
            Use 4-Digit Code Instead
          </RowButton>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <FieldRow label="Code">
            <TextInput
              ref={codeRef}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="6 digits"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={Boolean(error)}
              data-testid="sync-code"
              className="tabular-nums tracking-[0.2em]"
            />
          </FieldRow>
          <RowButton testId="sync-verify" onClick={() => void verify()} disabled={busy || !codeOk}>
            {busy ? "Signing In…" : "Sign In"}
          </RowButton>
          <RowButton testId="sync-resend" onClick={() => void send()} disabled={busy}>
            Send a New Code
          </RowButton>
          <RowButton
            testId="sync-change-email"
            onClick={() => {
              setStep("email");
              setError(null);
              setNotice(null);
            }}
            disabled={busy}
          >
            Use a Different Email
          </RowButton>
        </form>
      )}
    </ListSection>
  );
}
