// Copied from scenario-com-landing-page lib/og/resolve-image.ts (1ca540be).
// Changes: explicit .ts import paths. Em dashes in comments written as colons (house rule).
import sharp from 'sharp';

import { fetchImageBuffer } from './fetch-buffer.ts';

/** Max dimensions for OG images: matches the standard 1200×630 size. */
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 630;

/**
 * Resolves an image URL for use with ImageResponse (Satori).
 *
 * Satori does not support WebP and its internal SVG renderer (libvips)
 * crashes on data URLs larger than ~10 MB. This function fetches the
 * image, resizes it to fit OG dimensions (1200×630), and converts to
 * a PNG data URL.
 *
 * Returns undefined if the URL is undefined or the fetch/conversion fails.
 */
export async function resolveOgImageUrl(
  url: string | undefined
): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const buffer = await fetchImageBuffer(url);
    if (!buffer) return undefined;

    const png = await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'cover' })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return undefined;
  }
}
