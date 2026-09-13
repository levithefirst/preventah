import type { ReactNode } from 'react';

/**
 * Loading, empty and error treatments.
 *
 * The loading skeleton is a window with the fill drained out, so the page
 * does not change shape when the real content lands. The empty state is a
 * line drawing of the same window, which keeps the visual language whole
 * even where there is nothing to show.
 *
 * No full-page spinners except the wallet handshake, which genuinely blocks
 * everything behind it.
 */

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pv-skeleton pv-skeleton-row" />
      ))}
    </div>
  );
}

/** A 2px ink line drawing of the window itself. No stock illustration. */
export function EmptyGlyph() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="20" y="20" width="50" height="50" rx="12" opacity="0.35" />
      <rect x="10" y="10" width="50" height="50" rx="12" fill="var(--color-cream)" />
      <path d="M10 24h50" />
      <path
        d="M24 40h22M24 50h14"
        strokeDasharray="4 5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pv-empty">
      <EmptyGlyph />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

/**
 * An error the user can act on.
 *
 * role="alert" because an error that appears after an action the user took
 * should interrupt, unlike a success toast.
 */
export function ErrorNotice({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pv-notice pv-notice-error" role="alert">
      {children}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'good' | 'warn' | 'error';
}) {
  return <div className={`pv-notice pv-notice-${tone}`}>{children}</div>;
}
