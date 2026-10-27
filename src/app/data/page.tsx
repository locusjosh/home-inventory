"use client";

import { useEffect, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { downloadBlob, itemsToCsv } from "@/lib/utils";
import { buildBackupJson } from "@/lib/backup";
import { applyTheme, readSettings, type Appearance } from "@/lib/sync/settings";
import { noteSettingChanged } from "@/lib/sync/engine";
import { listBackups, onOutboxChange, type BackupRecord } from "@/lib/sync/outbox";
import { useSyncStatus } from "@/lib/sync/useSync";
import { Page } from "@/components/ui/Page";
import { IconTile, ListRow, ListSection } from "@/components/ui/List";
import { SegmentedControl } from "@/components/ui/Controls";
import { ActionSheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { listSnapshots, SNAPSHOT_REASON_LABEL, type Snapshot } from "@/lib/snapshots";


export default function DataPage() {
  const { items, purchases, receipts, myItems, ideaItems, importJson, reset } = useInventory();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("auto");
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const sync = useSyncStatus();
  const synced = sync.configured && sync.phase !== "signed-out" && sync.phase !== "starting";

  useEffect(() => {
    const read = () => setAppearance(readSettings().theme);
    read();
    window.addEventListener("hi-settings-changed", read);
    return () => window.removeEventListener("hi-settings-changed", read);
  }, []);

  useEffect(() => {
    void listSnapshots().then(setSnapshots).catch(() => setSnapshots([]));
  }, []);

  useEffect(() => {
    const load = () => void listBackups().then(setBackups).catch(() => setBackups([]));
    load();
    return onOutboxChange(load);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  const changeAppearance = (v: Appearance) => {
    setAppearance(v);
    applyTheme(v);
    noteSettingChanged("theme");
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportJson = async () => {
    const json = await buildBackupJson({ items, purchases, receipts });
    downloadBlob(`home-inventory-${stamp()}.json`, new Blob([json], { type: "application/json" }));
    setMessage("Backup exported");
  };

  const downloadPreSync = (b: BackupRecord) => {
    downloadBlob(`home-inventory-before-sync-${b.createdAt.slice(0, 10)}.json`, new Blob([b.json], { type: "application/json" }));
    setMessage("Backup downloaded");
  };

  const downloadSnapshot = (s: Snapshot) => {
    downloadBlob(`home-inventory-snapshot-${s.createdAt.slice(0, 10)}.json`, new Blob([s.json], { type: "application/json" }));
    setMessage("Snapshot downloaded");
  };

  const exportCsv = () => {
    downloadBlob(`home-inventory-${stamp()}.csv`, new Blob([itemsToCsv(items)], { type: "text/csv" }));
    setMessage("Spreadsheet exported");
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const n = await importJson(data);
      setMessage(n ? `Restored ${n} photo${n === 1 ? "" : "s"} and items` : `Restored from ${file.name}`);
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
          footer={
            synced
              ? "Saved on this iPhone and synced to your account. Exporting a backup now and then is still a good idea."
              : "Saved on this iPhone only. Export a backup now and then, or turn on Sync in More."
          }
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

        <ListSection
          header="Backup"
          footer={
            synced
              ? "Restoring replaces this iPhone’s data with the file and syncs it. Items that exist only in your account come back on the next sync."
              : "Restoring replaces everything on this iPhone with the file’s contents."
          }
        >
          <ListRow
            onClick={() => void exportJson()}
            leading={<IconTile color="#0071e3"><Icon name="square.and.arrow.up" size={18} strokeWidth={2} /></IconTile>}
            title="Export Backup"
            subtitle="JSON · items, photos, purchases, receipts, count log"
          />
          <ListRow
            onClick={exportCsv}
            leading={<IconTile color="#0071e3"><Icon name="doc.text" size={18} strokeWidth={2} /></IconTile>}
            title="Export Spreadsheet"
            subtitle="CSV · items only"
          />
          <ListRow
            htmlFor="restore-backup-input"
            leading={<IconTile color="#636366"><Icon name="square.and.arrow.down" size={18} strokeWidth={2} /></IconTile>}
            title="Restore from Backup…"
          />
        </ListSection>
        <input
          id="restore-backup-input"
          type="file"
          accept="application/json,.json"
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />

        {backups.length ? (
          <ListSection
            header="Before Sync"
            footer="A full copy of this iPhone’s data, saved automatically the first time it synced. Restore it with Restore from Backup."
          >
            {backups.map((b) => (
              <ListRow
                key={b.id}
                onClick={() => downloadPreSync(b)}
                leading={<IconTile color="#0071e3"><Icon name="square.and.arrow.down" size={18} strokeWidth={2} /></IconTile>}
                title="Download Pre-Sync Backup"
                subtitle={`${new Date(b.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${b.email ? ` · ${b.email}` : ""}`}
                ariaLabel={`Download pre-sync backup from ${new Date(b.createdAt).toLocaleString()}`}
              />
            ))}
          </ListSection>
        ) : null}

        {snapshots.length ? (
          <ListSection
            header="Automatic Snapshots"
            footer="Full copies of this iPhone’s data, saved before app updates change how data is stored and before Recently Deleted is emptied. Restore one with Restore from Backup."
          >
            {snapshots.map((sn) => (
              <ListRow
                key={sn.id}
                onClick={() => downloadSnapshot(sn)}
                leading={<IconTile color="#5e5ce6"><Icon name="square.and.arrow.down" size={18} strokeWidth={2} /></IconTile>}
                title={SNAPSHOT_REASON_LABEL[sn.reason] ?? "Snapshot"}
                subtitle={`${new Date(sn.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · ${sn.items} items`}
                ariaLabel={`Download snapshot from ${new Date(sn.createdAt).toLocaleString()}`}
              />
            ))}
          </ListSection>
        ) : null}

        <ListSection
          header="Install"
          footer="In Safari, tap Share, then Add to Home Screen for a full-screen app that works offline."
        >
          <ListRow
            leading={<IconTile color="#636366"><Icon name="plus.square" size={18} strokeWidth={2} /></IconTile>}
            title="Add to Home Screen"
          />
        </ListSection>

        <ListSection
          footer={
            synced
              ? "Puts back the starter list on this iPhone only. Your synced inventory isn’t deleted and downloads again on the next sync."
              : "Puts back the original starter list and removes your changes, photos, counts and purchase history."
          }
        >
          <ListRow onClick={() => setConfirmReset(true)} title="Reset to Original Data" destructive />
        </ListSection>
      </div>

      <ActionSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all inventory data?"
        message={
          synced
            ? "This iPhone goes back to the starter list, then downloads your synced inventory again. Nothing is deleted from your account."
            : "Counts, photos, purchases and edits on this iPhone will be replaced. Export a backup first if you want to keep them."
        }
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
