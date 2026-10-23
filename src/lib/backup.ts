import type { InventoryState } from "./types";
import { exportPhotos } from "./photoStore";
import { STATE_VERSION } from "./storage";

/** Full JSON backup (format v5): items, purchases, receipts and every user photo on this device. */
export async function buildBackupJson(state: Pick<InventoryState, "items" | "purchases" | "receipts">): Promise<string> {
  let photos: Record<string, string> = {};
  try {
    photos = await exportPhotos();
  } catch (err) {
    console.error(err);
  }
  // stateVersion lets imports know which data migrations still apply.
  const payload = {
    version: 5,
    stateVersion: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    items: state.items,
    purchases: state.purchases ?? [],
    receipts: state.receipts ?? [],
    photos,
  };
  return JSON.stringify(payload, null, 2);
}
