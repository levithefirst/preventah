import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { INDEX_PATH, SITE_ASSETS } from './siteAssets';

/**
 * The deployment serves its own frontend.
 *
 * `*.convex.site` is the HTTP-router domain, so putting the SPA behind
 * the same router is what "hosted on Convex" means here: one deploy, one
 * origin, and no second provider between a judge and the app.
 *
 * Routing is exact, and deliberately so. A `pathPrefix: '/'` catch-all
 * looks like the obvious SPA fallback and does not work: it left the
 * deployment answering "No content found" at the root, which is the
 * edge's message rather than the router's own 404, so the request never
 * reached this module at all. Every path the build emits is registered
 * instead, which is a shorter list than it sounds: an index, and one
 * fingerprinted prefix.
 *
 * The app keeps its state in React and never pushes history entries, so
 * there are no client-side routes to fall back for. If that changes, the
 * deep links have to be registered here too.
 */
const http = httpRouter();

function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const serve = httpAction(async (_ctx, request) => {
  const { pathname } = new URL(request.url);
  const key = pathname === '/' ? INDEX_PATH : pathname;
  const asset = SITE_ASSETS[key];

  if (!asset) {
    // A miss under /assets/ is a stale fingerprint, not a deep link.
    // Returning index.html for it would hand the browser HTML where it
    // asked for a script, which fails later and harder than a 404.
    return new Response(`Not found: ${pathname}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Vite fingerprints everything under /assets/, so those are immutable.
  // index.html must not be, or a deploy would not reach anyone.
  const immutable = key.startsWith('/assets/');

  return new Response(decode(asset.base64), {
    status: 200,
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  });
});

// The root, which serves the index.
http.route({ path: '/', method: 'GET', handler: serve });

// Everything Vite fingerprints. A prefix here is safe: it is not the root.
http.route({ pathPrefix: '/assets/', method: 'GET', handler: serve });

// Every other file the build actually emitted, at its own exact path.
// Today that is /index.html alone; a favicon or a manifest added later is
// picked up without touching this file.
for (const path of Object.keys(SITE_ASSETS)) {
  if (path === '/' || path.startsWith('/assets/')) continue;
  http.route({ path, method: 'GET', handler: serve });
}

export default http;
