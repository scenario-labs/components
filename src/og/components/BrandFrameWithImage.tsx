/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Copied from scenario-com-landing-page components/og/BrandFrameWithImage.tsx (1ca540be).
// Changes: imports lib/truchet by a relative path; JSX runtime pragmas, as the plug-ins that run it have no tsconfig. Em dashes in comments written as colons (house rule).
/**
 * OG image frame with a prominent image card on the right.
 * Reusable across any detail page (workflows, blog, etc.).
 * All styles must be inline: no Tailwind in og/ context.
 */

import {
  DEFAULT_PRESERVATION_PERCENT,
  DEFAULT_TILES,
  generatePatternData,
  TruchetSvg,
} from '../lib/truchet/index.ts';

const OG_W = 1200;
const OG_H = 630;

export interface BrandFrameWithImageProps {
  title: string;
  eyebrow: string;
  description?: string;
  imageUrl: string;
  logoUrl?: string;
  bg: string;
  text: string;
}

export function BrandFrameWithImage({
  title,
  eyebrow,
  description,
  imageUrl,
  logoUrl,
  bg,
  text,
}: Readonly<BrandFrameWithImageProps>): React.JSX.Element {
  const tilesY = DEFAULT_TILES;
  const tilesX = Math.round(DEFAULT_TILES * (OG_W / OG_H));
  const cells = generatePatternData(
    title,
    text,
    tilesX,
    tilesY,
    DEFAULT_PRESERVATION_PERCENT
  );

  const nameLen = title.length;
  const titleSize = nameLen > 30 ? 36 : nameLen > 20 ? 42 : 48;
  const muted = `${text}8C`; /* ~55% opacity via hex alpha */

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: bg,
        fontFamily: 'Instrument Sans, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Truchet background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          opacity: 0.12,
        }}
      >
        <TruchetSvg
          cells={cells}
          tilesX={tilesX}
          tilesY={tilesY}
          width={OG_W}
          height={OG_H}
        />
      </div>

      {/* Top bar: logo left, scenario.com right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '48px 56px 0 64px',
          position: 'relative',
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            style={{ height: 40, width: 166, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 28, fontWeight: 700, color: text }}>
            Scenario
          </span>
        )}
        <span
          style={{
            fontSize: 22,
            color: muted,
            fontFamily: 'Instrument Serif, serif',
          }}
        >
          scenario.com
        </span>
      </div>

      {/* Main area: text bottom-left, image center-right */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          position: 'relative',
        }}
      >
        {/* Bottom-left text block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '45%',
            padding: '0 40px 52px 64px',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.2em',
              color: text,
            }}
          >
            {eyebrow}
          </span>
          <h1
            style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: titleSize,
              fontWeight: 400,
              color: text,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{ fontSize: 16, color: muted, lineHeight: 1.5, margin: 0 }}
            >
              {description.length > 100
                ? `${description.slice(0, 97)}…`
                : description}
            </p>
          )}
        </div>

        {/* Right: smaller image showcase */}
        <div
          style={{
            display: 'flex',
            width: '55%',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 56px 40px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 460,
              height: 360,
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${text}1A`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <img
              src={imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
