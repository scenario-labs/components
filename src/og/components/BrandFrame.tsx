/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Copied from scenario-com-landing-page components/og/BrandFrame.tsx (1ca540be).
// Changes: imports lib/truchet by a relative path; JSX runtime pragmas, as the plug-ins that run it have no tsconfig. Em dashes in comments written as colons (house rule).
/**
 * Reusable OG image frame rendered via ImageResponse.
 * All styles must be inline: Tailwind is not available in og/ context.
 */

import {
  DEFAULT_PRESERVATION_PERCENT,
  DEFAULT_TILES,
  DUAL_PALETTE,
  generatePatternData,
  TruchetSvg,
} from '../lib/truchet/index.ts';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const DEFAULT_THEME = DUAL_PALETTE[28] as { bg: string; text: string };
const LAST_THEME_INDEX = DUAL_PALETTE.length - 1;

function getTheme(themeIndex?: number): { bg: string; text: string } {
  if (typeof themeIndex !== 'number' || Number.isNaN(themeIndex)) {
    return DEFAULT_THEME;
  }

  const clampedThemeIndex = Math.min(
    Math.max(Math.trunc(themeIndex), 0),
    LAST_THEME_INDEX
  );

  return (DUAL_PALETTE[clampedThemeIndex] ?? DEFAULT_THEME) as {
    bg: string;
    text: string;
  };
}

/** Exported so callers can colorize logos to match the default theme. */
export const BRAND_FRAME_DEFAULTS = DEFAULT_THEME;

export interface BrandFrameProps {
  title: string;
  subtitle?: string;
  /** Pre-resolved absolute image URL or undefined */
  imageUrl?: string;
  /** Pre-colorized Scenario logo data URL (white recommended). */
  logoUrl?: string;
  bgColor?: string;
  textColor?: string;
  /** Theme index (0-30) for DUAL_PALETTE. Default is 28. */
  themeIndex?: number;
  /** Domain label shown top-right. Defaults to "scenario.com". */
  domain?: string;
}

export function BrandFrame({
  title,
  subtitle,
  imageUrl,
  logoUrl,
  bgColor: bgColorProp,
  textColor: textColorProp,
  themeIndex,
  domain = 'scenario.com',
}: Readonly<BrandFrameProps>): React.JSX.Element {
  const theme = getTheme(themeIndex);
  const bgColor = bgColorProp ?? theme.bg;
  const textColor = textColorProp ?? theme.text;

  const tilesY = DEFAULT_TILES;
  const tilesX = Math.round(DEFAULT_TILES * (OG_WIDTH / OG_HEIGHT));
  const cells = generatePatternData(
    title,
    textColor,
    tilesX,
    tilesY,
    DEFAULT_PRESERVATION_PERCENT
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: bgColor,
        fontFamily: 'Instrument Sans, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Truchet pattern: hidden when image is present */}
      {!imageUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.3,
          }}
        >
          <TruchetSvg
            cells={cells}
            tilesX={tilesX}
            tilesY={tilesY}
            width={OG_WIDTH}
            height={OG_HEIGHT}
          />
        </div>
      )}

      {/* Background cover image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Vignette overlay: only when image is present */}
      {imageUrl && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 10%, rgba(0,0,0,0.4) 70%)',
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          padding: '60px 72px',
          position: 'relative',
        }}
      >
        {/* Top bar: logo left, scenario.com right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ height: 40, objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 26, fontWeight: 700, color: textColor }}>
              Scenario
            </span>
          )}
          <span
            style={{
              fontSize: 26,
              color: textColor,
              fontFamily: 'Instrument Serif, sans-serif',
            }}
          >
            {domain}
          </span>
        </div>

        {/* Bottom: title + subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1
            style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: title.length > 60 ? 54 : 68,
              fontWeight: 400,
              color: textColor,
              lineHeight: 1.15,
              margin: 0,
              maxWidth: 900,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <span
              style={{
                fontSize: 34,
                color: textColor,
                fontFamily: 'Instrument Serif, sans-serif',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
