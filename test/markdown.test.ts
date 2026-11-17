// The Markdown reader: the subset plug-in docs use, and the layout HTML READMEs add.

import test from "node:test";
import assert from "node:assert/strict";
import * as md from "../src/handbook/markdown.ts";
import type { Block } from "../src/handbook/markdown.ts";

/** The block, which the test expects to be of this type. */
function as<T extends Block["type"]>(b: Block | undefined, type: T): Extract<Block, { type: T }> {
  assert.equal(b?.type, type);
  return b as Extract<Block, { type: T }>;
}

test("the reader handles the subset the docs use", () => {
  const t = md.parse("# T\n\n1. **One**\n\n   <img src=\"a.png\" alt=\"A\">\n\n2. Two\n   lazy\n\n| A | B |\n|---|---|\n| `x\\|y` | z |\n\n> **Note.** text\n>\n> ```sh\n> run\n> ```\n");
  assert.equal(t[0].type, "heading");
  const list = as(t[1], "list");
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0]?.length, 2);
  assert.equal(as(list.items[1]?.[0], "para").text, "Two\nlazy");
  assert.deepEqual(as(t[2], "table").rows[0], ["`x|y`", "z"]);
  assert.equal(as(t[3], "quote").children[1]?.type, "code");
  assert.equal(md.slug("Selection edits: Inside selection or Bolder"), "selection-edits-inside-selection-or-bolder");
});

test("layout HTML reads as its Markdown meaning", () => {
  const t = md.parse('<p align="center"><img src="a.gif" width="560" alt="A"></p>\n<p align="center"><sub>One light. <a href="docs/x.mp4">MP4</a></sub></p>\n\n<h1 align="center">Title</h1>\n\n<br clear="right">\n');
  assert.equal(t.length, 2, "the <br> paragraph is dropped");
  assert.equal(as(t[0], "para").text, '<img src="a.gif" width="560" alt="A">\n*One light. [MP4](docs/x.mp4)*');
  assert.deepEqual(t[1], { type: "heading", level: 1, text: "Title" });
});
