import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { INDEX_PATH, SITE_ASSETS } from './siteAssets';

/**
 * The deployment serves its own frontend.
 *
 * `*.convex.site` is the HTTP-router domain, so putting the SPA behind
 * the same router is what "hosted on Convex" means here: one deploy, one
 * origin, and no second provider between a judge and the app. Unknown
 * paths fall back to index.html so client-side state survives a reload.
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
  const asset = SITE_ASSETS[key] ?? SITE_ASSETS[INDEX_PATH];

  if (!asset) {
    return new Response('Site not built. Run `npm run build` before deploying.', {
      status: 503,
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

http.route({ path: '/', method: 'GET', handler: serve });
http.route({ pathPrefix: '/', method: 'GET', handler: serve });

export default http;
