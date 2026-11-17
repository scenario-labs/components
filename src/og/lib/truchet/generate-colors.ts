// Copied from scenario-com-landing-page lib/truchet/generate-colors.ts (1ca540be).
// Changes: explicit .ts import paths.
import { getHashCode, hexToRgb, mix, rgbToHex } from './utils.ts';

/** Hand-picked bg + stroke combos from fawkes ALTERNATE_THEME_DUAL_PALETTE. */
export const DUAL_PALETTE: { bg: string; text?: string }[] = [
  { bg: '#00112f', text: '#00a15c' },
  { bg: '#00112f', text: '#9c183e' },
  { bg: '#00112f', text: '#ffa800' },
  { bg: '#00a15c', text: '#00112f' },
  { bg: '#00a15c', text: '#2b2b18' },
  { bg: '#1e1428', text: '#acd2c0' },
  { bg: '#1e1428', text: '#cc5416' },
  { bg: '#1e1428', text: '#f4c991' },
  { bg: '#1e1428', text: '#f8f6f5' },
  { bg: '#2b2b18', text: '#00a15c' },
  { bg: '#2b2b18', text: '#9c183e' },
  { bg: '#2b2b18', text: '#acd2c0' },
  { bg: '#2b2b18', text: '#bcd6f1' },
  { bg: '#2b2b18', text: '#c3c1ea' },
  { bg: '#2b2b18', text: '#eec1d9' },
  { bg: '#3c1403', text: '#bcd6f1' },
  { bg: '#3c1403', text: '#acd2c0' },
  { bg: '#9c183e', text: '#00112f' },
  { bg: '#9c183e', text: '#2b2b18' },
  { bg: '#acd2c0', text: '#1e1428' },
  { bg: '#acd2c0', text: '#2b2b18' },
  { bg: '#bcd6f1', text: '#2b2b18' },
  { bg: '#bcd6f1', text: '#3c1403' },
  { bg: '#c3c1ea', text: '#2b2b18' },
  { bg: '#c3c1ea', text: '#3c1403' },
  { bg: '#eec1d9', text: '#2b2b18' },
  { bg: '#eec1d9', text: '#00112f' },
  { bg: '#f4c991', text: '#1e1428' },
  { bg: '#f4c991', text: '#3c1403' },
  { bg: '#f8f6f5', text: '#1e1428' },
  { bg: '#f8f6f5', text: '#9c183e' },
];

const UNIQUE_BACKGROUNDS = Array.from(new Set(DUAL_PALETTE.map(c => c.bg)));

function invertColor(hex: string): string {
  const stripped = hex.replace('#', '');
  const r = 255 - Number.parseInt(stripped.slice(0, 2), 16);
  const g = 255 - Number.parseInt(stripped.slice(2, 4), 16);
  const b = 255 - Number.parseInt(stripped.slice(4, 6), 16);
  return rgbToHex([r, g, b]);
}

/** Select bg + text color deterministically from name and provider. */
export function getPlaceholderColors(
  name: string,
  provider?: string
): { bg: string; text: string } {
  const bgKey = provider ?? name;
  const bgHash = getHashCode(bgKey);
  const bgIndex = Math.abs(bgHash) % UNIQUE_BACKGROUNDS.length;
  const selectedBg = UNIQUE_BACKGROUNDS[bgIndex];

  const candidates = DUAL_PALETTE.filter(c => c.bg === selectedBg);
  const textHash = getHashCode(name);
  const colorIndex = Math.abs(textHash) % candidates.length;
  const selected = candidates[colorIndex];

  return {
    bg: selected.bg,
    text: selected.text ?? invertColor(selected.bg),
  };
}

/** Generate stroke colors that contrast with baseColor (luminance-aware). */
export function generateStrokeColors(baseColor: string): {
  c1: string;
  c2: string;
} {
  const rgb = hexToRgb(baseColor);
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const isDarkBg = lum < 150;

  const white = [255, 255, 255];
  const black = [0, 0, 0];

  if (isDarkBg) {
    return {
      c1: rgbToHex(mix(rgb, white, 0.15)),
      c2: rgbToHex(mix(rgb, white, 0.35)),
    };
  }
  return {
    c1: rgbToHex(mix(rgb, black, 0.1)),
    c2: rgbToHex(mix(rgb, black, 0.3)),
  };
}
