'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';

/**
 * Form controls.
 *
 * Every input is 48px tall with a real label above it, and the font size is
 * pinned at 16px: anything smaller makes iOS zoom the WebView on focus, which
 * leaves the user in a scrolled, magnified layout they did not ask for and
 * cannot easily escape inside a Mini App.
 *
 * Selects use the native picker. A custom dropdown inside a WebView means
 * reimplementing scroll containment, keyboard handling and the platform's own
 * wheel UI, all to look slightly different.
 */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="pv-field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="faint" style={{ color: 'var(--color-danger)', marginTop: 6 }}>
          {error}
        </p>
      ) : hint ? (
        <p className="faint" style={{ marginTop: 6 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  invalid,
  className = '',
  ...rest
}: { invalid?: boolean; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`pv-input${invalid ? ' pv-input-error' : ''}${
        className ? ` ${className}` : ''
      }`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: { className?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`pv-select${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </select>
  );
}

/**
 * Search field with a leading glyph and a clear button.
 *
 * The clear button is a real 44px target rather than the native
 * ::-webkit-search-cancel-button, which is 12px, invisible on some themes,
 * and impossible to hit with a thumb.
 */
export function SearchInput({
  value,
  onValueChange,
  onClear,
  label,
  id,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  label: string;
  id?: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'id'
>) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div className="pv-search">
      <label className="label" htmlFor={inputId} style={{ marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <svg
          className="pv-search-icon"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m13.5 13.5 4 4" strokeLinecap="round" />
        </svg>
        <input
          id={inputId}
          type="search"
          className="pv-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          {...rest}
        />
        {value.length > 0 ? (
          <button
            type="button"
            className="pv-icon-btn pv-search-clear"
            aria-label="Clear search"
            onClick={() => {
              onValueChange('');
              onClear?.();
            }}
          >
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
