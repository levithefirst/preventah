import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

/**
 * Two families, and only the weights actually used.
 *
 * Bricolage carries the editorial boldness the brand wants on titles;
 * Plus Jakarta stays readable at 15-16px inside a WebView. Loading the
 * full weight range of either would cost more than the design gains, and
 * the Mini App runs on phones over mobile data.
 *
 * next/font self-hosts these at build time, so there is no request to
 * Google from a user's device and no layout shift beyond the swap.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-bricolage',
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://preventah-nimiq.vercel.app'),
  title: {
    default: 'Preventah — Stay ahead of family history',
    template: '%s — Preventah',
  },
  description:
    'Turn what runs in your family into a clear daily prevention plan, backed by a real USDT commitment you approve in Nimiq Pay.',
  applicationName: 'Preventah',
  /*
    Two different jobs, two different assets.

    The browser tab gets the SVG favicon, which is drawn for 16-32px. Every
    application surface - iOS home screen, Android launcher, any host that
    scrapes for an app icon - gets PNG, because native icon loaders
    generally cannot decode SVG and fall back to a generic globe when SVG is
    all they find. That fallback is exactly what Preventah was showing.
  */
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  /*
    Kept in step with the page it previews.

    The card is the first thing most people see, and it is what the
    competition listing scrapes, so it repeats the headline rather than
    paraphrasing it. When the h1 on SiteHome changes, this changes with it:
    a card promising one thing and a page delivering another reads as a
    stale link, which is the opposite of the trust this product needs.
  */
  openGraph: {
    title: 'Preventah — Something runs in your family',
    description:
      'Pick what runs in your family from 117 catalog conditions. Get three specific things to do today, and commit USDT in Nimiq Pay so you actually do them.',
    siteName: 'Preventah',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#c9b6ea',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
