/** Prefix public asset paths with Next.js basePath for raw <img src>. */
export function assetPath(path: string | null | undefined): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "/home-inventory").replace(
    /\/$/,
    ""
  );
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === base || p.startsWith(`${base}/`)) return p;
  return `${base}${p}`;
}

/** Soft category gradients for photo fallbacks */
export const FOLDER_GRADIENTS: Record<string, string> = {
  Bathroom: "from-violet-400/90 via-fuchsia-400/70 to-rose-300/80",
  Cleaning: "from-teal-400/90 via-cyan-400/70 to-sky-300/80",
  Family: "from-rose-400/90 via-orange-300/70 to-amber-200/80",
  Kitchen: "from-amber-400/90 via-orange-300/70 to-yellow-200/80",
  Laundry: "from-sky-400/90 via-blue-400/70 to-indigo-300/80",
  Maintenance: "from-slate-500/90 via-zinc-400/70 to-stone-300/80",
  Outside: "from-emerald-400/90 via-lime-400/70 to-teal-300/80",
  "Suggested Items": "from-indigo-400/90 via-violet-400/70 to-purple-300/80",
};

export function folderGradient(folder: string): string {
  return FOLDER_GRADIENTS[folder] ?? "from-indigo-400/90 via-slate-400/70 to-zinc-300/80";
}

/** Refined 1–2 letter monogram from item name */
export function itemMonogram(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (cleaned.slice(0, 2) || "?").toUpperCase();
}
