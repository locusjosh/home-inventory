/**
 * SF Symbols–style line glyphs (hand-drawn SVG, 24pt grid, round caps).
 * Use `size` for the point size; color follows currentColor.
 */
import type { SVGProps } from "react";

export type IconName =
  | "chevron.right"
  | "chevron.left"
  | "chevron.down"
  | "plus"
  | "minus"
  | "magnifyingglass"
  | "mic"
  | "stop"
  | "arrow.up"
  | "speaker"
  | "speaker.slash"
  | "ellipsis"
  | "checkmark"
  | "checkmark.circle"
  | "camera"
  | "photo"
  | "doc.text"
  | "square.and.arrow.up"
  | "square.and.arrow.down"
  | "trash"
  | "archivebox"
  | "lightbulb"
  | "exclamationmark.triangle"
  | "cart"
  | "list"
  | "square.grid"
  | "checklist"
  | "sparkles"
  | "ellipsis.circle"
  | "info.circle"
  | "xmark"
  | "xmark.circle"
  | "receipt"
  | "plus.square"
  | "externaldrive"
  | "arrow.counterclockwise"
  | "circle.lefthalf"
  | "bag"
  | "arrow.up.arrow.down"
  | "iphone"
  | "waveform"
  /* item symbols */
  | "battery"
  | "drop"
  | "bubbles"
  | "sheets"
  | "flame"
  | "flashlight"
  | "scissors"
  | "tape"
  | "wrench"
  | "thermometer"
  | "pills"
  | "bolt"
  | "sun"
  | "shaker"
  | "cup"
  | "shippingbox"
  | "tooth"
  | "spray"
  | "sponge"
  | "fork";

