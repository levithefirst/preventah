import { Lockup } from './brand/Logo';

/**
 * The Mini App top bar.
 *
 * Mark and wordmark only. Nimiq Pay already draws the chrome above this, so
 * there is no back button, no fake status bar and no tagline competing with
 * the host's own header for the top of a phone screen.
 *
 * The truncated wallet address sits on the right as quiet confirmation of
 * which account is connected. It is never the full address: there is no
 * reason to render 42 characters a user cannot verify at a glance anyway.
 */
export default function Masthead({ subtitle }: { subtitle?: string }) {
  return (
    <header className="pv-masthead">
      <Lockup size={30} as="div" />
      {subtitle ? (
        <span className="pv-masthead-meta" title="Connected wallet">
          {subtitle}
        </span>
      ) : null}
    </header>
  );
}
