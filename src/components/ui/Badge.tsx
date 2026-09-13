import type { ReactNode } from 'react';

/**
 * A small status pill.
 *
 * Tones are for process states (a transaction pending, a target reached),
 * never for health readings. Nothing in this product colour-codes a blood
 * pressure or a family condition, because that is a diagnosis wearing a
 * stylesheet.
 */
export default function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'mint';
}) {
  const toneClass =
    tone === 'neutral' ? '' : ` pv-badge-${tone === 'mint' ? 'mint' : tone}`;
  return <span className={`pv-badge${toneClass}`}>{children}</span>;
}
