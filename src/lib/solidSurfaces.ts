/**
 * "Solid Surfaces" display preference. Device-local only: stored in
 * localStorage under its own key, never read by sync, backup or export.
 * When on, <html class="solid"> forces the same solid fallbacks as
 * prefers-reduced-transparency (see globals.css).
 */
export const SOLID_KEY = "home-inventory-solid-surfaces";

export function readSolidSurfaces(): boolean {
  try {
    return localStorage.getItem(SOLID_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSolidSurfaces(on: boolean) {
  try {
    if (on) localStorage.setItem(SOLID_KEY, "1");
    else localStorage.removeItem(SOLID_KEY);
  } catch {
    /* ignore */
  }
  document.documentElement.classList.toggle("solid", on);
}
