// Reads and checks a plug-in's handbook.config.json, and fills the defaults.
// README.md ("Configuration") documents every key.

import fs from "node:fs";
import path from "node:path";

/** [text, href]: a button or a link. */
export type Link = [string, string];
export interface FlowColumn {
  label: string;
  items: [string, string?][];
}
export interface ChapterPart {
  file: string;
  section?: string;
  only?: string;
  skip?: string[];
}
export interface Chapter {
  id: string;
  title: string;
  parts?: ChapterPart[];
  generated?: "downloads" | "licence";
  newPage?: boolean;
  alias?: [string, string][];
  group?: string;
  part?: [string] | [string, string];
}
export interface Config {
  product: string;
  brand: string;
  repository: string;
  files: string;
  description: string;
  version: { file: string; json?: string; pattern?: string };
  chapters: Chapter[];
  media: string;
  intro: { file: string; guide: string };
  cta: Link[];
  nav: Link[];
  cover: [string, string][];
  notes: string[];
  downloads: string[];
  fileNames: Record<string, string>;
  figures: { beforeAfter: string; screens: string };
  checks: { prefixed: [string, string][] };
  trademarks: string;
  flow: { from: FlowColumn; models: FlowColumn & { note?: string; more?: string; button?: string }; to: FlowColumn; note?: string } | null;
  gallery: { chapter: string; show?: string; eyebrow?: string } | null;
  theme: { chip?: string; chipInk?: string; chipSoft?: string; chipLine?: string; accent?: string; accentDark?: string } | null;
  chip: string;
  accent: string;
  film: { src: string; poster?: string; tag?: string; caption?: string } | null;
  og: false | { title?: string; subtitle?: string; picture?: string; textColor?: string; theme?: number };
  site: string;
  analytics: string;
}

const DEFAULTS: Omit<Config, "product" | "brand" | "repository" | "files" | "description" | "version" | "chapters"> = {
  media: "docs/media",
  intro: { file: "README.md", guide: "" },
  cta: [["Install", "#install"]],
  nav: [["Install", "#install"], ["Changelog", "#changelog"]],
  cover: [],
  notes: ["Screenshots may show earlier layouts, and the prices in them are examples, not quotes. Select a screenshot to enlarge it."],
  downloads: [],
  fileNames: { "README.md": "README", "CHANGELOG.md": "Changelog", LICENSE: "LICENSE" },
  figures: { beforeAfter: "before-after/", screens: "screens/" },
  checks: { prefixed: [] },
  trademarks: "",
  flow: null,
  gallery: null,
  theme: null,
  chip: "",
  accent: "user guide",
  film: null,
  og: {},
  site: "",
  analytics: ""
};

const REQUIRED = ["product", "brand", "repository", "files", "description", "version", "chapters"];

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function loadConfig(configPath = "handbook.config.json", cwd = process.cwd()): { root: string; config: Config } {
  const file = path.resolve(cwd, configPath);
  if (!fs.existsSync(file)) fail(file, "not found");
  // The file as written, unchecked: every key is checked below before use.
  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `not JSON (${(error as Error).message})`);
  }
  for (const key of REQUIRED) if (raw[key] == null) fail(file, `"${key}" is required`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(raw.repository)) fail(file, '"repository" must be owner/name');
  if (!/^[a-z0-9-]+$/.test(raw.files)) fail(file, '"files" must be lower-case letters, digits and hyphens');
  if (!raw.version.file || !(raw.version.json || raw.version.pattern)) fail(file, '"version" needs "file" and "json" or "pattern"');
  if (!Array.isArray(raw.chapters) || !raw.chapters.length) fail(file, '"chapters" must list at least one chapter');
  const ids = new Set<string>();
  for (const c of raw.chapters) {
    if (!c.id || !c.title) fail(file, `a chapter needs "id" and "title": ${JSON.stringify(c)}`);
    if (ids.has(c.id)) fail(file, `chapter id "${c.id}" appears twice`);
    ids.add(c.id);
    if (!c.parts && !c.generated) fail(file, `chapter "${c.id}" needs "parts" or "generated"`);
    if (c.generated && !["downloads", "licence"].includes(c.generated)) fail(file, `chapter "${c.id}": unknown generated part "${c.generated}"`);
    if (c.group != null && typeof c.group !== "string") fail(file, `chapter "${c.id}": "group" must be a string`);
    if (c.part != null && !(Array.isArray(c.part) && c.part.length >= 1 && c.part.length <= 2)) fail(file, `chapter "${c.id}": "part" must be [label] or [label, line]`);
  }
  if (raw.analytics && !/^\/[\w./-]+\.js$/.test(raw.analytics)) fail(file, '"analytics" must be a site-absolute script path such as /page.js');
  if (raw.site && !/^https:\/\/[\w.-]+$/.test(raw.site)) fail(file, '"site" must be an https:// address with no path');
  if (raw.film && !raw.film.src) fail(file, '"film" needs "src"');
  if (raw.og != null && raw.og !== false && typeof raw.og !== "object") fail(file, '"og" must be false or {"title", "subtitle", "picture", "textColor", "theme"}');
  if (raw.theme && raw.theme.accentDark) process.stderr.write(`${file}: "theme.accentDark" is no longer used: the handbook is light only\n`);
  if (raw.gallery && !ids.has(raw.gallery.chapter)) fail(file, `"gallery.chapter" names no chapter: ${raw.gallery.chapter}`);
  if (raw.gallery && raw.gallery.show && !ids.has(raw.gallery.show)) fail(file, `"gallery.show" names no chapter: ${raw.gallery.show}`);
  const config = {
    ...DEFAULTS,
    ...raw,
    intro: { ...DEFAULTS.intro, ...(raw.intro || {}) },
    fileNames: { ...DEFAULTS.fileNames, ...(raw.fileNames || {}) },
    figures: { ...DEFAULTS.figures, ...(raw.figures || {}) },
    checks: { ...DEFAULTS.checks, ...(raw.checks || {}) }
  };
  config.media = `${config.media.replace(/\/+$/, "")}/`;
  // The name chip in the top bar: "Maya" for the brand "for Maya".
  if (!config.chip) config.chip = config.brand.replace(/^for\s+/i, "");
  // "theme.accent" was the plug-in's colour before components-lib.
  if (config.theme && config.theme.accent && !config.theme.chip) config.theme = { ...config.theme, chip: config.theme.accent };
  return { root: path.dirname(file), config };
}

// The repository paths a handbook is built from: the config, the version
// file, every doc it reads and the pictures folder. The action restores them
// from a release's commit so the site describes what people can download.
function docPaths(config: Config, configFile: string): string[] {
  const docs = [config.intro.file, config.intro.guide, config.og ? config.og.picture : undefined, ...config.chapters.flatMap((c) => (c.parts || []).map((p) => p.file))].filter((p): p is string => Boolean(p));
  return [...new Set([configFile, config.version.file, ...docs, config.media.replace(/\/$/, "")])];
}

export { loadConfig, docPaths, DEFAULTS };
