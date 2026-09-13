import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Chips: category filters, selected conditions, unit switches.
 *
 * Selected state is mint fill *and* a leading check. Colour alone would fail
 * for anyone who cannot separate mint from cream, and this is the control
 * that decides what a person's whole plan is built from.
 */
export default function Chip({
  children,
  selected = false,
  removable = false,
  className = '',
  ...rest
}: {
  children: ReactNode;
  selected?: boolean;
  /** Renders a trailing x. The whole chip is the remove target. */
  removable?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  return (
    <button
      type="button"
      className={`pv-chip${selected ? ' pv-chip-on' : ''}${
        className ? ` ${className}` : ''
      }`}
      aria-pressed={rest['aria-pressed'] ?? selected}
      {...rest}
    >
      {children}
      {removable ? (
        <span className="pv-chip-remove" aria-hidden="true">
          &times;
        </span>
      ) : null}
    </button>
  );
}

/** A non-interactive chip, for showing what is already saved. */
export function StaticChip({ children }: { children: ReactNode }) {
  return <span className="pv-chip pv-chip-static">{children}</span>;
}
