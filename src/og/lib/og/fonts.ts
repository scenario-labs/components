// Copied from scenario-com-landing-page lib/og/fonts.ts (1ca540be).
// Changes: reads the fonts from src/og/fonts, beside this module, not from the working directory. Em dashes in comments written as colons (house rule).
/**
 * Shared font loader for OG images (Satori / ImageResponse).
 *
 * Reads Instrument Sans (400 + 700), Instrument Serif (400), and
 * Oswald (700) from bundled TTF files. Using local files instead of
 * fetching from Google Fonts avoids ETIMEDOUT errors during Vercel
 * builds that would otherwise break prerendering.
 *
 * Uses literal path segments so the Next.js file tracer includes only
 * these files: NOT the entire directory tree.
 */
import fs from 'node:fs';
import path from 'node:path';

type FontWeight = 400 | 700;
type FontData = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
};

let cached: FontData[] | null = null;

function readFont(filename: string): ArrayBuffer {
  const buf = fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', 'fonts', filename)
  );
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function getOgFonts(): Promise<FontData[]> {
  if (cached) return cached;

  const fonts: FontData[] = [
    {
      name: 'Instrument Sans',
      data: readFont('instrument-sans-regular.ttf'),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Instrument Sans',
      data: readFont('instrument-sans-bold.ttf'),
      weight: 700,
      style: 'normal',
    },
    {
      name: 'Instrument Serif',
      data: readFont('instrument-serif-regular.ttf'),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Oswald',
      data: readFont('oswald-bold.ttf'),
      weight: 700,
      style: 'normal',
    },
  ];

  cached = fonts;
  return fonts;
}
