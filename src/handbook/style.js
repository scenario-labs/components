"use strict";
// What the handbook adds to the components-lib look: pictures that enlarge,
// rows of screenshots, check labels, the before and after gallery, the
// lightbox, and the A4 print sheet (cover, contents with page numbers).
// Light only, on the look's tokens.

const CSS = String.raw`
.skip{position:absolute;left:-10000px;top:8px}
.skip:focus{left:12px;z-index:50;background:var(--bg);padding:.5rem .8rem;border:1px solid var(--line)}
.print-only{display:none}
.ch-num{display:none}
main{outline:none}
.anchor{margin-left:.4rem;color:var(--line);text-decoration:none;font:400 .6em var(--sans);opacity:0;transition:opacity .15s}
h2:hover .anchor,h3:hover .anchor,h4:hover .anchor,.anchor:focus{opacity:1}
main ul:not(.steps8):not([class]),main ol:not([class]){margin:0 0 1rem;padding-left:1.3rem}
main ul:not([class]) li,main ol:not([class]) li{margin:.35rem 0}
main ul:not([class]) li::marker{color:var(--primary-light)}
main ol:not([class]) li::marker{font:500 .8rem var(--mono);color:var(--primary)}
main li>p{margin:.4rem 0}
.callout{border:1px solid var(--border);border-left:3px solid var(--primary-light);background:var(--card);padding:.75rem 1rem;border-radius:0 var(--radius) var(--radius) 0;margin:1.1rem 0 1.2rem;font-size:.92rem}
.callout p{margin:.3rem 0}
em.claim{font-style:normal;font:500 .72em/1 var(--mono);letter-spacing:.02em;white-space:nowrap;border-radius:999px;padding:.2em .55em;border:1px solid var(--line);color:var(--muted);vertical-align:.08em}
em.claim::before{content:"";display:inline-block;width:.62em;height:.62em;border-radius:50%;margin-right:.38em;vertical-align:-.02em;border:1.5px solid currentColor}
em.claim-live{border-color:var(--primary-light);color:var(--primary);background:var(--primary-soft)}
em.claim-live::before{background:currentColor}
em.claim-auto::before{background:linear-gradient(90deg,currentColor 50%,transparent 50%)}
em.claim-none{border-style:dashed}
.table-wrap{overflow-x:auto;margin:1rem 0 1.2rem}
table.kv thead{display:none}
td img,th img{max-width:100%;height:auto}

/* Pictures */
.zoom{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;border-radius:6px;overflow:hidden;line-height:0}
.zoom img{display:block;width:100%;height:auto}
.fig .zoom{border:1px solid var(--border);box-shadow:var(--shadow)}
.fig-hero{margin:0 0 1.6rem}
.fig-label{font:500 .62rem/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--primary);margin-right:.35rem}
.fig-clip .zoom{max-width:720px}
.fig-note{font-size:.84rem;color:var(--muted);margin:.35rem 0 0!important}
.shots{display:flex;flex-wrap:wrap;gap:1.2rem;margin:1.4rem 0 1.8rem}
.shots .shot{margin:0;flex:0 1 280px;display:flex;flex-direction:column;gap:.6rem}
.shots.n1 .shot{flex-basis:100%;flex-direction:row;align-items:flex-start;gap:1.2rem}
.shots.n1 .zoom{width:260px;flex-shrink:0}
.shots .zoom{border:1px solid var(--border);box-shadow:var(--shadow);background:var(--card)}
.shots figcaption{margin-top:0;max-width:42ch}
.shots .fig-note{flex-basis:100%}
.gallery{margin:2.4rem 0 0}
.ba-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.6rem}
.ba-card a{display:flex;flex-direction:column;height:100%;color:var(--fg);text-decoration:none;background:#fff;border:1px solid var(--border);border-radius:6px;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.ba-card a:hover{border-color:var(--primary-light);box-shadow:var(--shadow)}
.ba-img{display:block;aspect-ratio:4/3;overflow:hidden;background:var(--surface)}
.ba-img img{width:100%;height:100%;object-fit:cover}
.ba-title{display:block;font-weight:600;font-size:.92rem;padding:.6rem .7rem .1rem}
.ba-text{display:block;font-size:.78rem;line-height:1.35;color:var(--muted);padding:0 .7rem .7rem}
.flow .acts a{text-decoration:none;display:contents}
.flow li a{color:var(--fg);text-decoration:none}

/* Lightbox */
.lightbox{border:0;padding:0;background:transparent;max-width:96vw;max-height:96vh;overflow:visible}
.lightbox::backdrop{background:rgba(26,24,23,.88)}
.lightbox img{display:block;max-width:94vw;max-height:86vh;width:auto;height:auto;border-radius:6px;margin:0 auto}
.lb-cap{color:#e8e4e0;font-size:.86rem;text-align:center;max-width:70ch;margin:.7rem auto 0}
.lb-close{position:fixed;top:14px;right:16px;font:500 .8rem var(--mono);color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:.4rem .8rem;cursor:pointer}

@media (max-width:640px){
  .shots.n1 .shot{flex-direction:column}
  .shots.n1 .zoom,.shots .shot{width:100%;max-width:300px}
  .shots .shot{flex-basis:100%}
}

/* Print: A4, cover, contents with page numbers, no rail */
@page{size:A4;margin:16mm 16mm 18mm;
  @bottom-right{content:counter(page);font:8pt "JetBrains Mono",monospace;color:#777}}
@page:first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
@media print{
  :root{--bg:#fff;--shadow:none}
  html{scroll-padding-top:0}
  body{font-size:9.6pt;line-height:1.5;background:#fff}
  .site-header,.toc,.anchor,.skip,.lightbox,.screen-only,.cta,.site-footer,.hero,.film,.wipe input,.wipe .knob,.wipe .line{display:none!important}
  .print-only{display:block}
  .ch-num{display:inline;font:500 .55em var(--mono);color:var(--primary);vertical-align:.25em;margin-right:.2em}
  .page{display:block;padding:0;max-width:none}
  main{max-width:none}
  a{color:inherit;text-decoration-color:#bbb}
  .cover{height:297mm;width:210mm;padding:22mm 20mm 18mm;display:flex!important;flex-direction:column;break-after:page;position:relative}
  .cover-logo svg{width:44mm;height:auto;color:#111;display:block}
  .cover-main{margin-top:30mm}
  .cover-title{font:400 40pt/1 var(--serif);letter-spacing:-.02em;margin:0 0 6mm}
  .cover-sub{font-size:12pt;line-height:1.45;color:#333;max-width:140mm;margin:0}
  .cover-img{width:100%;height:auto;border-radius:3mm;margin-top:14mm}
  .cover-meta{margin:auto 0 0;display:flex;gap:12mm;font-size:9pt}
  .cover-meta dt{font:500 7pt var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#666;margin-bottom:1.5mm}
  .cover-meta dd{margin:0}
  .print-toc{break-after:page}
  .print-toc-title{font:400 22pt var(--serif);margin:0 0 8mm}
  .print-toc ol{list-style:none;margin:0;padding:0}
  .print-toc li a{display:flex;align-items:baseline;gap:3mm;text-decoration:none;padding:1.6mm 0;border-bottom:.2mm solid #e4e4e2;font-size:10.5pt}
  .pt-num{font:500 8pt var(--mono);color:var(--primary);width:8mm}
  .pt-dots{flex:1}
  .pt-page{font:500 9pt var(--mono)}
  .flow{break-inside:avoid;margin:0 0 6mm}
  section{margin-top:8mm;padding-top:0;border-top:0}
  section.new-page{break-before:page;margin-top:0}
  h2{font-size:20pt;margin:0 0 3mm;break-after:avoid}
  h3{font-size:13pt;margin:6mm 0 2mm;break-after:avoid}
  h4{break-after:avoid}
  p,li,.callout{orphans:3;widows:3}
  pre,blockquote,.callout,tr,.fig,.shots .shot,.wipe{break-inside:avoid}
  pre{white-space:pre-wrap;word-break:break-all}
  .table-wrap{overflow:visible}
  thead{display:table-header-group}
  .fig{margin:4mm 0}
  .fig .zoom{max-width:150mm}
  .fig-clip .zoom{max-width:110mm}
  .shots{gap:5mm;margin:3mm 0 5mm}
  .shots .shot{flex:0 0 42mm}
  .shots.n1 .shot{flex:1 1 100%}
  .shots.n1 .zoom{width:36mm}
  figcaption{font-size:8.4pt}
  em.claim{font-size:7.4pt}
}
`;

module.exports = { CSS };
