"use strict";
// Builds a Scenario plug-in's handbook from the plug-in repository's Markdown
// docs, so the handbook never says something the docs do not. Ported from
// photoshop-plugin's tools/handbook; what differs between plug-ins (the
// chapters, the product name, the version file, the downloads text) is read
// from the plug-in's handbook.config.json (README.md, "Configuration").
//
//   plugin-site handbook [--config handbook.config.json] [--out <dir>] [--no-pdf] [--quiet]
//
// Outputs: <out>/index.html with its media under <out>/media/, a single-file
// <out>/<files>-handbook-<version>.html (pictures embedded; its fonts load
// from Google Fonts), and <out>/<files>-handbook-<version>.pdf printed by
// headless Google Chrome (CHROME_PATH, or the default install location). The
// PDF contents carry page numbers when Poppler's pdftotext is on the PATH.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const md = require("./markdown.js");
const { CSS } = require("./style.js");
const ui = require("../components-lib/components.js");
const EM_DASH = new RegExp(String.fromCharCode(0x2014));

const { loadConfig } = require("./config.js");
const APP_URL = "https://app.scenario.com/";

// Set by build(): the plug-in repository and its configuration.
let ROOT = "";
let CONFIG = null;
let REPO_URL = "";
let GITHUB_REF = "main";
let BLOB = "";
let TREE = "";
let CHAPTERS = [];
let FILE_NAMES = {};
let MEDIA = "docs/media/";

// ---------------------------------------------------------------- options

function parseArgs(argv) {
  const opts = { config: "handbook.config.json", out: "", pdf: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-pdf") opts.pdf = false;
    if (argv[i] === "--no-og") opts.og = false;
    else if (argv[i] === "--quiet") opts.quiet = true;
    else if (argv[i] === "--out") opts.out = path.resolve(argv[++i]);
    else if (argv[i] === "--config") opts.config = argv[++i];
    else throw new Error(`unknown option ${argv[i]}`);
  }
  return opts;
}

// The chapters, and the names of linked doc files, come from the plug-in's
// handbook.config.json: see config.js.

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const posix = (p) => p.split(path.sep).join("/");

function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.slice(1, 4).toString() === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.slice(0, 3).toString() === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

// The commit the handbook names: HANDBOOK_COMMIT when Publish site builds a
// release's docs on main's checkout, else the checkout's own.
function gitInfo() {
  if (process.env.HANDBOOK_COMMIT) return process.env.HANDBOOK_COMMIT;
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

// Whether a repository file exists where the handbook's links point. Publish
// site builds a release's docs on main's checkout, so it names the release's
// commit in HANDBOOK_TREE and the files are looked up there: a file on main
// may not be in the release. Otherwise the checkout is that tree: main, or
// the release commit in the release workflow, whose HANDBOOK_GITHUB_REF tag
// does not exist yet while the release is a draft.
function inRepo(target) {
  if (!TREE) return fs.existsSync(path.join(ROOT, target));
  return spawnSync("git", ["cat-file", "-e", `${TREE}:${target}`], { cwd: ROOT }).status === 0;
}

function formatDate(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------- docs

function splitSections(blocks) {
  const intro = [];
  const sections = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === "heading" && b.level === 1) continue;
    if (b.type === "heading" && b.level === 2) {
      cur = { title: b.text, slug: md.slug(b.text), blocks: [] };
      sections.push(cur);
      continue;
    }
    (cur ? cur.blocks : intro).push(b);
  }
  return { intro, sections };
}

function loadDocs() {
  const docs = {};
  const files = [CONFIG.intro.file, CONFIG.intro.guide, ...CHAPTERS.flatMap((c) => (c.parts || []).map((p) => p.file))].filter(Boolean);
  for (const file of new Set(files)) {
    const blocks = md.parse(read(file));
    docs[file] = { file, blocks, ...splitSections(blocks) };
  }
  return docs;
}

function headingClone(b, level, file) {
  return { type: "heading", level, text: b.text, file, origSlug: md.slug(b.text) };
}

// Turns the chapter config into a list of chapters with their blocks, each
// block tagged with the doc it came from, and every heading given an id.
function assemble(docs) {
  const ids = new Set();
  const anchors = {}; // file -> original slug -> id
  const fileHome = {}; // file -> chapter id where it starts
  const reserved = new Set(CHAPTERS.map((c) => c.id));
  const take = (id, prefix) => {
    let v = id;
    if (prefix && (ids.has(v) || reserved.has(v))) v = `${prefix}-${id}`;
    for (let n = 2; ids.has(v); n++) v = `${id}-${n}`;
    ids.add(v);
    return v;
  };
  const mapAnchor = (file, s, id) => {
    anchors[file] = anchors[file] || {};
    if (!(s in anchors[file])) anchors[file][s] = id;
  };
  const chapters = [];
  for (const c of CHAPTERS) {
    const ch = { ...c, id: c.id, blocks: [] };
    ids.add(c.id);
    for (const part of c.parts || []) {
      const doc = docs[part.file];
      const tag = (b) => ({ ...b, file: part.file });
      if (!(part.file in fileHome)) fileHome[part.file] = ch.id;
      if (part.section) {
        const sec = doc.sections.find((s) => s.title === part.section);
        if (!sec) throw new Error(`${part.file}: no section "${part.section}"`);
        mapAnchor(part.file, sec.slug, ch.id);
        ch.blocks.push(...sec.blocks.map(tag));
      } else if (part.only) {
        const sec = doc.sections.find((s) => s.title === part.only);
        if (!sec) throw new Error(`${part.file}: no section "${part.only}"`);
        ch.blocks.push(headingClone({ text: sec.title }, 3, part.file), ...sec.blocks.map(tag));
      } else {
        ch.blocks.push(...doc.intro.map(tag));
        for (const sec of doc.sections) {
          if ((part.skip || []).includes(sec.title)) continue;
          ch.blocks.push(headingClone({ text: sec.title }, 3, part.file), ...sec.blocks.map(tag));
        }
      }
    }
    for (const [file, s] of c.alias || []) mapAnchor(file, s, ch.id);
    // Headings inside the chapter: h3 and deeper keep their level, at least h3.
    for (const b of ch.blocks) {
      if (b.type !== "heading") continue;
      if (b.level < 3) b.level = 3;
      b.origSlug = b.origSlug || md.slug(b.text);
      b.id = take(b.origSlug, ch.id);
      mapAnchor(b.file, b.origSlug, b.id);
    }
    chapters.push(ch);
  }
  return { chapters, anchors, fileHome, ids };
}

