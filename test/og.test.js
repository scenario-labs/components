"use strict";
// The link-preview card: BrandFrame rendered by satori and resvg, and the
// Truchet pattern deterministic for a title, as on www.scenario.com.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { render } = require("../src/og/index.js");
const { BrandFrame } = require("../src/og/brand-frame.js");
const { generatePatternData, DUAL_PALETTE } = require("../src/og/truchet.js");

const PICTURE = path.join(__dirname, "fixtures", "sample-plugin", "docs", "media", "hero.png");

test("a card renders to a 1200 x 630 PNG, with a picture or with the pattern", async () => {
  for (const opts of [{ title: "Scenario for Sample", subtitle: "One line.", image: PICTURE }, { title: "Scenario for Sample" }]) {
    const png = await render(opts);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
  }
});

test("the pattern is the same for the same title, and differs for another", () => {
  const a = generatePatternData("Scenario for Maya", DUAL_PALETTE[28].text, 42, 22, 0.7);
  assert.deepEqual(a, generatePatternData("Scenario for Maya", DUAL_PALETTE[28].text, 42, 22, 0.7));
  assert.notDeepEqual(a, generatePatternData("Scenario for Blender", DUAL_PALETTE[28].text, 42, 22, 0.7));
});

test("the frame keeps www's layout: the domain top right, a long title smaller", () => {
  const text = JSON.stringify(BrandFrame({ title: "x".repeat(61) }));
  assert.match(text, /"scenario\.com"/);
  assert.match(text, /"fontSize":54/);
  assert.match(JSON.stringify(BrandFrame({ title: "Short" })), /"fontSize":68/);
});

test("a WebP picture is refused, as satori cannot read it", async () => {
  await assert.rejects(render({ title: "x", image: "picture.webp" }), /PNG or JPEG/);
});

test("the logo takes the text's colour, also with a chosen theme", async () => {
  const { BRAND_FRAME_DEFAULTS, getTheme } = require("../src/og/brand-frame.js");
  const seen = [];
  const original = Buffer.from;
  Buffer.from = function (value, ...rest) {
    if (typeof value === "string" && value.startsWith("<svg")) seen.push(/fill="([^"]+)"/.exec(value)[1]);
    return original.call(this, value, ...rest);
  };
  try {
    await render({ title: "x", themeIndex: 15 });
    await render({ title: "x", image: PICTURE });
  } finally {
    Buffer.from = original;
  }
  assert.deepEqual(seen, [getTheme(15).text, BRAND_FRAME_DEFAULTS.bg]);
});
