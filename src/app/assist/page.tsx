"use client";

import Link from "next/link";
import { InventoryChat } from "@/components/InventoryChat";

export default function AssistPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Assist</h1>
          <p className="text-sm text-ink-muted">
            Jarvis-style inventory voice & chat — stays on this phone.
          </p>
        </div>
        <Link href="/data" className="shrink-0 text-xs font-medium text-accent pressable">
          Data & export →
        </Link>
      </div>

      <section className="rounded-2xl border border-accent/15 bg-accent-soft/40 px-4 py-3 text-sm text-ink backdrop-blur">
        <p className="font-semibold">iPhone / Safari tip</p>
        <p className="mt-1 text-ink-muted">
          Allow microphone when prompted. <strong>Add to Home Screen</strong> for the best
          experience. Everything is 100% on-device — no cloud LLM or API keys.
        </p>
      </section>

      <InventoryChat variant="full" />
    </div>
  );
}
