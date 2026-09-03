"use client";

import { useRef, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { downloadBlob, itemsToCsv } from "@/lib/utils";

export default function DataPage() {
  const { items, activeItems, importJson, reset } = useInventory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    };
    downloadBlob(
      `home-inventory-${new Date().toISOString().slice(0, 10)}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    setMessage("Exported JSON");
  };

  const exportCsv = () => {
    downloadBlob(
      `home-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob([itemsToCsv(items)], { type: "text/csv" })
    );
    setMessage("Exported CSV");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importJson(data);
      setMessage(`Imported ${file.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Data</h1>
        <p className="text-sm text-ink-muted">
          {activeItems.length} active · {items.length} total (incl. archived). Stored in
          localStorage, seeded from seed.json on first visit.
        </p>
      </div>

      <section className="rounded-2xl bg-accent-soft/60 px-4 py-3 text-sm text-ink">
        <p className="font-semibold">Install on iPhone</p>
        <p className="mt-1 text-ink-muted">
          Safari → Share → <strong>Add to Home Screen</strong> for a full-screen app with offline shell caching.
        </p>
      </section>

      {message ? (
        <div className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{message}</div>
      ) : null}

      <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
        <h2 className="font-semibold text-ink">Export</h2>
        <button
          type="button"
          onClick={exportJson}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="w-full rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium text-ink"
        >
          Export CSV
        </button>
      </section>

      <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
        <h2 className="font-semibold text-ink">Import JSON</h2>
        <p className="text-sm text-ink-muted">
          Replaces current inventory with the imported file.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium text-ink"
        >
          Choose JSON file…
        </button>
      </section>

      <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
        <h2 className="font-semibold text-ink">Reset</h2>
        <p className="text-sm text-ink-muted">
          Restore the original 97 seed items. This overwrites local changes.
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset inventory to seed data?")) {
              reset();
              setMessage("Reset to seed data");
            }
          }}
          className="w-full rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          Reset to seed
        </button>
      </section>
    </div>
  );
}
