// The link-preview card: scenario-com-landing-page's BrandFrame rendered by
// satori and resvg, the Truchet pattern deterministic for a title, and the
// share tags early enough in a page for Slack's preview.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { render } from "../src/og/index.ts";
import { BrandFrame } from "../src/og/components/BrandFrame.tsx";
import { DUAL_PALETTE, generatePatternData } from "../src/og/lib/truchet/index.ts";
import { SHARE_TAG_BUDGET, shareTagsEnd } from "../src/og/lib/share-tags.ts";

const PICTURE = path.join(import.meta.dirname, "fixtures", "sample-plugin", "docs", "media", "hero.png");

function size(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test("a card renders to a 1200 x 630 PNG, with a picture or with the pattern", async () => {
  for (const card of [{ title: "Scenario for Sample", subtitle: "One line.", image: PICTURE }, { title: "Scenario for Sample", themeIndex: 15 }]) {
    const png = await render(card);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.deepEqual(size(png), [1200, 630]);
  }
});

test("the pattern is the same for the same title, and differs for another", () => {
  const ink = DUAL_PALETTE[28]?.text ?? "#000000";
  const a = generatePatternData("Scenario for Maya", ink, 42, 22, 0.7);
  assert.deepEqual(a, generatePatternData("Scenario for Maya", ink, 42, 22, 0.7));
  assert.notDeepEqual(a, generatePatternData("Scenario for Blender", ink, 42, 22, 0.7));
});

test("the frame keeps www's layout: the domain top right, a long title smaller", () => {
  assert.match(JSON.stringify(BrandFrame({ title: "x".repeat(61) })), /"fontSize":54/);
  const short = JSON.stringify(BrandFrame({ title: "Short" }));
  assert.match(short, /"fontSize":68/);
  assert.match(short, /"scenario\.com"/);
});

test("a picture that cannot be read is an error, not a card without it", async () => {
  await assert.rejects(render({ title: "x", image: "no-such-picture.png" }), /could not be read/);
});

test("the share tags end within Slack's budget", () => {
  const big = "x".repeat(SHARE_TAG_BUDGET);
  assert.ok(shareTagsEnd(`<html><head><meta charset="utf-8"><title>T</title><meta property="og:image" content="a"><style>${big}</style></head></html>`) < SHARE_TAG_BUDGET);
  assert.ok(shareTagsEnd(`<html><head><meta charset="utf-8"><style>${big}</style><title>T</title></head></html>`) > SHARE_TAG_BUDGET);
});

test("the command draws a card from a folder with no tsconfig, as a plug-in runs it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "components-og-"));
  const out = path.join(dir, "og.png");
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, "..", "bin", "components.mjs"), "og", "--title", "Scenario for Sample", "--out", out], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(size(fs.readFileSync(out)), [1200, 630]);
});
