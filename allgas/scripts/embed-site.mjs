/**
 * Embeds the Vite build into a Convex module so the deployment can serve
 * the frontend itself.
 *
 * `*.convex.site` is the HTTP-router domain, so "hosted on Convex" means
 * the router answers for the SPA as well as the API. Assets are written
 * into a generated TS module rather than uploaded separately, which keeps
 * a deploy to one command and the site atomic with the functions that
 * back it.
 *
 * Run after `vite build`. The output is generated: do not edit it.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const DIST = 'dist';
const OUT = 'convex/siteAssets.ts';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
if (files.length === 0) {
  console.error('No files in dist/. Run `vite build` first.');
  process.exit(1);
}

const entries = files.map((file) => {
  const path = `/${relative(DIST, file).split('\\').join('/')}`;
  const contentType = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  return { path, contentType, base64: readFileSync(file).toString('base64') };
});

const total = entries.reduce((sum, entry) => sum + entry.base64.length, 0);

const body = `/* eslint-disable */
/**
 * GENERATED FILE. Produced by scripts/embed-site.mjs from the Vite build.
 * Do not edit: \`npm run build\` overwrites it.
 */

export interface SiteAsset {
  contentType: string;
  base64: string;
}

export const SITE_ASSETS: Record<string, SiteAsset> = {
${entries
  .map(
    (entry) =>
      `  ${JSON.stringify(entry.path)}: {\n    contentType: ${JSON.stringify(
        entry.contentType,
      )},\n    base64:\n      ${JSON.stringify(entry.base64)},\n  },`,
  )
  .join('\n')}
};

/** Served for any path that is not an asset, so client routing works. */
export const INDEX_PATH = '/index.html';
`;

writeFileSync(OUT, body);
console.log(
  `embed-site: ${entries.length} file(s), ${(total / 1024).toFixed(0)} KB base64 -> ${OUT}`,
);
