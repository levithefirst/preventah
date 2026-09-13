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
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/preventah-mark.svg' }],
  },
  openGraph: {
    title: 'Preventah — Stay ahead of family history',
    description:
      'Know what runs in your family. Follow a clear prevention plan. Put real USDT behind the habit of showing up.',
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
