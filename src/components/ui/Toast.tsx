'use client';

import { useEffect } from 'react';

/**
 * Transient confirmation.
 *
 * Replaces the old inline notice rows, which pushed the whole page down and
 * moved the button the user had just pressed out from under their thumb.
 *
 * Announced politely rather than assertively: "Checked in" is a confirmation,
 * not an alert, and interrupting a screen reader mid-sentence for it is rude.
 * Errors that block progress stay inline in the card they belong to.
 */
export interface ToastMessage {
  id: number;
  text: string;
  tone: 'good' | 'error';
}

export function Toasts({
  toasts,
  onDismiss,
  timeoutMs = 3500,
}: {
  toasts: readonly ToastMessage[];
  onDismiss: (id: number) => void;
  timeoutMs?: number;
}) {
  // One timer per toast, keyed by id, so a second toast arriving does not
  // reset or orphan the first one's dismissal.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => onDismiss(toast.id), timeoutMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss, timeoutMs]);

  if (toasts.length === 0) return null;

  return (
    <div className="pv-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pv-toast${toast.tone === 'error' ? ' pv-toast-error' : ''}`}
        >
          <div className="pv-toast-strip" aria-hidden="true" />
          <div className="pv-toast-text">{toast.text}</div>
        </div>
      ))}
    </div>
  );
}
