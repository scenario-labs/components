"use strict";
// Scenario's link-preview frame, ported from scenario-com-landing-page's
// components/og/BrandFrame.tsx to plain JavaScript: the same layout, sizes
// and palette as www.scenario.com's cards. The logo top left, the domain top
// right, the title and subtitle bottom left; a picture fills the frame under a
// vignette, else the Truchet pattern seeded by the title. All styles inline,
// as satori needs.

const { h } = require("./h.js");
const { DEFAULT_PRESERVATION_PERCENT, DEFAULT_TILES, DUAL_PALETTE, generatePatternData, TruchetSvg } = require("./truchet.js");

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const DEFAULT_THEME = DUAL_PALETTE[28];
const LAST_THEME_INDEX = DUAL_PALETTE.length - 1;

function getTheme(themeIndex) {
  if (typeof themeIndex !== "number" || Number.isNaN(themeIndex)) return DEFAULT_THEME;
  const clamped = Math.min(Math.max(Math.trunc(themeIndex), 0), LAST_THEME_INDEX);
  return DUAL_PALETTE[clamped] || DEFAULT_THEME;
}

/** The default theme, so callers can colour the logo to match it. */
const BRAND_FRAME_DEFAULTS = DEFAULT_THEME;

/**
 * @param {object} p
 * @param {string} p.title
 * @param {string} [p.subtitle]
 * @param {string} [p.imageUrl] a data: URI or absolute address
 * @param {string} [p.logoUrl] the Scenario logo, already coloured
 * @param {string} [p.bgColor]
 * @param {string} [p.textColor]
 * @param {number} [p.themeIndex] 0 to 30, in DUAL_PALETTE; 28 by default
 * @param {string} [p.domain] shown top right; scenario.com by default
 */
function BrandFrame({ title, subtitle, imageUrl, logoUrl, bgColor, textColor, themeIndex, domain = "scenario.com" }) {
  const theme = getTheme(themeIndex);
  const bg = bgColor || theme.bg;
  const text = textColor || theme.text;
  const tilesY = DEFAULT_TILES;
  const tilesX = Math.round(DEFAULT_TILES * (OG_WIDTH / OG_HEIGHT));
  const cells = generatePatternData(title, text, tilesX, tilesY, DEFAULT_PRESERVATION_PERCENT);

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: bg, fontFamily: "Instrument Sans, sans-serif", position: "relative", overflow: "hidden" } },
    // Truchet pattern, hidden when there is a picture
    !imageUrl && h("div", { style: { position: "absolute", inset: 0, display: "flex", opacity: 0.3 } }, TruchetSvg({ cells, tilesX, tilesY, width: OG_WIDTH, height: OG_HEIGHT })),
    // Background cover picture
    imageUrl && h("img", { src: imageUrl, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }),
    // Vignette, only over a picture
    imageUrl &&
      h("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", background: "radial-gradient(ellipse at center, rgba(0,0,0,0.0) 10%, rgba(0,0,0,0.4) 70%)" } }),
    // Content
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: "60px 72px", position: "relative" } },
      // Top bar: logo left, domain right
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        logoUrl ? h("img", { src: logoUrl, alt: "", style: { height: 40, objectFit: "contain" } }) : h("span", { style: { fontSize: 26, fontWeight: 700, color: text } }, "Scenario"),
        h("span", { style: { fontSize: 26, color: text, fontFamily: "Instrument Serif, sans-serif" } }, domain)
      ),
      // Bottom: title and subtitle
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 16 } },
        h("h1", { style: { fontFamily: "Instrument Serif, serif", fontSize: title.length > 60 ? 54 : 68, fontWeight: 400, color: text, lineHeight: 1.15, margin: 0, maxWidth: 900 } }, title),
        subtitle && h("span", { style: { fontSize: 34, color: text, fontFamily: "Instrument Serif, sans-serif" } }, subtitle)
      )
    )
  );
}

module.exports = { BrandFrame, BRAND_FRAME_DEFAULTS, OG_WIDTH, OG_HEIGHT };
