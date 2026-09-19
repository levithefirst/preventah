import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Me } from '../types';

/**
 * The condition picker.
 *
 * Search runs against the curated catalog on the server, so there is no
 * free-text path into anyone's health record: every selection is an id
 * the catalog already knows. The wording throughout is "a family history
 * is relevant", never "you are at risk".
 */
export default function ConditionPicker({ me }: { me: Me }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const catalog = useQuery(api.catalog.search, { q, category, limit: 60 });
  const setConditions = useMutation(api.members.setConditions);

  const selected = new Set(me.conditions.map((condition) => condition.id));

  function toggle(id: string) {
    const next = selected.has(id)
      ? [...selected].filter((value) => value !== id)
      : [...selected, id];
    void setConditions({ memberId: me.memberId, conditionIds: next });
  }

  return (
    <section>
      <div className="card">
        <p className="muted">
          {selected.size} of {me.maxSelections} selected
          {catalog ? ` from ${catalog.total} conditions` : ''}. Your picks tune today's three
          actions. Nobody else in the household can see which ones.
        </p>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search conditions"
        />
        <div className="chips">
          <button className={category === null ? 'chip on' : 'chip'} onClick={() => setCategory(null)}>
            All
          </button>
          {catalog?.categories.map((entry) => (
            <button
              key={entry.category}
              className={category === entry.category ? 'chip on' : 'chip'}
              onClick={() => setCategory(entry.category)}
            >
              {entry.label} ({entry.count})
            </button>
          ))}
        </div>
      </div>

      {catalog === undefined ? (
        <p>Loading.</p>
      ) : (
        catalog.results.map((entry) => (
          <article
            key={entry.id}
            className={selected.has(entry.id) ? 'card picked' : 'card'}
            onClick={() => toggle(entry.id)}
          >
            <div className="row">
              <div>
                <strong>{entry.name}</strong>
                <p className="muted">
                  {entry.categoryLabel} &middot; family history {entry.familyHistoryRelevance}
                </p>
              </div>
              <span className="pick">{selected.has(entry.id) ? 'Selected' : 'Add'}</span>
            </div>
            <p>{entry.description}</p>
            <p className="muted">{entry.riskContext}</p>
          </article>
        ))
      )}
    </section>
  );
}
