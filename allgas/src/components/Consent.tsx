import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/**
 * The consent gate. Nothing about anyone's family health is collected
 * until this is accepted, and the copy is the plain version rather than a
 * policy link.
 */
export default function Consent({ memberId }: { memberId: Id<'members'> }) {
  const copy = useQuery(api.members.consentCopy, {});
  const consent = useMutation(api.members.consent);
  const [busy, setBusy] = useState(false);

  return (
    <main className="wrap">
      <h1>Before you pick anything</h1>
      <section className="card">
        {copy === undefined ? (
          <p>Loading.</p>
        ) : (
          <ul className="consent">
            {copy.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <button
          className="primary"
          disabled={busy || copy === undefined}
          onClick={() => {
            setBusy(true);
            void consent({ memberId, accepted: true }).finally(() => setBusy(false));
          }}
        >
          I understand, continue
        </button>
      </section>
    </main>
  );
}
