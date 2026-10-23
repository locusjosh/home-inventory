"use client";

import { useEffect, useRef, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { downloadBlob, itemsToCsv } from "@/lib/utils";
import { Page } from "@/components/ui/Page";
import { IconTile, ListRow, ListSection } from "@/components/ui/List";
import { SegmentedControl } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";

type Appearance = "auto" | "light" | "dark";
const THEME_KEY = "home-inventory-theme";

export default function DataPage() {
  const { items, purchases, receipts, myItems, ideaItems, importJson, reset } = useInventory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("auto");

  useEffect(() => {
    const v = localStorage.getItem(THEME_KEY);
    setAppearance(v === "light" || v === "dark" ? v : "auto");
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  const changeAppearance = (v: Appearance) => {
    setAppearance(v);
    if (v === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, v);
    const w = window as unknown as { __applyTheme?: () => void };
    if (w.__applyTheme) w.__applyTheme();
    else
      document.documentElement.classList.toggle(
        "dark",
        v === "dark" || (v === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportJson = () => {
    const payload = { version: 3, exportedAt: new Date().toISOString(), items, purchases, receipts };
    downloadBlob(
      `home-inventory-${stamp()}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    );
    setMessage("Backup exported");
  };

  const exportCsv = () => {
    downloadBlob(`home-inventory-${stamp()}.csv`, new Blob([itemsToCsv(items)], { type: "text/csv" }));
    setMessage("Spreadsheet exported");
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      importJson(data);
      setMessage(`Restored from ${file.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <Page title="Data & Backup" back={{ href: "/more", label: "More" }}>
      {message ? (
        <div
          role="status"
          className="animate-fade-in fixed left-1/2 top-[calc(env(safe-area-inset-top)+52px)] z-[55] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2.5 text-footnote font-semibold text-white backdrop-blur"
        >
          {message}
        </div>
      ) : null}

      <div className="space-y-7">
        <ListSection
          header="Storage"
          footer="Saved on this iPhone only — not backed up to iCloud yet. Export a backup now and then."
        >
          <ListRow
            leading={<IconTile color="#636366"><Icon name="iphone" size={18} strokeWidth={2} /></IconTile>}
            title="On This iPhone"
            value={`${myItems.length} items`}
          />
          <ListRow
            leading={<IconTile color="#a86f00"><Icon name="lightbulb" size={18} strokeWidth={2} /></IconTile>}
            title="Ideas"
            value={ideaItems.length}
          />
          <ListRow
            leading={<IconTile color="#248a3d"><Icon name="receipt" size={18} strokeWidth={2} /></IconTile>}
            title="Purchases Logged"
            value={purchases.length}
          />
        </ListSection>

        <ListSection header="Assistant">
          <ListRow
            href="/assist"
            leading={<IconTile color="#0071e3"><Icon name="waveform" size={18} strokeWidth={2.2} /></IconTile>}
            title="Open Assistant"
            subtitle="Ask about stock by voice or text"
            chevron
          />
        </ListSection>

        <section>
          <h2 className="px-4 pb-1.5 text-footnote font-semibold text-label-2">Appearance</h2>
          <SegmentedControl<Appearance>
            ariaLabel="Appearance"
            value={appearance}
            onChange={changeAppearance}
            options={[
              { value: "auto", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </section>

        <ListSection header="Backup" footer="Restoring replaces everything on this iPhone with the file’s contents.">
          <ListRow
            onClick={exportJson}
            leading={<IconTile color="#0071e3"><Icon name="square.and.arrow.up" size={18} strokeWidth={2} /></IconTile>}
            title="Export Backup"
            subtitle="JSON · items, purchases, receipts"
          />
          <ListRow
            onClick={exportCsv}
            leading={<IconTile color="#0071e3"><Icon name="doc.text" size={18} strokeWidth={2} /></IconTile>}
            title="Export Spreadsheet"
            subtitle="CSV · items only"
          />
          <ListRow
            onClick={() => fileRef.current?.click()}
            leading={<IconTile color="#636366"><Icon name="square.and.arrow.down" size={18} strokeWidth={2} /></IconTile>}
            title="Restore from Backup…"
          />
        </ListSection>
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

        <ListSection
          header="Install"
          footer="In Safari, tap Share, then Add to Home Screen for a full-screen app that works offline."
        >
          <ListRow
            leading={<IconTile color="#636366"><Icon name="plus.square" size={18} strokeWidth={2} /></IconTile>}
            title="Add to Home Screen"
          />
        </ListSection>

        <ListSection footer="Puts back the original starter list and removes your changes, counts and purchase history.">
          <ListRow onClick={() => setConfirmReset(true)} title="Reset to Original Data" destructive />
        </ListSection>
      </div>

      <ActionSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all inventory data?"
        message="Counts, purchases and edits on this iPhone will be replaced. Export a backup first if you want to keep them."
        actions={[
          {
            label: "Reset Inventory",
            destructive: true,
            onSelect: () => {
              reset();
              setMessage("Inventory reset");
            },
          },
        ]}
      />
    </Page>
  );
}
