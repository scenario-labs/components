// The fetchImageBuffer that resolve-image.ts and colorize-image.ts import, for
// a build on a plug-in's checkout: scenario-com-landing-page's
// lib/og/fetch-buffer.ts fetches from Vercel Blob and the site's own
// deployment; here a picture is a local file (a path or a file:// address),
// or an https address fetched as it is.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A picture's bytes, from a local path, a file:// address or an http(s)
 * address. Returns `undefined` on any failure, as the landing page's does.
 */
export async function fetchImageBuffer(url: string): Promise<Buffer | undefined> {
  try {
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : undefined;
    }
    const file = url.startsWith('file://') ? fileURLToPath(url) : url;
    return fs.readFileSync(file);
  } catch {
    return undefined;
  }
}
