'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ConditionId } from '@/lib/conditions';
import Window, { WindowHead } from './ui/Window';
import Button from './ui/Button';
import { StaticChip } from './ui/Chip';
import { SkeletonRows } from './ui/States';

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
    <div>
      <div className="pv-skeleton" style={{ height: 48, marginBottom: 16 }} />
      <SkeletonRows count={4} />
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
      <Window offset={!compact} size="roomy">
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
      </Window>
    );
  }

  return (
    <Window>
      <WindowHead
        title="Your family history"
        aside={
          <Button
            variant="ghost"
            style={{ width: 'auto', minHeight: 44, padding: '0 12px' }}
            onClick={() => setOpen(true)}
          >
            Edit
          </Button>
        }
      />

      {labels.length > 0 ? (
        <div className="pv-chips">
          {labels.map((label) => (
            <StaticChip key={label}>{label}</StaticChip>
          ))}
        </div>
      ) : (
        <p className="faint">Nothing selected yet.</p>
      )}
    </Window>
  );
}
