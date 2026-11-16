"use strict";
// components-lib: the pieces of a Scenario plug-in site, with the markup
// photoshop.scenario.com uses, as functions that return HTML strings. The
// look is look.css, the behaviour client.js. Text arguments are plain text and
// are escaped here; arguments named html are trusted, already escaped HTML.

const fs = require("node:fs");
const path = require("node:path");

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const LOOK = fs.readFileSync(path.join(__dirname, "look.css"), "utf8");
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap">';

// The plug-in's colour: {chip, chipInk, chipSoft, chipLine}, any of them.
function theme(t) {
  if (!t) return "";
  const vars = [["chip", "--chip"], ["chipInk", "--chip-ink"], ["chipSoft", "--chip-soft"], ["chipLine", "--chip-line"]]
    .filter(([k]) => t[k])
    .map(([k, v]) => `${v}:${t[k]}`);
  return vars.length ? `:root{${vars.join(";")}}` : "";
}

// The Scenario wordmark, once per page, used by header() and footer().
function logoSymbol() {
  const svg = fs.readFileSync(path.join(__dirname, "..", "handbook", "scenario-logo.svg"), "utf8").replace(/<!--[\s\S]*?-->\s*/, "");
  const viewBox = (/viewBox="([^"]+)"/.exec(svg) || [, "0 0 1024 252"])[1];
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="logo" viewBox="${viewBox}">${inner}</symbol></svg>`;
}
const wordmark = () => '<svg class="wordmark" viewBox="0 0 1024 252" role="img" aria-label="Scenario"><use href="#logo"></use></svg>';

// The sticky top bar: wordmark, the plug-in's name chip and version, search,
// links ([text, href, optional]) and App Login.
function header({ product, chip, version, links = [], appUrl = "https://app.scenario.com", search = true }) {
  return `<header class="site-header">
  <div class="bar">
    <a class="brand" href="#top" aria-label="${esc(product)}, top of the page">${wordmark()}<span class="chip product">${esc(chip)}</span>${version ? `<span class="chip version" title="Version">${esc(version)}</span>` : ""}</a>
    ${
      search
        ? `<div class="search" role="search" id="search">
      <label class="visually-hidden" for="q">Search this page</label>
      <input id="q" type="search" placeholder="Search this page" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="q-results" aria-autocomplete="list">
      <kbd class="search-key" aria-hidden="true">/</kbd>
      <div class="search-panel" id="q-panel" hidden><ul id="q-results" role="listbox" aria-label="Matching sections"></ul><p class="search-status" id="q-status" aria-live="polite"></p></div>
    </div>`
        : ""
    }
    <nav class="site-nav" aria-label="Main">
      ${links.map(([t, href, optional]) => `<a${optional ? ' class="optional"' : ""} href="${esc(href)}">${esc(t)}</a>`).join("\n      ")}
      <a class="button" href="${esc(appUrl)}" rel="noopener">App Login</a>
    </nav>
  </div>
</header>`;
}

// The contents rail: every entry open. items: {id, title, subs: [{id, title}]}
// or {group: "Eight steps"} for a group label.
function toc(items) {
  const li = (t) =>
    t.group
      ? `<li><span class="grp">${esc(t.group)}</span></li>`
      : `<li><a href="#${esc(t.id)}">${esc(t.title)}</a>${t.subs && t.subs.length ? `<ul>${t.subs.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`).join("")}</ul>` : ""}</li>`;
  return `<nav class="toc" aria-label="Contents" id="toc"><details open><summary class="eyebrow">Contents</summary><ul>${items.map(li).join("")}</ul></details></nav>`;
}

// The serif title, with an optional italic part: "Scenario for Maya: user guide".
function title(text, accent) {
  return `<h1>${esc(text)}${accent ? `: <span class="it">${esc(accent)}</span>` : ""}</h1>`;
}

// Page buttons: the first filled, the others outlined. buttons: [[text, href]].
function cta(buttons) {
  return `<div class="cta">${buttons.map(([t, href], k) => `<a class="${k ? "btn-pill" : "btn-go"}" href="${esc(href)}">${esc(t)}</a>`).join("")}</div>`;
}

// A film with its poster and a play button; plays in place.
function film({ src, poster, tag = "Film", label, caption }) {
  return `<figure>
  <div class="film" id="film" data-state="poster">
    <video id="film-v" src="${esc(src)}"${poster ? ` poster="${esc(poster)}"` : ""} preload="none" playsinline aria-label="${esc(label || caption || tag)}"></video>
    <span class="film-tag">${esc(tag)}</span>
    <button class="film-play" type="button" id="film-play"><span class="tri" aria-hidden="true"></span>Watch the film</button>
    <span class="film-msg" role="status">The film is not on this page yet.</span>
  </div>
  ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
</figure>`;
}

