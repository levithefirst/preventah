'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ConditionId } from '@/lib/conditions';

/**
 * The conditions section: a summary, and the picker behind it.
 *
 * The split is a payload decision, not a cosmetic one. The picker imports
 * the whole 117-entry catalog so search can run in memory with no request
 * per keystroke, and that catalog is the largest piece of application data
 * the browser ever sees. Most sessions never open the picker: someone who
 * chose their conditions last week opens the app to check in, not to edit
 * them.
 *
 * So the summary renders from labels the server already computed, imports
 * nothing from the catalog, and the picker is fetched only when the user
 * actually asks to change something.
 */
const ConditionPicker = dynamic(() => import('./ConditionPicker'), {
  // The catalog is a client-side search index; rendering it on the server
  // would ship the markup for 117 rows as well as the data.
  ssr: false,
  loading: () => (
    <div className="picker-loading">
      <span className="spinner dark" />
      <span>Loading conditions</span>
    </div>
  ),
});

export default function ConditionsCard({
  initial,
  labels,
  busy,
  compact,
  onSave,
}: {
  initial: readonly ConditionId[];
  /** Display names for `initial`, in the same order, computed server-side. */
  labels: readonly string[];
  busy: boolean;
  compact?: boolean;
  onSave: (ids: ConditionId[]) => void;
}) {
  const [open, setOpen] = useState(!compact);

  if (!compact || open) {
    return (
      <section className="card">
        <ConditionPicker
          initial={initial}
          busy={busy}
          compact={compact}
          onSave={(ids) => {
            onSave(ids);
            if (compact) setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <h2>Your family history</h2>
          <span className="muted">
            {initial.length === 0
              ? 'Nothing selected yet'
              : `${initial.length} condition${initial.length === 1 ? '' : 's'} tracked`}
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

      {labels.length > 0 ? (
        <div className="chips" style={{ marginTop: 12 }}>
          {labels.map((label) => (
            <span key={label} className="chip chip-static">
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
