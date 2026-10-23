/** Settings that follow the account across devices. Stored in localStorage as before. */
import { loadVoiceRepliesEnabled, saveVoiceRepliesEnabled } from "../voice";

export const THEME_KEY = "home-inventory-theme";
export type Appearance = "auto" | "light" | "dark";
export type SyncedSettings = { theme: Appearance; voiceReplies: boolean };

export function readSettings(): SyncedSettings {
  let theme: Appearance = "auto";
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") theme = v;
  } catch {
    /* ignore */
  }
  return { theme, voiceReplies: loadVoiceRepliesEnabled() };
}

export function applyTheme(v: Appearance) {
  try {
    if (v === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, v);
  } catch {
    /* ignore */
  }
  const w = window as unknown as { __applyTheme?: () => void };
  if (w.__applyTheme) w.__applyTheme();
  else
    document.documentElement.classList.toggle(
      "dark",
      v === "dark" || (v === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
}

export function writeSettings(s: Partial<SyncedSettings>) {
  if (s.theme === "auto" || s.theme === "light" || s.theme === "dark") applyTheme(s.theme);
  if (typeof s.voiceReplies === "boolean") saveVoiceRepliesEnabled(s.voiceReplies);
  window.dispatchEvent(new Event("hi-settings-changed"));
}
