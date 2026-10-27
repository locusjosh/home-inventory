import type { InventoryState } from "./types";
import { exportPhotos } from "./photoStore";
import { STATE_VERSION } from "./storage";
import { exportCounts } from "./counts/store";

/**
 * Full JSON backup (format v6): items, purchases, receipts, every user photo on
 * this device, and the count sessions + count log. v6 only ADDS `counts`; files
 * from v3–v5 still import, and older app versions importing a v6 file simply
 * ignore `counts`.
 */
export async function buildBackupJson(state: Pick<InventoryState, "items" | "purchases" | "receipts">): Promise<string> {
  let photos: Record<string, string> = {};
  try {
    photos = await exportPhotos();
  } catch (err) {
    console.error(err);
  }
  // stateVersion lets imports know which data migrations still apply.
  const payload = {
    version: 6,
    stateVersion: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    items: state.items,
    purchases: state.purchases ?? [],
    receipts: state.receipts ?? [],
    photos,
    counts: exportCounts(),
  };
  return JSON.stringify(payload, null, 2);
}
