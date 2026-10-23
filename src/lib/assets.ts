import type { IconName } from "@/components/ui/Icon";

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
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "/home-inventory").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === base || p.startsWith(`${base}/`)) return p;
  return `${base}${p}`;
}

/** Symbol + hue for items without a verified product photo. */
export type ItemSymbol = { icon: IconName; hue: "blue" | "teal" | "orange" | "indigo" | "pink" | "gray" | "green" | "red" };

const RULES: [RegExp, ItemSymbol][] = [
  [/batter/i, { icon: "battery", hue: "green" }],
  [/charger|cable/i, { icon: "bolt", hue: "gray" }],
  [/fire ext/i, { icon: "flame", hue: "red" }],
  [/flashlight|torch/i, { icon: "flashlight", hue: "gray" }],
  [/scissor|clipper|tweezer|razor/i, { icon: "scissors", hue: "gray" }],
  [/duct tape|^tape|glue/i, { icon: "tape", hue: "orange" }],
  [/snake|plunger|wd-?40|grip pad|tool/i, { icon: "wrench", hue: "orange" }],
  [/thermometer/i, { icon: "thermometer", hue: "red" }],
  [/pain|pill|reliever|medic/i, { icon: "pills", hue: "pink" }],
  [/sunscreen/i, { icon: "sun", hue: "orange" }],
  [/salt|pepper/i, { icon: "shaker", hue: "gray" }],
  [/measuring|cup/i, { icon: "cup", hue: "teal" }],
  [/floss|mouthwash|tooth/i, { icon: "tooth", hue: "teal" }],
  [/sponge/i, { icon: "sponge", hue: "green" }],
  [/towel|napkin|parchment|wrap/i, { icon: "sheets", hue: "indigo" }],
  [/cleaner|deodorizer|spray/i, { icon: "spray", hue: "blue" }],
  [/pods|detergent/i, { icon: "bubbles", hue: "blue" }],
  [/wash|shampoo|conditioner|soap|deodorant|oil/i, { icon: "drop", hue: "blue" }],
  [/fork|spoon|plate/i, { icon: "fork", hue: "gray" }],
];

export function itemSymbol(name: string): ItemSymbol {
  for (const [re, sym] of RULES) if (re.test(name)) return sym;
  return { icon: "shippingbox", hue: "gray" };
}

/** Foreground / background pairs (graphic contrast ≥ 3:1 in both themes). */
export const HUES: Record<ItemSymbol["hue"], { fg: string; fgDark: string; bg: string }> = {
  blue: { fg: "#0a66c8", fgDark: "#64b0ff", bg: "rgba(0,113,227,0.12)" },
  teal: { fg: "#0b7a8a", fgDark: "#5ed3e6", bg: "rgba(48,176,199,0.14)" },
  orange: { fg: "#b65200", fgDark: "#ffb340", bg: "rgba(255,149,0,0.15)" },
  indigo: { fg: "#4b44c8", fgDark: "#a5a1ff", bg: "rgba(88,86,214,0.16)" },
  pink: { fg: "#c41d5a", fgDark: "#ff7a9c", bg: "rgba(255,45,85,0.13)" },
  gray: { fg: "#55555a", fgDark: "#c7c7cc", bg: "rgba(118,118,128,0.16)" },
  green: { fg: "#1d7a34", fgDark: "#5fdc7f", bg: "rgba(52,199,89,0.15)" },
  red: { fg: "#c4141b", fgDark: "#ff6b62", bg: "rgba(255,59,48,0.13)" },
};
