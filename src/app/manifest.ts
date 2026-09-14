import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * This is the standards-based place a host, a launcher or a browser looks
 * for an application's name and icons. It exists because Preventah was
 * showing a generic globe rather than its mark: until now the only icons in
 * the repository were SVG, and native icon loaders - Android launchers, iOS
 * home screens, in-app directory lists - generally cannot decode SVG and
 * fall back to a placeholder when that is all they find.
 *
 * Note the division of labour, which is deliberate:
 *   /favicon.svg       browser tabs. Stays SVG: browsers render it, and it
 *                      is drawn for 16-32px (no mint grid, heavier P).
 *   /icons/*.png       applications. Raster, full-bleed cream, mark centred
 *                      with mask-safe padding.
 *
 * This manifest does NOT control the Preventah tile in Nimiq Pay's Mini Apps
 * directory. That icon comes from the `icon:` field of submission.yaml in
 * nimiq/miniappscompetition-submissions and is served from Nimiq's registry,
 * not from this origin. See README, "The Mini App icon".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Preventah',
    short_name: 'Preventah',
    description:
      'Turn what runs in your family into a clear daily prevention plan, backed by a real USDT commitment you approve in Nimiq Pay.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // The lavender canvas, so a launch screen matches the app rather than
    // flashing white before the first paint.
    background_color: '#c9b6ea',
    theme_color: '#c9b6ea',
    categories: ['health', 'lifestyle', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Extra padding so a circular or squircle crop cannot clip the P.
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
