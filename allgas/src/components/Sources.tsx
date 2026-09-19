import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Firecrawl source cards for one of the member's conditions.
 *
 * The cards render from a live query over the cache, so they appear the
 * moment the action finishes writing them. Fetching is restricted to
 * public-health domains server-side; a prevention app should not cite a
 * forum thread.
 */
export default function Sources({
  conditions,
}: {
  conditions: { id: string; name: string }[];
}) {
  const [conditionId, setConditionId] = useState(conditions[0]?.id ?? '');
  const cards = useQuery(api.sources.forCondition, conditionId ? { conditionId } : 'skip');
  const refresh = useAction(api.sources.refresh);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (conditions.length === 0) return null;

  return (
    <section className="card">
      <h2>Read more</h2>
      <div className="chips">
        {conditions.map((condition) => (
          <button
            key={condition.id}
            className={conditionId === condition.id ? 'chip on' : 'chip'}
            onClick={() => setConditionId(condition.id)}
          >
            {condition.name}
          </button>
        ))}
      </div>

      <button
        className="link"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setStatus(null);
          void refresh({ conditionId, force: true })
            .then((result) => setStatus(result.detail))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Searching...' : 'Find current sources (Firecrawl)'}
      </button>

      {status && <p className="muted">{status}</p>}

      {cards?.map((card) => (
        <div className="source" key={card.url}>
          <a href={card.url} target="_blank" rel="noreferrer">
            {card.title}
          </a>
          <p className="muted">{card.snippet}</p>
        </div>
      ))}
    </section>
  );
}
