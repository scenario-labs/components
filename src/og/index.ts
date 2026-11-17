// Link-preview cards (Open Graph, X) for Scenario's plug-in sites, drawn by
// scenario-com-landing-page's BrandFrame (components/BrandFrame.tsx) and
// rendered as its opengraph-image routes render it through next/og: satori to
// SVG, resvg to a 1200 x 630 PNG, with the same fonts (lib/og/fonts.ts), logo
// (lib/og/colorize-image.ts) and picture handling (lib/og/resolve-image.ts).
//
//   components og --title "Scenario for Maya" [--subtitle <line>] [--image <file or https address>]
//                 [--text-color <#hex>] [--theme <0-30>] [--domain <text>] --out og.png
//
// With a picture, the card is the /campaign/blender card: the picture fills
// the frame, the text and logo in the frame's beige. Without one, the Truchet
// pattern on the chosen theme.

import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { BRAND_FRAME_DEFAULTS, BrandFrame } from './components/BrandFrame.tsx';
import { DUAL_PALETTE } from './lib/truchet/index.ts';
import { getScenarioLogo } from './lib/og/colorize-image.ts';
import { getOgFonts } from './lib/og/fonts.ts';
import { resolveOgImageUrl } from './lib/og/resolve-image.ts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface CardOptions {
  title: string;
  subtitle?: string;
  /** A local file, a file:// or an https address: resized and made PNG, so WebP works too. */
  image?: string;
  textColor?: string;
  /** 0 to 30, in DUAL_PALETTE; 28 by default, as BrandFrame's. */
  themeIndex?: number;
  domain?: string;
}

/** The foreground of the theme BrandFrame picks for this index. */
function themeText(themeIndex: number | undefined): string {
  const theme = typeof themeIndex === 'number' && !Number.isNaN(themeIndex) ? DUAL_PALETTE[Math.min(Math.max(Math.trunc(themeIndex), 0), DUAL_PALETTE.length - 1)] : undefined;
  return theme?.text ?? BRAND_FRAME_DEFAULTS.text;
}

/** Renders a card to a PNG buffer. */
export async function render({ title, subtitle, image, textColor, themeIndex, domain }: CardOptions): Promise<Buffer> {
  const imageUrl = image ? await resolveOgImageUrl(image) : undefined;
  if (image && !imageUrl) throw new Error(`${image}: the picture could not be read`);
  // Over a picture the text and logo take the frame's beige, as the
  // /campaign/blender card does; on the pattern, the chosen theme's colour.
  // The logo and the text always share one colour.
  const text = textColor ?? (imageUrl ? BRAND_FRAME_DEFAULTS.bg : themeText(themeIndex));
  const [logoUrl, fonts] = await Promise.all([getScenarioLogo(text), getOgFonts()]);
  const svg = await satori(BrandFrame({ title, subtitle, imageUrl, logoUrl, textColor: text, themeIndex, domain }), { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng());
}

const OPTIONS: Record<string, keyof CardOptions | 'out'> = {
  '--title': 'title',
  '--subtitle': 'subtitle',
  '--image': 'image',
  '--text-color': 'textColor',
  '--theme': 'themeIndex',
  '--domain': 'domain',
  '--out': 'out',
};

function parseArgs(argv: string[]): CardOptions & { out: string } {
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = OPTIONS[argv[i] ?? ''];
    if (!key) throw new Error(`unknown option ${argv[i]}`);
    raw[key] = argv[++i] ?? '';
  }
  if (!raw.title || !raw.out) throw new Error('--title and --out are required');
  return {
    title: raw.title,
    subtitle: raw.subtitle,
    image: raw.image,
    textColor: raw.textColor,
    themeIndex: raw.themeIndex === undefined ? undefined : Number(raw.themeIndex),
    domain: raw.domain,
    out: raw.out,
  };
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { out, ...card } = parseArgs(argv);
    fs.writeFileSync(out, await render(card));
    return 0;
  } catch (error) {
    process.stderr.write(`components og: ${(error as Error).message}\n`);
    return 1;
  }
}
