"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import { PinError, pinSignIn } from "@/lib/sync/engine";

const LEN = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;
const LETTERS: Record<string, string> = { "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ" };

function fmt(s: number) {
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.ceil((s % 3600) / 60)} min`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** iOS passcode-style 4-digit pad: dots, 44pt+ round keys, shake on a wrong code, locked countdown. */
export function PinPad() {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = remaining > 0;

  useEffect(() => {
    if (!lockedUntil) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lockedUntil]);
  useEffect(() => {
    if (lockedUntil && !locked) {
      setLockedUntil(null);
      setMessage(null);
    }
  }, [locked, lockedUntil]);

  const submit = useCallback(async (pin: string) => {
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await pinSignIn(pin);
    } catch (err) {
      setDigits("");
      if (err instanceof PinError && err.kind === "locked") {
        setLockedUntil(Date.now() + err.retryAfter * 1000);
        setNow(Date.now());
      } else if (err instanceof PinError && err.kind === "wrong") {
        setShake((n) => n + 1);
        setMessage("Incorrect code. Try again.");
        if (navigator.vibrate) navigator.vibrate(120);
      } else {
        setMessage(err instanceof Error ? err.message : "Couldn’t sign in. Try again in a moment.");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const press = useCallback(
    (k: string) => {
      if (busyRef.current || locked) return;
      if (k === "del") {
        setDigits((d) => d.slice(0, -1));
        return;
      }
      setDigits((d) => {
        if (d.length >= LEN) return d;
        const next = d + k;
        if (next.length === LEN) void submit(next);
        return next;
      });
    },
    [locked, submit]
  );

  // Hardware keyboard: digits + Backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="ios-row px-4 pb-4 pt-5" data-testid="pin-pad">
      <p className="text-center text-headline text-label">{locked ? "Code sign-in locked" : "Enter Code"}</p>
      <div
        key={shake}
        className={`mt-4 flex justify-center gap-5 ${shake ? "animate-pin-shake" : ""}`}
        data-testid="pin-dots"
        data-filled={digits.length}
        role="img"
        aria-label={`${digits.length} of ${LEN} digits entered`}
      >
        {Array.from({ length: LEN }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-[1.5px] ${
              i < digits.length ? "border-label bg-label" : "border-label-2 bg-transparent"
            } transition-colors duration-100`}
          />
        ))}
      </div>
      <p
        className={`mt-3 min-h-[40px] text-center text-subhead ${message && !locked ? "text-sys-red-text" : "text-label-2"}`}
        role={locked || message ? "alert" : undefined}
        aria-live="polite"
        data-testid="pin-message"
      >
        {locked ? (
          <>
            Too many tries. Try again in <span className="tabular-nums" data-testid="pin-countdown">{fmt(remaining)}</span>. You can keep using the app on devices that are already signed in.
          </>
        ) : busy ? (
          "Checking…"
        ) : (
          message ?? ""
        )}
      </p>
      <div className="mx-auto mt-1 grid w-full max-w-[288px] grid-cols-3 justify-items-center gap-x-6 gap-y-3.5">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} aria-hidden />
          ) : k === "del" ? (
            <button
              key={i}
              type="button"
              onClick={() => press("del")}
              disabled={busy || locked || !digits.length}
              aria-label="Delete"
              data-testid="pin-delete"
              className="pressable focus-ring flex h-[72px] w-[72px] items-center justify-center rounded-full text-label disabled:text-label-3"
            >
              <Icon name="delete.left" size={26} strokeWidth={1.8} />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={busy || locked}
              aria-label={k}
              data-testid={`pin-key-${k}`}
              className="pressable focus-ring flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-fill-3 text-label active:bg-fill-2 disabled:text-label-2"
            >
              <span className="text-[30px] font-normal leading-none tabular-nums">{k}</span>
              {LETTERS[k] ? (
                <span className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-label-2" aria-hidden>
                  {LETTERS[k]}
                </span>
              ) : null}
            </button>
          )
        )}
      </div>
    </div>
  );
}
