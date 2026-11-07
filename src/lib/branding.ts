import type { CSSProperties } from "react";
import type { Settings } from "./settings";

const DEFAULTS: Settings["branding"] = { primaryColor: "#1557b2", backgroundColor: "#ffffff", textColor: "#111111" };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black, whichever reads better on the given color. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.4 ? "#111111" : "#ffffff";
}

/** Colors are validated as #rrggbb by the settings schema before they get here. */
export function brandStyle(settings: Settings | null): CSSProperties {
  const b = settings?.branding ?? DEFAULTS;
  const primary = b.primaryColor;
  const accent = b.accentColor ?? primary;
  return {
    "--brand": primary,
    "--brand-ink": readableOn(primary),
    "--accent": accent,
    "--accent-ink": readableOn(accent),
    "--page": b.backgroundColor,
    "--ink": b.textColor,
  } as CSSProperties;
}