// ---------------------------------------------------------------- rendering

class Renderer {
  constructor(ctx) {
    this.ctx = ctx; // { anchors, fileHome, assets, problems, mode }
  }

  // A link or image target in doc `file`, resolved for the handbook.
  resolve(file, href, kind) {
    if (/^(https?:|mailto:)/.test(href)) return href;
    const [p, frag] = href.split("#");
    if (!p) return this.anchor(file, frag, href);
    const target = posix(path.normalize(path.join(path.dirname(file), p)));
    if (target.startsWith(MEDIA)) return this.asset(target, kind);
    if (this.ctx.anchors[target] || this.ctx.fileHome[target]) {
      if (frag) return this.anchor(target, frag, href, file);
      if (this.ctx.fileHome[target]) return `#${this.ctx.fileHome[target]}`;
    }
    if (!inRepo(target)) this.ctx.problems.push(`${file}: link to a missing file ${href}${TREE ? ` in ${TREE}` : ""}`);
    return BLOB + target + (frag ? `#${frag}` : "");
  }

  anchor(file, frag, href, from) {
    // A chapter id is a target from any doc ("[Install](#install)").
    const id = (this.ctx.anchors[file] && this.ctx.anchors[file][frag]) || (CHAPTERS.some((c) => c.id === frag) ? frag : null);
    if (!id) {
      this.ctx.problems.push(`${from || file}: link ${href} has no target in the handbook`);
      return `#${frag}`;
    }
    return `#${id}`;
  }

  asset(target, kind) {
    const abs = path.join(ROOT, target);
    if (!fs.existsSync(abs)) {
      this.ctx.problems.push(`missing media ${target}`);
      return target;
    }
    const rel = `media/${target.slice(MEDIA.length)}`;
    this.ctx.assets.set(rel, abs);
    if (this.ctx.mode === "web") return rel;
    if (kind === "img") return `data:${MIME[path.extname(abs).toLowerCase()]};base64,${fs.readFileSync(abs).toString("base64")}`;
    return BLOB + target;
  }

  imgTag(file, src, alt, width) {
    const abs = path.join(ROOT, posix(path.normalize(path.join(path.dirname(file), src))));
    const size = fs.existsSync(abs) ? imageSize(abs) : null;
    return { src: this.resolve(file, src, "img"), alt, width, size, repoPath: posix(path.relative(ROOT, abs)) };
  }

