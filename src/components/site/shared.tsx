import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lockup } from '../brand/Logo';
import { ButtonLink } from '../ui/Button';

/**
 * Public website chrome.
 *
 * Shares every token and primitive with the Mini App, so the site and the
 * product are recognisably the same thing rather than a marketing page
 * bolted onto an app.
 *
 * Nothing here collects health data, asks for a wallet, or needs JavaScript
 * to be useful. Someone who has never heard of Nimiq or USDT should be able
 * to read the whole thing and understand what they would be signing up for.
 */

/**
 * The one entry point into the product.
 *
 * Nimiq Pay resolves this deeplink to the Mini App hosted at the production
 * URL. Keep it in one place: it is the single most important link on the
 * site and a typo in it is invisible until someone taps it.
 */
export const NIMIQ_PAY_DEEPLINK =
  'https://nimpay.app/miniapps/open/preventah-nimiq.vercel.app';

export const NAV_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/prevention', label: 'Prevention' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/faq', label: 'FAQ' },
];

export function SiteHeader() {
  return (
    <header className="pv-site-header">
      <div className="pv-site-header-inner">
        <Link href="/" aria-label="Preventah home" style={{ textDecoration: 'none' }}>
          <Lockup size={32} as="div" />
        </Link>

        <nav className="pv-site-nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <ButtonLink
          href={NIMIQ_PAY_DEEPLINK}
          variant="primary"
          className="pv-header-cta"
        >
          Open in Nimiq Pay
        </ButtonLink>

        {/*
          Mobile menu. A native details/summary disclosure: keyboard-operable,
          works with JavaScript off, closes on Escape in every browser that
          supports it, and needs no focus-trap of its own because it is a
          disclosure rather than a modal. No library, no state, no portal.
        */}
        <details className="pv-site-menu">
          <summary aria-label="Menu">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <nav className="pv-site-menu-panel" aria-label="Main, mobile">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="pv-site-footer">
      <div className="pv-section">
        <div className="pv-footer-grid">
          <div>
            <Lockup size={32} as="div" mono />
            <p style={{ marginTop: 12, opacity: 0.8, fontSize: 15 }}>
              Stay ahead of family history.
            </p>
          </div>

          <div>
            <h3 className="label" style={{ marginBottom: 12 }}>
              Product
            </h3>
            <ul className="pv-footer-list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="label" style={{ marginBottom: 12 }}>
              Built with
            </h3>
            <ul className="pv-footer-list">
              <li>Nimiq Pay, a self-custodial payments app</li>
              <li>USDT, a US dollar&ndash;pegged token, on Polygon</li>
              <li>
                <a
                  href="https://github.com/levithefirst/preventah"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source, MIT licensed
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="pv-footer-legal">
          Preventah is a prevention-habit tool. It is not medical advice, a
          diagnosis, or a payment-yield product. It does not diagnose, treat or
          prescribe, and it does not replace a clinician. Talk to a clinician
          about your family history.
        </p>
      </div>
    </footer>
  );
}

/** Page wrapper: header, content, footer, and a skip link. */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pv-site">
      <a href="#main" className="pv-skip">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** A titled section. `tone` paints the band behind it. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  tone = 'canvas',
  /**
   * Heading level for the title.
   *
   * The first section of a standalone route is that page's h1; every other
   * section on the page is an h2. A page with no h1, or with several, gives
   * a screen reader no way to say what it is looking at.
   */
  as: Heading = 'h2',
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  tone?: 'canvas' | 'cream' | 'deep';
  as?: 'h1' | 'h2';
}) {
  const band =
    tone === 'cream'
      ? { background: 'var(--color-cream)' }
      : tone === 'deep'
        ? { background: 'var(--color-canvas-deep)' }
        : undefined;

  return (
    <div style={band}>
      <section className="pv-section" id={id}>
        {eyebrow ? <span className="pv-eyebrow">{eyebrow}</span> : null}
        {title ? <Heading>{title}</Heading> : null}
        {lede ? <p className="pv-lede">{lede}</p> : null}
        {children}
      </section>
    </div>
  );
}

export function CtaRow({
  primaryLabel = 'Open in Nimiq Pay',
  secondary,
}: {
  primaryLabel?: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="pv-hero-actions">
      <ButtonLink href={NIMIQ_PAY_DEEPLINK} variant="primary" offset>
        {primaryLabel}
      </ButtonLink>
      {secondary ? (
        <ButtonLink href={secondary.href} variant="secondary">
          {secondary.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
