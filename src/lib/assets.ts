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

/** Strong saturated category gradients for photo fallbacks */
export const FOLDER_GRADIENTS: Record<string, string> = {
  Bathroom: "from-violet-600 via-fuchsia-500 to-rose-400",
  Cleaning: "from-teal-600 via-cyan-500 to-sky-400",
  Family: "from-rose-600 via-orange-500 to-amber-400",
  Kitchen: "from-amber-600 via-orange-500 to-yellow-400",
  Laundry: "from-sky-600 via-blue-500 to-indigo-400",
  Maintenance: "from-slate-700 via-zinc-500 to-stone-400",
  Outside: "from-emerald-700 via-lime-500 to-teal-400",
  "Suggested Items": "from-indigo-700 via-violet-500 to-purple-400",
};

export function folderGradient(folder: string): string {
  return (
    FOLDER_GRADIENTS[folder] ?? "from-indigo-700 via-slate-500 to-zinc-400"
  );
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

/** Simple category glyph (unicode) for fallback tiles */
export function folderGlyph(folder: string): string {
  switch (folder) {
    case "Bathroom":
      return "🛁";
    case "Cleaning":
      return "✨";
    case "Family":
      return "🏠";
    case "Kitchen":
      return "🍳";
    case "Laundry":
      return "🧺";
    case "Maintenance":
      return "🔧";
    case "Outside":
      return "🌿";
    case "Suggested Items":
      return "💡";
    default:
      return "📦";
  }
}