  // Inline Markdown to HTML. Code spans and images are set aside first so
  // their text is never read as emphasis or links.
  inline(text, file) {
    const keep = [];
    const hold = (html) => `\u0000${keep.push(html) - 1}\u0000`;
    let s = String(text).replace(/\n/g, " ");
    s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
    s = s.replace(/<img\b[^>]*>/gi, (tag) => {
      const a = attrs(tag);
      const im = this.imgTag(file, a.src || "", a.alt || "", a.width);
      return hold(`<img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy">`);
    });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
      const im = this.imgTag(file, src, unesc(alt));
      return hold(`<img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy">`);
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const raw = unesc(href);
      const url = this.resolve(file, raw, "link");
      let shown = label;
      const bare = restore(label, keep).replace(/<\/?code>/g, "");
      const target = /^https?:/.test(raw) ? null : posix(path.normalize(path.join(path.dirname(file), raw.split("#")[0] || path.basename(file))));
      if (target && FILE_NAMES[target] && (bare === raw || bare === path.basename(target) || bare === target || bare === raw.split("#")[0])) shown = esc(FILE_NAMES[target]);
      const ext = /^https?:/.test(url) ? ' rel="noopener"' : "";
      return hold(`<a href="${esc(url)}"${ext}>${shown}</a>`);
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?![\w*])/g, (_, pre, t) => {
      const claim = claimClass(restore(t, keep));
      return `${pre}<em${claim ? ` class="claim ${claim}"` : ""}>${t}</em>`;
    });
    return restore(s, keep);
  }

  // A paragraph made only of pictures, as a figure.
  figure(b, caption) {
    const imgs = [];
    const rest = b.text
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const a = attrs(tag);
        imgs.push(this.imgTag(b.file, a.src || "", a.alt || "", a.width));
        return "";
      })
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
        imgs.push(this.imgTag(b.file, src, alt));
        return "";
      });
    // A caption on the line after the pictures (a README's <sub> line) counts as one.
    const trailing = rest.trim();
    if (trailing && /^\*[^*][\s\S]*\*$/.test(trailing) && !caption) caption = trailing.slice(1, -1);
    else if (trailing || (!imgs.length && !caption)) return null;
    const figs = CONFIG.figures;
    const kind = (im) => (figs.beforeAfter && im.repoPath.includes(figs.beforeAfter) ? "ba" : /\.gif$/i.test(im.repoPath) ? "clip" : figs.screens && im.repoPath.includes(figs.screens) ? "screen" : "wide");
    const cap = caption ? `<p class="fig-note">${this.inline(caption, b.file)}</p>` : "";
    // An italic paragraph alone, under a table, reads as its caption.
    if (!imgs.length) return cap;
    // Two before-and-after pictures in one paragraph: drag to compare.
    // The slider shows the second picture in the first one's frame, so both
    // must have the same shape; otherwise they stay a row of pictures.
    const sameShape = (a, b) => a.size && b.size && Math.abs(a.size.w / a.size.h - b.size.w / b.size.h) < 0.02;
    if (imgs.length === 2 && imgs.every((im) => kind(im) === "ba") && sameShape(imgs[0], imgs[1]) && this.ctx.mode === "web") {
      const side = (im, fallback) => ({ src: im.src, alt: im.alt, label: im.alt.includes(":") ? im.alt.split(":")[0] : fallback, w: im.size && im.size.w, h: im.size && im.size.h });
      return ui.wipe(side(imgs[0], "Before"), side(imgs[1], "After"), caption ? this.inline(caption, b.file) : "");
    }
    const label = (k) => (k === "ba" ? "Before and after" : k === "clip" ? "Recording" : "");
    const text = (im) => `${label(kind(im)) ? `<span class="fig-label">${label(kind(im))}</span> ` : ""}${esc(im.alt)}`;
    // Screenshots, and several pictures side by side, as one row with one caption.
    if (imgs.length > 1 || kind(imgs[0]) === "screen") {
      const shots = imgs.map((im) => `<figure class="shot">${zoomable(im)}<figcaption>${text(im)}</figcaption></figure>`).join("");
      return `<div class="shots n${imgs.length}">${shots}${cap}</div>`;
    }
    const im = imgs[0];
    return `<figure class="fig fig-${kind(im)}">${zoomable(im)}<figcaption>${text(im)}</figcaption>${cap}</figure>`;
  }

  blocks(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.type === "para") {
        const next = list[i + 1];
        const cap = next && next.type === "para" && /^\*[^*][\s\S]*[^*]\*$|^\*[^*][\s\S]*\*\*[^*]+\*\*[^*]*\*$/.test(next.text.trim()) ? next.text.trim().slice(1, -1) : null;
        const fig = this.figure(b, cap);
        if (fig) {
          out.push(fig);
          if (cap) i++;
          continue;
        }
        out.push(`<p>${this.inline(b.text, b.file)}</p>`);
      } else if (b.type === "heading") {
        const h = `h${Math.min(b.level, 6)}`;
        out.push(`<${h} id="${b.id}">${this.inline(b.text, b.file)}<a class="anchor" href="#${b.id}" aria-label="Link to this section">#</a></${h}>`);
      } else if (b.type === "code") {
        out.push(`<pre><code${b.lang ? ` class="lang-${esc(b.lang)}"` : ""}>${esc(b.text)}</code></pre>`);
      } else if (b.type === "quote") {
        out.push(`<aside class="callout">${this.blocks(b.children.map((c) => tagFile(c, b.file)))}</aside>`);
      } else if (b.type === "table") {
        const head = b.head.map((c) => `<th scope="col">${this.inline(c, b.file)}</th>`).join("");
        const rows = b.rows.map((r) => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row">${this.inline(c, b.file)}</th>` : `<td>${this.inline(c, b.file)}</td>`)).join("")}</tr>`).join("");
        const emptyHead = b.head.every((c, k) => k > 0 ? !c.trim() : true) && b.head.length > 1 && !b.head[1].trim();
        out.push(`<div class="table-wrap"><table${emptyHead ? ' class="kv"' : ""}><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`);
      } else if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        const items = b.items
          .map((item) => {
            const kids = item.map((c) => tagFile(c, b.file));
            if (kids.length === 1 && kids[0].type === "para" && !this.figure(kids[0])) return `<li>${this.inline(kids[0].text, b.file)}</li>`;
            if (kids.length && kids[0].type === "para" && !this.figure(kids[0])) return `<li>${this.inline(kids[0].text, b.file)}${this.blocks(kids.slice(1))}</li>`;
            return `<li>${this.blocks(kids)}</li>`;
          })
          .join("");
        out.push(`<${tag}${b.ordered && b.start !== 1 ? ` start="${b.start}"` : ""}>${items}</${tag}>`);
      }
    }
    return out.join("\n");
  }
}

function tagFile(b, file) {
  const t = { ...b, file };
  if (b.type === "list") t.items = b.items.map((it) => it.map((c) => tagFile(c, file)));
  if (b.type === "quote") t.children = b.children.map((c) => tagFile(c, file));
  return t;
}