type Props = { name: IconName; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>;

export function Icon({ name, size = 22, strokeWidth = 1.8, ...rest }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
  const dot = (cx: number, cy: number, r = 1.4) => (
    <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
  );
  switch (name) {
    case "chevron.right":
      return <svg {...common}><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></svg>;
    case "chevron.left":
      return <svg {...common}><path d="M15 4.5 7.5 12l7.5 7.5" /></svg>;
    case "chevron.down":
      return <svg {...common}><path d="m6 9.5 6 6 6-6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "magnifyingglass":
      return <svg {...common}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>;
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      );
    case "stop":
      return <svg {...common}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" /></svg>;
    case "arrow.up":
      return <svg {...common}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case "speaker":
      return (
        <svg {...common}>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </svg>
      );
    case "speaker.slash":
      return (
        <svg {...common}>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
          <path d="m16 9.5 5 5M21 9.5l-5 5" />
        </svg>
      );
    case "ellipsis":
      return <svg {...common}>{dot(6, 12, 1.6)}{dot(12, 12, 1.6)}{dot(18, 12, 1.6)}</svg>;
    case "ellipsis.circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" />{dot(8, 12, 1.2)}{dot(12, 12, 1.2)}{dot(16, 12, 1.2)}</svg>;
    case "checkmark":
      return <svg {...common}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
    case "checkmark.circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5.5-6" /></svg>;
    case "camera":
      return (
        <svg {...common}>
          <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5l1.5-2h6l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "photo":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
        </svg>
      );
    case "doc.text":
      return (
        <svg {...common}>
          <path d="M6.5 3.5h7l4 4v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
          <path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
          <path d="M9 8h6M9 11.5h6M9 15h3.5" />
        </svg>
      );
    case "square.and.arrow.up":
      return (
        <svg {...common}>
          <path d="M12 14.5V3.5M8 7l4-4 4 4" />
          <path d="M8.5 10H6.5a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1h-2" />
        </svg>
      );
    case "square.and.arrow.down":
      return (
        <svg {...common}>
          <path d="M12 3.5v11M8 10.5l4 4 4-4" />
          <path d="M8.5 10H6.5a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1h-2" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13M10 10.5v6M14 10.5v6" />
        </svg>
      );
    case "archivebox":
      return (
        <svg {...common}>
          <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
          <path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10M10 12h4" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg {...common}>
          <path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-.6c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z" />
        </svg>
      );
    case "exclamationmark.triangle":
      return (
        <svg {...common}>
          <path d="M10.3 4.5 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9.5v4.5" />{dot(12, 17.2, 1.1)}
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <path d="M2.5 4h2.6l2.2 11h10.4l2-7.5H6.2" />
          {dot(9, 19.5, 1.5)}{dot(17, 19.5, 1.5)}
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M5 8h14l-1 12.5H6z" />
          <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          {dot(5, 6.5, 1.3)}{dot(5, 12, 1.3)}{dot(5, 17.5, 1.3)}
          <path d="M9 6.5h11M9 12h11M9 17.5h11" />
        </svg>
      );
    case "square.grid":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...common}>
          <path d="m3.5 6.5 1.8 1.8L8.5 5M3.5 13.5l1.8 1.8 3.2-3.3M11.5 7h9M11.5 14h9M11.5 19.5h9" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M10 3.5 11.6 8 16 9.5 11.6 11 10 15.5 8.4 11 4 9.5 8.4 8z" fill="currentColor" stroke="none" />
          <path d="M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "waveform":
      return <svg {...common}><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3" /></svg>;
    case "info.circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" />{dot(12, 7.8, 1.1)}</svg>;
    case "xmark":
      return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "xmark.circle":
      return <svg {...common}><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity="0.9" /><path d="m9 9 6 6M15 9l-6 6" stroke="var(--bg-grouped-2)" /></svg>;
    case "plus.square":
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;
    case "externaldrive":
      return (
        <svg {...common}>
          <path d="M3.5 14 6 6h12l2.5 8v4a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />
          <path d="M3.5 14h17" />{dot(16.5, 16.8, 1)}
        </svg>
      );
    case "arrow.counterclockwise":
      return <svg {...common}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9" /></svg>;
    case "circle.lefthalf":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" /></svg>;
    case "arrow.up.arrow.down":
      return <svg {...common}><path d="M8 19V5M4.5 8.5 8 5l3.5 3.5M16 5v14M12.5 15.5 16 19l3.5-3.5" /></svg>;
    case "iphone":
      return <svg {...common}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 5h3" /></svg>;
    /* --- Item symbols --- */
    case "battery":
      return (
        <svg {...common}>
          <rect x="2.5" y="7.5" width="16.5" height="9" rx="2.2" />
          <path d="M21.5 10.5v3" />
          <rect x="4.8" y="9.8" width="8.5" height="4.4" rx="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "drop":
      return <svg {...common}><path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z" /><path d="M9.2 15a3 3 0 0 0 2.3 2.6" /></svg>;
    case "bubbles":
      return <svg {...common}><circle cx="9" cy="14" r="5" /><circle cx="16.5" cy="8" r="3.2" /><circle cx="18" cy="16.5" r="1.8" /></svg>;
    case "sheets":
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M5 8.5h14M5 13.5h14" />
        </svg>
      );
    case "flame":
      return <svg {...common}><path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3.5-9.5-2 1.5-3 3.5-3 5.5-1-.5-1.7-1.5-2-2.5C7.9 10 6 12.3 6 15a6 6 0 0 0 6 6Z" /></svg>;
    case "flashlight":
      return (
        <svg {...common}>
          <path d="M8 3.5h8l-1.5 5v11a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-11z" />
          <path d="M8.3 4.5h7.4M12 12v2.5" />
        </svg>
      );
    case "scissors":
      return (
        <svg {...common}>
          <circle cx="6.5" cy="17.5" r="2.8" /><circle cx="17.5" cy="17.5" r="2.8" />
          <path d="M8.5 15.5 18 3.5M15.5 15.5 6 3.5" />
        </svg>
      );
    case "tape":
      return <svg {...common}><circle cx="10" cy="12" r="6.5" /><circle cx="10" cy="12" r="2.5" /><path d="M16.5 12h4v3.5h-6" /></svg>;
    case "wrench":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0 5 5L12.5 18.5a2.1 2.1 0 1 1-3-3L16.7 8.3" />
          <path d="M14.7 6.3a4 4 0 0 1 4.9-2.8l-2.6 2.6.5 2.4 2.4.5 2.6-2.6a4 4 0 0 1-2.8 4.9" />
        </svg>
      );
    case "thermometer":
      return <svg {...common}><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 9v7" /></svg>;
    case "pills":
      return (
        <svg {...common}>
          <rect x="2.8" y="9" width="13" height="6.5" rx="3.25" transform="rotate(-35 9.3 12.25)" />
          <path d="m7.6 9.3 3.7 5.4" />
          <circle cx="17.5" cy="16.5" r="3.5" /><path d="m15 19 5-5" />
        </svg>
      );
    case "bolt":
      return <svg {...common}><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" /></svg>;
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      );
    case "shaker":
      return (
        <svg {...common}>
          <path d="M8 9h8l1 11.5H7z" /><path d="M8 9a4 4 0 0 1 8 0" />
          {dot(10.5, 6.2, 0.7)}{dot(13.5, 6.2, 0.7)}{dot(12, 4.8, 0.7)}
        </svg>
      );
    case "cup":
      return <svg {...common}><path d="M4.5 7.5h12l-1.3 11a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3z" /><path d="M16.3 10h2a2 2 0 0 1 0 4h-2.5M8 11.5h1.5M8 14.5h1.5" /></svg>;
    case "shippingbox":
      return (
        <svg {...common}>
          <path d="M12 3 20 7v10l-8 4-8-4V7z" /><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4" />
        </svg>
      );
    case "tooth":
      return <svg {...common}><path d="M7.5 4c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .5 3 1 5 2.5 5s1.5-3.5 4-3.5 2.5 3.5 4 3.5 2-2 2.5-5c.5-2.5 2-4 2-7C20.5 6 19 4 16.5 4c-2 0-2.5 1-4.5 1s-2.5-1-4.5-1Z" /></svg>;
    case "spray":
      return (
        <svg {...common}>
          <path d="M8 8.5h6l1.5 3.5v8.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V12z" />
          <path d="M9 8.5V5.5h4l3 1.5M18.5 5v.01M20.5 3.5v.01M20.5 6.8v.01" />
        </svg>
      );
    case "sponge":
      return <svg {...common}><rect x="3.5" y="7" width="17" height="10" rx="2.5" /><path d="M3.5 11h17" />{dot(8, 14, 0.8)}{dot(12, 14.5, 0.8)}{dot(16, 13.8, 0.8)}</svg>;
    case "fork":
      return <svg {...common}><path d="M8 3.5v5a2.5 2.5 0 0 0 5 0v-5M10.5 3.5v17M16.5 20.5v-17c-2 1-3 3.5-3 7h3" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}