// A note: one mono label, one or two sentences of HTML.
function note(label, html, kind) {
  return `<div class="note${kind ? ` ${kind}` : ""}"><span class="nk">${esc(label)}</span>${html}</div>`;
}

// The hero: eyebrow, title, lede (HTML), buttons, then media (HTML) and a note (HTML).
function hero({ eyebrow, heading, accent, ledeHtml, buttons = [], mediaHtml = "", noteHtml = "" }) {
  return `<div class="hero" id="top" data-toc="Overview">
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
  ${title(heading, accent)}
  ${ledeHtml ? `<p class="lede">${ledeHtml}</p>` : ""}
  ${buttons.length ? cta(buttons) : ""}
  ${mediaHtml}
  ${noteHtml}
</div>`;
}

// "How it works": what goes in, the actions in the middle (with the price
// button), what comes back. Items are [text, href]; foot is [[label, html]].
function flow({ label, from, actions, to, foot = [] }) {
  const items = (list) => list.map(([t, href]) => `<li>${href ? `<a href="${esc(href)}">${esc(t)}</a>` : esc(t)}</li>`).join("");
  return `<div class="flow" role="group" aria-label="${esc(label || "How it works")}">
  <div><h4>${esc(from.label)}</h4><ul>${items(from.items)}</ul></div>
  <div class="arr" aria-hidden="true"></div>
  <div class="mid"><h4>${esc(actions.label)}</h4><div class="acts">${actions.items.map(([t, href]) => (href ? `<a href="${esc(href)}"><span>${esc(t)}</span></a>` : `<span>${esc(t)}</span>`)).join("")}</div>${actions.more ? `<p class="more">${esc(actions.more)}</p>` : ""}${actions.button ? `<div class="pbtn">${esc(actions.button)}</div>` : ""}${actions.note ? `<span class="pnote">${esc(actions.note)}</span>` : ""}</div>
  <div class="arr" aria-hidden="true"></div>
  <div class="out"><h4>${esc(to.label)}</h4><ul>${items(to.items)}</ul></div>
  ${foot.length ? `<div class="foot">${foot.map(([b, html]) => `<span><b>${esc(b)}</b>${html}</span>`).join("")}</div>` : ""}
</div>`;
}

// Drag to compare two pictures of the same size. a and b: {src, alt, label, w, h}.
function wipe(a, b, captionHtml) {
  const img = (p, cls) => `<img${cls ? ` class="${cls}"` : ""} src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy"${p.w ? ` width="${p.w}" height="${p.h}"` : ""}>`;
  return `<figure class="fig">
  <div class="wipe" style="--cut:50%">
    ${img(a)}${img(b, "over")}
    ${a.label ? `<span class="lab">${esc(a.label)}</span>` : ""}${b.label ? `<span class="lab r">${esc(b.label)}</span>` : ""}
    <span class="line"></span><span class="knob" aria-hidden="true">&#8596;</span>
    <input type="range" min="0" max="100" value="50" aria-label="Compare ${esc(a.label || "before")} and ${esc(b.label || "after")}">
  </div>
  ${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ""}
</figure>`;
}

// Step cards linking to sections: [{href, src, title, sub, n, fit}].
function steps(cards) {
  return `<div class="steps8">${cards
    .map(
      (c, k) =>
        `<a class="step" href="${esc(c.href)}"><span class="ph${c.fit ? " fit" : ""}">${c.src ? `<img src="${esc(c.src)}" alt="" loading="lazy">` : ""}</span><span class="tx"><b><span>${esc(c.n || k + 1)}</span>${esc(c.title)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</span></a>`,
    )
    .join("")}</div>`;
}

// A part divider: a mono label and an italic line, before a run of sections.
function part(label, line) {
  return `<div class="part"><span>${esc(label)}</span>${line ? `<em>${esc(line)}</em>` : ""}</div>`;
}

// A section with its serif h2; bodyHtml is the section's content.
function section({ id, heading, whatHtml, bodyHtml, cls }) {
  return `<section id="${esc(id)}"${cls ? ` class="${cls}"` : ""}>
<h2>${esc(heading)}</h2>
${whatHtml ? `<p class="what">${whatHtml}</p>` : ""}
${bodyHtml}
</section>`;
}

// The footer: wordmark, links [text, href], and a line on the right (HTML).
function footer(links, legalHtml) {
  return `<footer class="site-footer"><div class="bar">${wordmark()}${links.map(([t, href]) => `<a href="${esc(href)}">${esc(t)}</a>`).join("")}${legalHtml ? `<span class="legal">${legalHtml}</span>` : ""}</div></footer>`;
}

module.exports = { esc, LOOK, FONTS, theme, logoSymbol, wordmark, header, toc, title, cta, film, note, hero, flow, wipe, steps, part, section, footer };