function attrs(tag) {
  const a = {};
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) a[m[1].toLowerCase()] = m[2];
  return a;
}

function unesc(s) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function restore(s, keep) {
  let out = s;
  for (let n = 0; n < 4 && out.includes("\u0000"); n++) out = out.replace(/\u0000(\d+)\u0000/g, (_, k) => keep[Number(k)]);
  return out;
}

function claimClass(text) {
  const t = text.replace(/<[^>]+>/g, "").trim().toLowerCase();
  if (/^(verified live|seen live)/.test(t)) return "claim-live";
  if (/^not verified live|^not tested/.test(t)) return "claim-none";
  if (/^tested (automated|headless)/.test(t)) return "claim-auto";
  return "";
}

function zoomable(im, eager) {
  const size = im.size ? ` width="${im.size.w}" height="${im.size.h}"` : "";
  const load = eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
  // A width the doc gives the picture (<img width="260">) is its largest size.
  const max = /^\d+$/.test(String(im.width || "")) ? ` style="max-width:${im.width}px"` : "";
  return `<button type="button" class="zoom" data-zoom aria-label="Enlarge: ${esc(im.alt)}"${max}><img src="${esc(im.src)}" alt="${esc(im.alt)}"${size}${load}></button>`;
}

function blockText(list) {
  const parts = [];
  for (const b of list) {
    if (b.type === "para" || b.type === "heading") parts.push(md.plain(b.text));
    else if (b.type === "list") for (const it of b.items) parts.push(blockText(it));
    else if (b.type === "quote") parts.push(blockText(b.children));
    else if (b.type === "table") parts.push(md.plain([...b.head, ...b.rows.flat()].join(" ")));
    else if (b.type === "code") parts.push(b.text);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// A site-absolute link ("/download/latest", served by the plug-in's site and
// its proxy) stays as is in the web page and takes the site's address in the
// single file and the PDF, which are read away from the site.
function siteHref(href, mode) {
  if (!href.startsWith("/")) return href;
  if (!CONFIG.site) throw new Error(`"${href}" needs "site" in handbook.config.json, the address that serves it`);
  return mode === "web" ? href : `${CONFIG.site.replace(/\/+$/, "")}${href}`;
}

// The hero picture: the README intro's picture named hero.*, as [alt, src].
function heroOf(docs) {
  const block = docs[CONFIG.intro.file].intro.find((b) => b.type === "para" && /^!\[[^\]]*\]\([^)]*hero\.[a-z]+\)$/.test(b.text.trim()));
  const m = block ? /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(block.text.trim()) : null;
  return m ? { alt: m[1], src: m[2] } : null;
}

// ---------------------------------------------------------------- generated parts

// The optional "how it works" diagram under the hero: what goes in, the
// Scenario models (with the price button), what comes back
// (handbook.config.json "flow").
function heroDiagram(r) {
  const flow = CONFIG.flow;
  if (!flow) return "";
  const m = flow.models;
  return ui.flow({
    label: `How ${CONFIG.product} works`,
    from: flow.from,
    actions: { label: m.label, items: m.items, more: m.more, button: m.button, note: m.note && md.plain(m.note) },
    to: flow.to,
    foot: flow.note ? [["", r.inline(flow.note, CONFIG.intro.file)]] : []
  });
}

function gallery(chapters, r) {
  // Every before and after picture in the configured chapter, with the
  // action named in the paragraph just above it (handbook.config.json "gallery").
  const g = CONFIG.gallery;
  if (!g) return "";
  const ch = chapters.find((c) => c.id === g.chapter);
  if (!ch) return "";
  const beforeAfter = new RegExp(`^!\\[([^\\]]*)\\]\\(([^)\\s]*${CONFIG.figures.beforeAfter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^)\\s]+)\\)$`);
  const cards = [];
  let lastAction = null;
  let lastHeading = ch.id;
  for (const b of ch.blocks) {
    if (b.type === "heading") lastHeading = b.id;
    if (b.type !== "para") continue;
    const lead = /^\*\*([^*]+)\*\*/.exec(b.text);
    if (lead) lastAction = lead[1];
    const m = beforeAfter.exec(b.text.trim());
    if (m) {
      const im = r.imgTag(b.file, m[2], m[1]);
      cards.push(`<li class="ba-card"><a href="#${lastHeading}"><span class="ba-img"><img src="${esc(im.src)}" alt="" loading="lazy"${im.size ? ` width="${im.size.w}" height="${im.size.h}"` : ""}></span><span class="ba-title">${esc(lastAction || "Before and after")}</span><span class="ba-text">${esc(m[1])}</span></a></li>`);
    }
  }
  if (!cards.length) return "";
  return `<div class="gallery screen-only"><p class="eyebrow">${esc(g.eyebrow || "Before and after")}</p><ul class="ba-grid">${cards.join("")}</ul></div>`;
}

function downloads(meta, mode, r) {
  const link = (file, text) => (mode === "web" ? `<a href="${file}">${text}</a>` : `<strong>${text}</strong> (<code>${file}</code>)`);
  const lines = CONFIG.downloads.map((line) => `<li>${r.inline(line.replace(/\{version\}/g, meta.version), CONFIG.intro.file)}</li>`);
  return `<ul>
<li>This handbook, ${meta.version}: ${meta.pdf ? `${link(meta.pdfName, "PDF for print, A4")} and ` : ""}${link(meta.htmlName, "one HTML file that works offline")}.</li>
${lines.join("\n")}
<li>Source code, issues and the changelog: <a href="${REPO_URL}" rel="noopener">github.com/${esc(CONFIG.repository)}</a>, MIT license.</li>
</ul>`;
}

