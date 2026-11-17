// Copied from scenario-com-landing-page lib/og/colorize-image.ts (1ca540be).
// Changes: reads the logo from src/handbook/scenario-logo.svg; explicit .ts import paths. Em dashes in comments written as colons (house rule).
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { fetchImageBuffer } from './fetch-buffer.ts';

const logoCache = new Map<string, string | undefined>();

/**
 * Read the Scenario logo SVG from the public directory.
 *
 * Uses literal path segments so the Next.js file tracer includes only this
 * single file: NOT the entire `public/` tree (which would blow the 250 MB
 * serverless function limit).
 */
function readLogoSvg(): Buffer {
  return fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', '..', 'handbook', 'scenario-logo.svg')
  );
}

/**
 * Returns the Scenario logo colorized to `hexColor` as a PNG data URL.
 * Cached in-memory per color for the process lifetime.
 */
export async function getScenarioLogo(
  hexColor: string
): Promise<string | undefined> {
  const cached = logoCache.get(hexColor);
  if (cached !== undefined) return cached;
  const result = await colorizeBuffer(readLogoSvg(), hexColor);
  logoCache.set(hexColor, result);
  return result;
}

/**
 * Recolors an image to a solid color while preserving its alpha channel.
 * Equivalent to a CSS `mask-image` effect: every opaque pixel becomes `hexColor`.
 *
 * Returns a PNG data URL, or undefined on failure.
 */
export async function colorizeImage(
  url: string,
  hexColor: string
): Promise<string | undefined> {
  const buffer = await fetchImageBuffer(url);
  if (!buffer) return undefined;
  return colorizeBuffer(buffer, hexColor);
}

/**
 * Recolors an image buffer to a solid color while preserving its alpha channel.
 * Equivalent to a CSS `mask-image` effect: every opaque pixel becomes `hexColor`.
 *
 * Returns a PNG data URL, or undefined on failure.
 */
async function colorizeBuffer(
  buffer: Buffer,
  hexColor: string
): Promise<string | undefined> {
  try {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    const img = sharp(buffer).ensureAlpha();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return undefined;

    const raw = await img.raw().toBuffer();
    const out = Buffer.allocUnsafe(raw.length);

    for (let i = 0; i < raw.length; i += 4) {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = raw[i + 3]; // preserve alpha
    }

    const png = await sharp(out, {
      raw: { width: meta.width, height: meta.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return undefined;
  }
}
