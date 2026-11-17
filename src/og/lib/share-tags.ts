// Copied from scenario-com-landing-page lib/explorations/share-tags.ts (0ae037c2, #568).
// Changes: none.
/**
 * Share tags (title, description, robots, canonical, `og:*`, `twitter:*`) belong at the top of
 * `<head>`. Slack's unfurler asks for the first 32 KB of a page with an HTTP Range request and
 * ignores the rest, so a large inline `<style>` before the tags leaves a link without a preview
 * (fable-3d, the-picture-book). Facebook, X and LinkedIn read far more, so only Slack shows it.
 * docs: public/explorations/README.md § Presentation, discovery and integration.
 */

/** Slack reads 32 KB; half leaves room for the URLs the blob-mode build rewrites. */
export const SHARE_TAG_BUDGET = 16 * 1024;

/** The inside of a start tag, with `>` allowed in quoted attribute values. */
const ATTRIBUTES = `(?:[^>"']|"[^"]*"|'[^']*')*`;
/**
 * One left-to-right scan of the page: comments and raw-text elements (whose `<meta>` or
 * `</head>` is text) are consumed whole, and every start tag consumes its attributes.
 * Group 1 names a raw-text element, group 2 is a share-tag candidate, group 3 closes the head.
 */
const TOKEN = new RegExp(
  [
    `<!--[\\s\\S]*?-->`,
    `<(script|style|template|noscript)\\b${ATTRIBUTES}>[\\s\\S]*?</\\1\\s*>`,
    `(<title\\b${ATTRIBUTES}>[\\s\\S]*?</title\\s*>|<(?:meta|link)\\b${ATTRIBUTES}>)`,
    `(</head\\s*>)`,
    `<[a-z][^\\s/>]*${ATTRIBUTES}>`,
  ].join('|'),
  'gi'
);
/** A start tag's attribute list: group 1 of a tag that starts the text. */
const START_TAG = new RegExp(`^<[a-z][^\\s/>]*(${ATTRIBUTES})>`, 'i');
/** One attribute, its quoted value consumed whole, so `charset=` in a value is not a name. */
const ATTRIBUTE =
  /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

interface Span {
  start: number;
  end: number;
}

/** Where the moved tags go, by preference: after these elements, else at the head's start. */
interface Anchors {
  charset?: number;
  media?: number;
  base?: number;
}

interface HeadScan {
  shares: Span[];
  anchor: number;
}

/** The start tag's attributes, names lowercased; a name may map to an empty value. */
function attributes(tag: string): Map<string, string> {
  const list = START_TAG.exec(tag)?.[1] ?? '';
  return new Map(
    [...list.matchAll(ATTRIBUTE)].map(m => [
      (m[1] ?? '').toLowerCase(),
      m[2] ?? m[3] ?? m[4] ?? '',
    ])
  );
}

function attribute(tag: string, name: string): string {
  return (attributes(tag).get(name) ?? '').toLowerCase();
}

function isShareTag(tag: string): boolean {
  if (/^<title\b/i.test(tag)) return true;
  if (/^<link\b/i.test(tag)) return attribute(tag, 'rel') === 'canonical';
  const name = attribute(tag, 'name');
  return (
    name === 'description' ||
    name === 'robots' ||
    name.startsWith('twitter:') ||
    attribute(tag, 'property').startsWith('og:')
  );
}

/** Records a head token as a share tag or a possible anchor; the first anchor of a kind wins. */
function classify(
  token: RegExpExecArray,
  scan: Span[],
  anchors: Anchors
): void {
  const [text] = token;
  const span = { start: token.index, end: token.index + text.length };
  if (token[2] !== undefined && isShareTag(text)) scan.push(span);
  else if (
    token[2] !== undefined &&
    /^<meta\b/i.test(text) &&
    attributes(text).has('charset')
  )
    anchors.charset ??= span.end;
  else if (
    token[1]?.toLowerCase() === 'script' &&
    attributes(text).has('data-exploration-media')
  )
    anchors.media ??= span.end;
  else if (/^<base\b/i.test(text)) anchors.base ??= span.end;
}

/** The head's share tags, in document order, and where to move them; null without a head. */
function scanHead(html: string): HeadScan | null {
  let headStart = -1;
  const shares: Span[] = [];
  const anchors: Anchors = {};
  for (const token of html.matchAll(TOKEN)) {
    if (headStart === -1) {
      if (/^<head\b/i.test(token[0])) headStart = token.index + token[0].length;
      continue;
    }
    if (token[3] !== undefined || /^<body\b/i.test(token[0])) break;
    classify(token, shares, anchors);
  }
  if (headStart === -1) return null;
  const anchor = anchors.charset ?? anchors.media ?? anchors.base ?? headStart;
  return { shares, anchor };
}

/** UTF-8 byte offset where the last share tag ends (what a Range request counts), -1 if none. */
export function shareTagsEnd(html: string): number {
  const last = scanHead(html)?.shares.at(-1);
  return last ? Buffer.byteLength(html.slice(0, last.end)) : -1;
}

/**
 * Moves the share tags, in order, to just after `<meta charset>`. Text-based, so the rest of
 * the page stays byte for byte; a page whose tags already sit there is returned unchanged.
 */
export function withEarlyShareTags(html: string): string {
  const scan = scanHead(html);
  if (!scan?.shares.length) return html;
  const { shares, anchor } = scan;
  let rest = '';
  let from = 0;
  for (const { start, end } of shares) {
    rest += html.slice(from, start);
    from = end;
  }
  rest += html.slice(from);
  const removed = shares
    .filter(({ end }) => end <= anchor)
    .reduce((total, { start, end }) => total + end - start, 0);
  const at = anchor - removed;
  const tags = shares.map(({ start, end }) => html.slice(start, end)).join('');
  return `${rest.slice(0, at)}${tags}${rest.slice(at)}`;
}