function licenceExtra(meta) {
  return `<p>The Scenario logo is a trademark of Scenario and is not covered by the MIT license.</p>
<p class="build-note">This handbook is generated from the plug-in's docs, version ${meta.version}${meta.commit ? `, commit <code>${meta.commit}</code>` : ""}, ${meta.date}.</p>`;
}

// ---------------------------------------------------------------- page

// The link preview (Open Graph, X): absolute addresses, as link unfurlers ignore
// relative ones. The handbook's address is the site's, plus HANDBOOK_PATH when
// the action builds it into a folder.
function socialMeta(heroImg, meta) {
  const folder = (process.env.HANDBOOK_PATH || "").replace(/^\/+|\/+$/g, "");
  const base = CONFIG.site ? `${CONFIG.site.replace(/\/+$/, "")}/${folder ? `${folder}/` : ""}` : "";
  const tags = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", "Scenario"],
    ["property", "og:title", `${CONFIG.product} Handbook`],
    ["property", "og:description", CONFIG.description.replace(/\{version\}/g, meta.version)],
  ];
  if (base) tags.push(["property", "og:url", base]);
  // The rendered card when there is one, else the hero picture. Without an
  // absolute address there is no picture a preview can show.
  const pic = meta.og || heroImg;
  const image = pic && (/^https?:/.test(pic.src) ? pic.src : base && base + pic.src);
  if (image) {
    tags.push(["property", "og:image", image], ["property", "og:image:alt", pic.alt]);
    if (meta.og) tags.push(["property", "og:image:width", "1200"], ["property", "og:image:height", "630"]);
    tags.push(["name", "twitter:card", "summary_large_image"]);
  }
  return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${esc(value)}">`).join("");
}


