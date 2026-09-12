import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Preventah',
  description:
    'Turn your family health history into a daily prevention habit, backed by a USDT commitment you get back for showing up.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The Mini App is a fixed-width phone layout; zooming only breaks it.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
