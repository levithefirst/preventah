import { useEffect, useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Action, Me } from '../types';
import Sources from './Sources';

/**
 * Today's three actions.
 *
 * Each carries the same three spend tiers, and the free one is always a
 * real option rather than a locked preview. Checking in is one tap on the
 * tier you actually did.
 */
export default function Today({ me }: { me: Me }) {
  return (
    <section>
      <Wording me={me} />
      {me.isBaseline && (
        <p className="note">
          This is the general plan. Pick the conditions that run in your family to tune it.
        </p>
      )}
      {me.actions.map((action) => (
        <ActionCard key={action.id} action={action} me={me} />
      ))}
      {me.conditions.length > 0 && <Sources conditions={me.conditions} />}
    </section>
  );
}

/**
 * The wording line, and the one call that produces it.
 *
 * `me.rewrite` is null only until today's row exists, so this fires at
 * most once per member per day; after that the row short-circuits the
 * action before any network call, which is what makes the refresh button
 * free rather than another charge. The ref guards the second render of
 * StrictMode, and the server guards everything else.
 */
function Wording({ me }: { me: Me }) {
  const generate = useAction(api.plansGenerate.generate);
  const [busy, setBusy] = useState(false);
  const asked = useRef<string | null>(null);

  const needsGenerating = me.rewrite === null;

  useEffect(() => {
    if (!needsGenerating) return;
    const key = `${me.memberId}:${me.dayKey}`;
    if (asked.current === key) return;
    asked.current = key;
    setBusy(true);
    void generate({ memberId: me.memberId }).finally(() => setBusy(false));
  }, [needsGenerating, me.memberId, me.dayKey, generate]);

  const label =
    me.rewrite === 'openai'
      ? `Wording tightened \u00b7 sources unchanged${me.model ? ` \u00b7 ${me.model}` : ''}`
      : 'Catalog wording';

  return (
    <p className="muted wording">
      {busy && me.rewrite === null ? 'Tightening wording...' : label}{' '}
      <button
        className="link"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void generate({ memberId: me.memberId }).finally(() => setBusy(false));
        }}
      >
        Refresh wording
      </button>
    </p>
  );
}

function ActionCard({ action, me }: { action: Action; me: Me }) {
  const check = useMutation(api.checkins.check);
  const undo = useMutation(api.checkins.undo);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <article className={action.doneTier ? 'card done' : 'card'}>
      <p className="kind">{action.type}</p>
      <h2>{action.title}</h2>
      <p>{action.description}</p>

      {action.safetyNote && <p className="warn">{action.safetyNote}</p>}

      <div className="tiers">
        {action.options.map((option) => (
          <button
            key={option.tier}
            className={action.doneTier === option.tier ? 'tier on' : 'tier'}
            onClick={() => {
              setError(null);
              void check({ memberId: me.memberId, actionId: action.id, tier: option.tier }).then(
                (result) => {
                  if (!result.ok) setError(result.reason);
                },
              );
            }}
          >
            <span className="tierLabel">{option.label}</span>
            <span className="tierTitle">{option.title}</span>
            <span className="tierCost">{option.costHint}</span>
          </button>
        ))}
      </div>

      {error && <p className="bad">{error}</p>}

      {action.doneTier && (
        <p className="ok">
          Checked in at the {action.doneTier} tier.{' '}
          <button
            className="link"
            onClick={() => void undo({ memberId: me.memberId, actionId: action.id })}
          >
            Undo
          </button>
        </p>
      )}

      <button className="link" onClick={() => setOpen(!open)}>
        {open ? 'Less' : 'Why this, and how'}
      </button>

      {open && (
        <div className="detail">
          <p>{action.why}</p>
          <ol>
            {action.howTo.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="muted">{action.benefit}</p>
          <p className="muted">
            Today's target: {action.target}
          </p>
          <p className="muted">
            {action.relatedConditions.length > 0
              ? `Connects to: ${action.relatedConditions.join(', ')}`
              : 'General prevention.'}
          </p>
          <p className="muted">
            Source:{' '}
            <a href={action.sourceUrl} target="_blank" rel="noreferrer">
              {action.sourceName}
            </a>
          </p>
        </div>
      )}
    </article>
  );
}
