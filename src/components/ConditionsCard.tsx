'use client';

import { useState } from 'react';
import { CONDITIONS, type ConditionKey } from '@/lib/conditions';

/**
 * The fixed hereditary risk checklist.
 *
 * Checkboxes only. There is deliberately no "other" field: free-text health
 * input is out of scope for this app and would widen what it stores.
 */
export default function ConditionsCard({
  initial,
  busy,
  compact,
  onSave,
}: {
  initial: readonly ConditionKey[];
  busy: boolean;
  compact?: boolean;
  onSave: (keys: ConditionKey[]) => void;
}) {
  const [selected, setSelected] = useState<Set<ConditionKey>>(
    () => new Set(initial),
  );
  const [open, setOpen] = useState(!compact);


  function toggle(key: ConditionKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const dirty =
    selected.size !== initial.length ||
    [...selected].some((key) => !initial.includes(key));

  if (compact && !open) {
    return (
      <section className="card">
        <div className="row-between">
          <div>
            <h2>Your risk profile</h2>
            <span className="muted">
              {initial.length} categor{initial.length === 1 ? 'y' : 'ies'}{' '}
              selected
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: 'auto' }}
            onClick={() => setOpen(true)}
          >
            Edit
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Your family history</h2>
        {!compact ? <span className="badge">Step 2 of 2</span> : null}
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        Tick anything that runs in your immediate family. Your plan is built
        from these. You can change them whenever you like.
      </p>

      {CONDITIONS.map((condition) => {
        const isSelected = selected.has(condition.key);
        return (
          <label
            key={condition.key}
            className={`choice${isSelected ? ' selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggle(condition.key)}
            />
            <span>
              <span className="choice-label">{condition.label}</span>
              <span className="choice-desc">{condition.description}</span>
            </span>
          </label>
        );
      })}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 8 }}
        disabled={busy || selected.size === 0 || (compact && !dirty)}
        onClick={() => onSave([...selected])}
      >
        {busy ? <span className="spinner" /> : null}
        {selected.size === 0
          ? 'Select at least one'
          : busy
            ? 'Saving'
            : compact
              ? 'Save changes'
              : 'Build my plan'}
      </button>

      {compact ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 8 }}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      ) : null}
    </section>
  );
}
