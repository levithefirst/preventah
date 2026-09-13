import type { ReactNode } from 'react';

/**
 * The window: the one surface shape in the product.
 *
 * A cream sheet with an ink edge, optionally a blush sheet one step behind
 * it, optionally a bar across the top. The app icon is this shape, the plan
 * item is this shape, the commitment card is this shape. That is why the
 * brand and the UI read as one thing rather than a skin over a dashboard.
 *
 * `offset` is rationed on purpose. The blush plate marks the primary object
 * on a screen, so two or three at most; put it on every row and the page
 * vibrates.
 */

export type BarTone = 'mint' | 'ink' | 'blush' | 'done';

const BAR_CLASS: Record<BarTone, string> = {
  mint: 'pv-bar',
  ink: 'pv-bar pv-bar-ink',
  blush: 'pv-bar pv-bar-blush',
  done: 'pv-bar pv-bar-done',
};

export default function Window({
  children,
  /** Uppercase label in the top bar. Omit for a plain sheet. */
  bar,
  /** mint for habit surfaces, ink for money and consent. */
  barTone = 'mint',
  /** Right-hand note inside the bar, e.g. a date or a status. */
  barNote,
  /** The blush plate. Primary objects only. */
  offset = false,
  size = 'default',
  className = '',
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode;
  bar?: ReactNode;
  barTone?: BarTone;
  barNote?: ReactNode;
  offset?: boolean;
  size?: 'default' | 'compact' | 'roomy';
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  const sizeClass =
    size === 'compact'
      ? ' pv-window-compact'
      : size === 'roomy'
        ? ' pv-window-roomy'
        : '';

  return (
    <Tag
      className={`pv-window${sizeClass}${offset ? ' has-offset' : ''}${
        className ? ` ${className}` : ''
      }`}
      {...rest}
    >
      {bar !== undefined ? (
        <div className={BAR_CLASS[barTone]}>
          <span>{bar}</span>
          {barNote ? <span className="pv-bar-note">{barNote}</span> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/** Title row inside a window: heading left, badge or action right. */
export function WindowHead({
  title,
  aside,
  as: Tag = 'h2',
}: {
  title: ReactNode;
  aside?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="pv-window-head">
      <Tag>{title}</Tag>
      {aside}
    </div>
  );
}
