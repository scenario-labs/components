"use strict";
// Link-preview cards (Open Graph, X) for Scenario's plug-in sites, drawn by
// BrandFrame (brand-frame.js, www.scenario.com's frame) and rendered as
// next/og renders it: satori to SVG, resvg to a 1200 x 630 PNG.
//
//   plugin-site og --title "Scenario for Maya" [--subtitle <line>] [--image <png or jpeg>]
//                  [--text-color <#hex>] [--theme <0-30>] [--domain <text>] --out og.png
//
// With a picture, the card follows the /campaign/blender card: the picture
// fills the frame, the text and logo in the frame's beige. Without one, the
// Truchet pattern on the default theme.

const fs = require("node:fs");
const path = require("node:path");
const { BrandFrame, BRAND_FRAME_DEFAULTS, getTheme, OG_WIDTH, OG_HEIGHT } = require("./brand-frame.js");

const FONT_DIR = path.join(__dirname, "fonts");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

// lib/og/fonts.ts: the bundled TTF files, Instrument Sans 400 and 700,
// Instrument Serif 400 (OFL, licences beside them).
function fonts() {
  const read = (file) => fs.readFileSync(path.join(FONT_DIR, file));
  return [
    { name: "Instrument Sans", data: read("instrument-sans-regular.ttf"), weight: 400, style: "normal" },
    { name: "Instrument Sans", data: read("instrument-sans-bold.ttf"), weight: 700, style: "normal" },
    { name: "Instrument Serif", data: read("instrument-serif-regular.ttf"), weight: 400, style: "normal" }
  ];
}

// The Scenario logo in one colour, as getScenarioLogo makes it in
// lib/og/colorize-image.ts; the logo is an SVG in one colour, so it is
// recoloured in its source instead of pixel by pixel.
function logo(hex) {
  const svg = fs
    .readFileSync(path.join(__dirname, "..", "handbook", "scenario-logo.svg"), "utf8")
    .replace(/<!--[\s\S]*?-->\s*/, "")
    .replace("<svg ", '<svg width="1024" height="252" ')
    .replace(/currentColor/g, hex);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// A picture for the frame: satori reads PNG and JPEG, not WebP.
function picture(file) {
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`${file}: the card's picture must be PNG or JPEG`);
  return `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
}

/** Renders a card to a PNG buffer. */
async function render({ title, subtitle, image, textColor, themeIndex, domain }) {
  const satori = require("satori").default;
  const { Resvg } = require("@resvg/resvg-js");
  // Over a picture the text and logo take the frame's beige, as the
  // /campaign/blender card does; on the pattern, the chosen theme's colour.
  // The logo and the text always share one colour.
  const text = textColor || (image ? BRAND_FRAME_DEFAULTS.bg : getTheme(themeIndex).text);
  const element = BrandFrame({ title, subtitle, imageUrl: image ? picture(image) : undefined, logoUrl: logo(text), textColor: text, themeIndex, domain });
  const svg = await satori(element, { width: OG_WIDTH, height: OG_HEIGHT, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();
}

function parseArgs(argv) {
  const opts = {};
  const keys = { "--title": "title", "--subtitle": "subtitle", "--image": "image", "--text-color": "textColor", "--theme": "themeIndex", "--domain": "domain", "--out": "out" };
  for (let i = 0; i < argv.length; i++) {
    if (!keys[argv[i]]) throw new Error(`unknown option ${argv[i]}`);
    opts[keys[argv[i]]] = argv[++i];
  }
  if (opts.themeIndex !== undefined) opts.themeIndex = Number(opts.themeIndex);
  if (!opts.title || !opts.out) throw new Error("--title and --out are required");
  return opts;
}

async function main(argv) {
  try {
    const opts = parseArgs(argv);
    fs.writeFileSync(opts.out, await render(opts));
    return 0;
  } catch (error) {
    process.stderr.write(`plugin-site og: ${error.message}\n`);
    return 1;
  }
}

module.exports = { render, main, OG_WIDTH, OG_HEIGHT };
