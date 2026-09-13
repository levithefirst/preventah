import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Buttons.
 *
 * Primary is mint with an ink edge, because a filled shape with a hard edge
 * survives a WebView on a bright phone screen better than a tinted one.
 * Destructive is danger text on cream, never a red fill: a red button is a
 * warning about itself, and the only destructive action here is a user
 * deleting their own data on purpose.
 *
 * Pressed state translates the sheet 2px toward its offset plate, which is
 * the same motion the whole system uses for "this responded".
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'pv-btn pv-btn-primary',
  secondary: 'pv-btn pv-btn-secondary',
  ghost: 'pv-btn pv-btn-ghost',
  danger: 'pv-btn pv-btn-danger',
};

export default function Button({
  children,
  variant = 'secondary',
  /** Blush plate behind the button. Primary CTA only. */
  offset = false,
  /** Swaps the label for a spinner and blocks the press. */
  busy = false,
  busyLabel,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  offset?: boolean;
  busy?: boolean;
  busyLabel?: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASS[variant]}${offset ? ' has-offset' : ''}${
        className ? ` ${className}` : ''
      }`}
      disabled={disabled || busy}
      // Tells a screen reader the press was received, before the result lands.
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className="pv-spinner" aria-hidden="true" /> : null}
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}

/**
 * A link that carries a button's weight.
 *
 * Separate component rather than a prop, because a navigation is an anchor
 * and an action is a button, and collapsing the two breaks both keyboard
 * behaviour and the middle-click that people expect from a link.
 */
export function ButtonLink({
  children,
  href,
  variant = 'primary',
  offset = false,
  className = '',
  ...rest
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  offset?: boolean;
  className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'>) {
  return (
    <a
      href={href}
      className={`${VARIANT_CLASS[variant]}${offset ? ' has-offset' : ''}${
        className ? ` ${className}` : ''
      }`}
      {...rest}
    >
      {children}
    </a>
  );
}