function page(meta, chapters, docs, mode, extra = {}) {
  const ctx = { anchors: meta.anchors, fileHome: meta.fileHome, assets: meta.assets, problems: meta.problems, mode };
  const r = new Renderer(ctx);
  // The hero comes from the intro of the configured doc (README.md): its
  // first plain paragraph, its hero picture and its first block quote.
  const introFile = CONFIG.intro.file;
  const readme = docs[introFile];
  const plainPara = (b) => b.type === "para" && !/^!\[|<img\b|^\[!\[/.test(b.text.trim()) && !/^\*\*[^*]+:\*\*/.test(b.text.trim());
  const lede = readme.intro.find(plainPara);
  const notice = readme.intro.find((b) => b.type === "quote");
  const guide = CONFIG.intro.guide && docs[CONFIG.intro.guide];
  const guideIntro = guide ? guide.intro.find((b) => b.type === "para") : null;
  const hero = heroOf(docs);
  const heroImg = hero ? r.imgTag(introFile, hero.src, hero.alt) : null;
  const logo = fs.readFileSync(path.join(__dirname, "scenario-logo.svg"), "utf8").replace(/<!--[\s\S]*?-->\s*/, "").replace("<svg ", '<svg role="img" aria-label="Scenario" ');
  const product = esc(CONFIG.product);

  const index = [];
  const toc = [];
  const body = chapters
    .map((ch, n) => {
      let html = r.blocks(ch.blocks);
      if (ch.generated === "downloads") html = downloads(meta, mode, r);
      if (ch.generated === "licence") html += licenceExtra(meta);
      if (CONFIG.gallery && ch.id === (CONFIG.gallery.show || CONFIG.gallery.chapter)) html += gallery(chapters, r);
      const subs = ch.blocks.filter((b) => b.type === "heading" && b.level === 3);
      const cfg = CHAPTERS.find((c) => c.id === ch.id) || {};
      if (cfg.part) toc.push({ group: cfg.part[0] });
      else if (cfg.group) toc.push({ group: cfg.group });
      toc.push({ id: ch.id, title: ch.title, subs: subs.map((s) => ({ id: s.id, title: md.plain(s.text) })) });
      // Search entries: the chapter, then each of its h3 sections.
      const segs = [];
      let cur = { id: ch.id, title: ch.title, blocks: [] };
      for (const b of ch.blocks) {
        if (b.type === "heading" && b.level === 3) {
          segs.push(cur);
          cur = { id: b.id, title: md.plain(b.text), blocks: [] };
        } else cur.blocks.push(b);
      }
      segs.push(cur);
      for (const s of segs) index.push({ id: s.id, t: s.title, c: s.id === ch.id ? "" : ch.title, x: blockText(s.blocks).slice(0, 1600) });
      return `${cfg.part ? ui.part(cfg.part[0], cfg.part[1]) : ""}<section id="${ch.id}"${ch.newPage ? ' class="new-page"' : ""}>
<h2><span class="ch-num" aria-hidden="true">${String(n + 1).padStart(2, "0")} </span>${esc(ch.title)}<a class="anchor" href="#${ch.id}" aria-label="Link to this section">#</a></h2>
${html}
</section>`;
    })
    .join("\n");

  const chaptersToc = toc.filter((t) => !t.group);
  const pages = extra.pages || {};
  const printToc = `<nav class="print-toc print-only" aria-label="Contents"><h2 class="print-toc-title">Contents</h2><ol>${chaptersToc
    .map((t, n) => `<li><a href="#${t.id}"><span class="pt-num">${String(n + 1).padStart(2, "0")}</span><span class="pt-title">${esc(t.title)}</span><span class="pt-dots"></span><span class="pt-page">${pages[t.id] || "00"}</span></a></li>`)
    .join("")}</ol></nav>`;

  const cover = `<section class="cover print-only">
<div class="cover-logo">${logo}</div>
<div class="cover-main"><p class="eyebrow">Handbook</p><h1 class="cover-title">${product}</h1><p class="cover-sub">${lede ? r.inline(lede.text, introFile) : ""}</p></div>
${heroImg ? `<img class="cover-img" src="${esc(heroImg.src)}" alt="">` : ""}
<dl class="cover-meta"><div><dt>Version</dt><dd>${meta.version}</dd></div><div><dt>Date</dt><dd>${meta.date}</dd></div>${CONFIG.cover.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
</section>`;

  // The version note under the hero: the README's block quote, the guide's
  // intro and the configured notes.
  const noteHtml = [
    notice ? r.blocks(notice.children.map((c) => tagFile(c, introFile))) : "",
    guideIntro ? `<p>${r.inline(guideIntro.text, CONFIG.intro.guide)}</p>` : "",
    ...CONFIG.notes.map((n) => `<p>${r.inline(n, introFile)}</p>`)
  ].join("");
  const film = CONFIG.film && mode === "web" ? CONFIG.film : null;
  const media = film
    ? ui.film({ src: r.resolve(introFile, film.src, "img"), poster: film.poster ? r.resolve(introFile, film.poster, "img") : "", tag: film.tag || "Film", caption: film.caption })
    : heroImg
      ? `<figure class="fig fig-hero">${zoomable(heroImg, true)}<figcaption>${esc(heroImg.alt)}</figcaption></figure>`
      : "";
  const intro = `${ui.hero({
    eyebrow: `${CONFIG.product} · Handbook`,
    heading: CONFIG.product,
    accent: CONFIG.accent,
    ledeHtml: lede ? r.inline(lede.text, introFile) : "",
    buttons: CONFIG.cta.map(([t, href]) => [t, siteHref(href, mode)]),
    mediaHtml: media,
    noteHtml: noteHtml ? ui.note(`Version ${meta.version}`, noteHtml) : ""
  })}
${heroDiagram(r)}`;

  const searchJson = JSON.stringify(index).replace(/</g, "\\u003c");
  const links = [...CONFIG.nav.map(([t, href], k) => [t, siteHref(href, mode), k > 0]), ["GitHub", REPO_URL, true]];
  const legal = `${product} ${meta.version}${meta.commit ? `, commit <code>${meta.commit}</code>` : ""}, ${meta.date}. <a href="mailto:support@scenario.com">support@scenario.com</a>${CONFIG.trademarks ? `<br>${esc(CONFIG.trademarks)}` : ""}`;

  const html = `<!doctype html>
<html lang="en"${mode === "print" ? ' class="for-print"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${product} Handbook</title>
<meta name="description" content="${esc(CONFIG.description.replace(/\{version\}/g, meta.version))}">
${mode === "web" ? socialMeta(heroImg, meta) : ""}
<meta name="color-scheme" content="light">
${CONFIG.analytics && mode === "web" ? `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script><script defer src="${esc(CONFIG.analytics)}"></script>` : ""}
${ui.FONTS}
<style>${ui.LOOK}${CSS}${ui.theme(CONFIG.theme)}${printFooter()}</style>
</head>
<body>
<a class="skip" href="#guide">Skip to the handbook</a>
${ui.logoSymbol()}
${cover}
${printToc}
${ui.header({ product: CONFIG.product, chip: CONFIG.chip, version: meta.version, links, appUrl: APP_URL })}
<div class="page">
${ui.toc([{ id: "top", title: "Overview", subs: [] }, ...toc])}
<main id="guide" tabindex="-1">
${intro}
${body}
</main>
</div>
${ui.footer([["Source on GitHub", REPO_URL], ["Changelog", "#changelog"], ["Scenario docs", "https://docs.scenario.com"], ["scenario.com", "https://www.scenario.com"]], legal)}
<dialog class="lightbox" id="lightbox" aria-label="Enlarged picture"><form method="dialog"><button class="lb-close" aria-label="Close">Close</button></form><img alt=""><p class="lb-cap"></p></dialog>
<script type="application/json" id="search-index">${searchJson}</script>
<script>${ui.CLIENT}</script>
</body>
</html>
`;
  return html;
}

// ---------------------------------------------------------------- checks

function check(full, outDir, label, problems, later = []) {
  const html = full.replace(/<script[\s\S]*?<\/script>/g, " ");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]*)"/g)) if (m[1] && !ids.has(m[1])) problems.push(`${label}: link #${m[1]} has no target`);
  for (const m of html.matchAll(/\s(?:src|href)="([^"#][^"]*)"/g)) {
    const u = m[1];
    // Site-absolute links ("/download/latest") are the site's to serve.
    if (/^(https?:|mailto:|data:)/.test(u) || u.startsWith("/") || later.includes(u)) continue;
    if (!fs.existsSync(path.join(outDir, u))) problems.push(`${label}: ${u} does not resolve`);
  }
  // Links at the handbook's own ref are checked where resolve() checked them
  // (HANDBOOK_TREE, the release, in Publish site); links a doc spells out at
  // another ref, in the checkout.
  const blob = new RegExp(`href="${REPO_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\/blob\\/([^/]+)\\/([^"#]+)`, "g");
  for (const m of html.matchAll(blob)) {
    const ok = m[1] === GITHUB_REF ? inRepo(m[2]) : fs.existsSync(path.join(ROOT, m[2]));
    if (!ok) problems.push(`${label}: GitHub link to a file not in the repository${m[1] === GITHUB_REF && TREE ? ` at ${TREE}` : ""}: ${m[2]}`);
  }
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
  if (EM_DASH.test(text)) problems.push(`${label}: em dash`);
  if (/\/Users\/|\/home\/[a-z]|[A-Z]:\\Users\\/.test(text.replace(/data:[^"]+/g, ""))) problems.push(`${label}: machine path`);
  for (const m of text.replace(/data:[^"]+/g, "").matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
    if (m[0].toLowerCase() !== "support@scenario.com") problems.push(`${label}: email address ${m[0]}`);
  }
  // Terms that must carry their prefix in what a reader sees (code aside),
  // such as "Scenario MCP" for a plug-in whose own server is local
  // (handbook.config.json "checks.prefixed").
  const visible = text.replace(/<code>[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>/g, " ").replace(/<[^>]+>/g, " ");
  for (const [term, prefix] of CONFIG.checks.prefixed) {
    const re = new RegExp(`(.{0,${prefix.length + 1}})\\b${term}\\b`, "g");
    for (const m of visible.matchAll(re)) if (!m[1].endsWith(`${prefix} `)) problems.push(`${label}: bare "${term}" after "${m[1].trim()}"`);
  }
}

// ---------------------------------------------------------------- PDF

function findChrome() {
  const c = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  return c.find((p) => fs.existsSync(p)) || null;
}

// The link-preview card: www.scenario.com's BrandFrame, rendered by
// plugin-site og (src/og) to og.png, with the hero picture unless "og.picture"
// names another. If it cannot be made, the preview keeps the hero picture.
function renderOg(docs, out) {
  const og = CONFIG.og || {};
  const hero = heroOf(docs);
  const picture = og.picture ? path.join(ROOT, og.picture) : hero ? path.join(ROOT, path.dirname(CONFIG.intro.file), hero.src) : null;
  const title = og.title || CONFIG.product;
  const args = ["og", "--title", title, "--out", path.join(out, "og.png")];
  if (og.subtitle) args.push("--subtitle", og.subtitle);
  if (picture && fs.existsSync(picture)) args.push("--image", picture);
  if (og.textColor) args.push("--text-color", og.textColor);
  if (og.theme !== undefined) args.push("--theme", String(og.theme));
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "..", "bin", "plugin-site.js"), ...args], { encoding: "utf8", timeout: 120000 });
  if (r.status !== 0) {
    process.stderr.write(`plugin-site handbook: no link-preview card (${(r.stderr || "").trim()}); the preview uses the hero picture\n`);
    return null;
  }
  return { src: "og.png", alt: og.subtitle ? `${title}: ${og.subtitle}` : title };
}

function printPdf(chrome, htmlFile, pdfFile, profile) {
  const r = spawnSync(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--mute-audio",
      "--hide-scrollbars",
      `--user-data-dir=${profile}`,
      "--no-pdf-header-footer",
      "--virtual-time-budget=20000",
      "--run-all-compositor-stages-before-draw",
      `--print-to-pdf=${pdfFile}`,
      // Extra flags for the machine, such as --no-sandbox on a CI runner that
      // blocks Chrome's sandbox (CHROME_FLAGS, space-separated).
      ...(process.env.CHROME_FLAGS || "").split(/\s+/).filter(Boolean),
      `file://${htmlFile}`
    ],
    { encoding: "utf8", timeout: 180000 }
  );
  if (r.status !== 0 || !fs.existsSync(pdfFile)) throw new Error(`Chrome could not print the PDF: ${(r.stderr || "").split("\n").slice(-3).join(" ")}`);
}

// The page each chapter starts on, read back from the printed PDF.
function chapterPages(pdfFile, chapters) {
  const r = spawnSync("pdftotext", ["-layout", pdfFile, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  const pages = r.stdout.split("\f");
  const found = {};
  let from = 0;
  // Skip the cover and the contents pages.
  const tocEnd = pages.findIndex((p, i) => i > 0 && !/Contents/.test(p) && /\S/.test(p));
  from = Math.max(1, tocEnd);
  for (const [n, ch] of chapters.entries()) {
    const num = String(n + 1).padStart(2, "0");
    for (let p = from; p < pages.length; p++) {
      const hit = pages[p].split("\n").some((l) => l.trim().replace(/\s+/g, " ") === `${num} ${ch.title}`);
      if (hit) {
        found[ch.id] = p + 1;
        from = p;
        break;
      }
    }
  }
  return { found, count: pages.filter((p) => p.trim() || true).length - (pages[pages.length - 1].trim() ? 0 : 1) };
}

// ---------------------------------------------------------------- main

// The PDF's page footer names the product.
function printFooter() {
  return `@media print{@page{@bottom-left{content:${JSON.stringify(`${CONFIG.product} handbook`)};font:8pt "JetBrains Mono",monospace;color:#777}}}`;
}

// Reads the plug-in's version where its release tooling keeps it.
function readVersion() {
  const v = CONFIG.version;
  const text = read(v.file);
  if (v.json) {
    const value = v.json.split(".").reduce((o, k) => (o == null ? o : o[k]), JSON.parse(text));
    if (typeof value !== "string") throw new Error(`${v.file}: no version at ${v.json}`);
    return value;
  }
  const m = new RegExp(v.pattern).exec(text);
  if (!m) throw new Error(`${v.file}: no version matching ${v.pattern}`);
  return m[1];
}

function build(opts) {
  ({ root: ROOT, config: CONFIG } = loadConfig(opts.config, opts.cwd));
  REPO_URL = `https://github.com/${CONFIG.repository}`;
  GITHUB_REF = process.env.HANDBOOK_GITHUB_REF || "main";
  BLOB = `${REPO_URL}/blob/${GITHUB_REF}/`;
  TREE = process.env.HANDBOOK_TREE || "";
  CHAPTERS = CONFIG.chapters;
  FILE_NAMES = CONFIG.fileNames;
  MEDIA = CONFIG.media;
  opts = { ...opts, out: opts.out || path.join(ROOT, "build", "handbook") };
  const version = readVersion();
  const when = process.env.HANDBOOK_DATE ? new Date(process.env.HANDBOOK_DATE) : new Date();
  const docs = loadDocs();
  const { chapters, anchors, fileHome } = assemble(docs);
  const meta = {
    version,
    date: formatDate(when),
    commit: gitInfo(),
    anchors,
    fileHome,
    assets: new Map(),
    problems: [],
    // Built with --no-pdf, the pages offer no PDF, so none links to a missing file.
    pdf: opts.pdf,
    pdfName: `${CONFIG.files}-handbook-${version}.pdf`,
    htmlName: `${CONFIG.files}-handbook-${version}.html`
  };
  fs.mkdirSync(opts.out, { recursive: true });
  meta.og = opts.og === false || CONFIG.og === false ? null : renderOg(docs, opts.out);

  const web = page(meta, chapters, docs, "web");
  for (const [rel, abs] of meta.assets) {
    const dest = path.join(opts.out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  }
  // No CNAME: the site's domain is held by the plug-in's Vercel proxy.
  fs.writeFileSync(path.join(opts.out, "index.html"), web);
  const single = page(meta, chapters, docs, "single");
  fs.writeFileSync(path.join(opts.out, meta.htmlName), single);

  const problems = meta.problems;
  check(web, opts.out, "index.html", problems, opts.pdf ? [meta.pdfName] : []);
  check(single, opts.out, meta.htmlName, problems);
  if (/\s(?:src)="(?!data:|https:)/.test(single)) problems.push(`${meta.htmlName}: a picture is not embedded`);
  const result = { out: opts.out, version: meta.version, pages: null, pdf: null, problems: [...new Set(problems)] };
  if (result.problems.length) return result;

  if (opts.pdf) {
    const chrome = findChrome();
    if (!chrome) {
      result.problems.push("Google Chrome not found: set CHROME_PATH, or build with --no-pdf");
      return result;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scenario-handbook-"));
    const printFile = path.join(tmp, "print.html");
    const pdfFile = path.join(opts.out, meta.pdfName);
    const printHtml = page(meta, chapters, docs, "print");
    check(printHtml, opts.out, "print", result.problems);
    fs.writeFileSync(printFile, printHtml);
    printPdf(chrome, printFile, pdfFile, path.join(tmp, "profile"));
    const first = chapterPages(pdfFile, chapters);
    if (!first) result.problems.push("pdftotext not found (Poppler): the PDF contents has no page numbers");
    if (first && Object.keys(first.found).length === chapters.length) {
      fs.writeFileSync(printFile, page(meta, chapters, docs, "print", { pages: first.found }));
      printPdf(chrome, printFile, pdfFile, path.join(tmp, "profile"));
      const second = chapterPages(pdfFile, chapters);
      result.pages = second ? second.count : null;
      if (second && JSON.stringify(second.found) !== JSON.stringify(first.found)) result.problems.push("PDF contents page numbers moved between passes");
    } else if (first) {
      result.pages = first.count;
      result.problems.push(`PDF contents: page numbers not found for ${chapters.filter((c) => !first.found[c.id]).map((c) => c.title).join(", ")}`);
    }
    result.pdf = pdfFile;
    // The print page and the Chrome profile are scratch.
    fs.rmSync(tmp, { recursive: true, force: true });
    check(web, opts.out, "index.html", result.problems);
  }
  return result;
}

function main(argv) {
  const opts = parseArgs(argv);
  const r = build(opts);
  if (r.problems.length) {
    process.stderr.write(r.problems.join("\n") + `\n\nhandbook: ${r.problems.length} problem(s)\n`);
    return 1;
  }
  if (!opts.quiet) {
    process.stdout.write(`handbook ${r.version}: ${path.relative(process.cwd(), r.out) || "."}/index.html\n`);
    if (r.pdf) process.stdout.write(`pdf: ${path.relative(process.cwd(), r.pdf)}${r.pages ? `, ${r.pages} pages` : ""}\n`);
  }
  return 0;
}

module.exports = { build, main };
