'use client';

import { useEffect, useState } from 'react';
import type { DailyPlan, PlanItem } from '@/lib/plans';
import Window from './ui/Window';
import { Notice } from './ui/States';
import PlanGlyph from './ui/PlanGlyph';

const SLOTS: {
  key: keyof Pick<DailyPlan, 'diet' | 'exercise' | 'habit'>;
  label: string;
}[] = [
  { key: 'diet', label: 'Diet' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'habit', label: 'Habit' },
];

/**
 * The expanded view of one plan item.
 *
 * Rendered inline underneath the row rather than in a modal. A bottom sheet
 * inside the Nimiq Pay WebView competes with the host's own sheets and its
 * own back gesture, and there is nothing here that needs to trap focus.
 *
 * Every field is read from stored content. Nothing on this screen is
 * generated at request time.
 */
function PlanDetail({ item }: { item: PlanItem }) {
  return (
    <div className="pv-plan-detail">
      <p style={{ fontWeight: 600 }}>{item.description}</p>

      <h4>Why this matters</h4>
      <p>{item.why}</p>

      <h4>What to do</h4>
      <ul className="pv-steps">
        {item.howTo.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <h4>What it may support</h4>
      <p>{item.benefit}</p>
      {item.relatedConditions.length > 0 ? (
        <p className="faint">
          On your plan because you selected {item.relatedConditions.join(', ')}.
        </p>
      ) : (
        <p className="faint">General prevention guidance, shown to everyone.</p>
      )}

      <h4>Today&rsquo;s target</h4>
      <p>{item.target}</p>

      {item.safetyNote ? (
        <div className="pv-notice pv-notice-warn" style={{ marginTop: 14 }}>
          <strong>Worth knowing. </strong>
          {item.safetyNote}
        </div>
      ) : null}

      <p className="faint" style={{ marginTop: 14 }}>
        This is not a diagnosis or a prescription.
      </p>

      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pv-source"
      >
        Source: {item.sourceName}
      </a>
    </div>
  );
}

function Row({
  item,
  label,
  expanded,
  onToggle,
}: {
  item: PlanItem;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={`pv-plan-item${expanded ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pv-plan-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <PlanGlyph type={item.type} />

        <span className="pv-plan-body">
          <span className="pv-plan-kind">{label}</span>
          <span className="pv-plan-title">{item.title}</span>
          <span className="pv-plan-why">
            {item.relatedConditions.length > 0
              ? `From family history: ${item.relatedConditions.join(', ')}`
              : 'General prevention'}
          </span>
        </span>

        <svg
          className="pv-chevron"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded ? <PlanDetail item={item} /> : null}
    </li>
  );
}

/**
 * Today's plan. Rendered straight from state with no loading state of its
 * own, because plan resolution is synchronous and cannot fail.
 */
export default function PlanCard({ plan }: { plan: DailyPlan }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  // A new day, or a changed selection, produces different items. Collapse
  // rather than leaving an expanded panel showing yesterday's detail.
  useEffect(() => {
    setOpenKey(null);
  }, [plan.dayIndex, plan.diet.id, plan.exercise.id, plan.habit.id]);

  return (
    <Window bar="Your prevention plan" barNote={`Day ${plan.dayIndex + 1}`} offset>
      <p className="muted" style={{ marginBottom: 16 }}>
        {plan.isBaseline
          ? 'General prevention guidance. Pick what runs in your family to tailor this.'
          : 'Built from the family history you entered. Not a diagnosis.'}
      </p>

      {plan.isBaseline ? (
        <Notice tone="info">
          Showing the general plan until you select your family history.
        </Notice>
      ) : null}

      <ul className="pv-plan-list">
        {SLOTS.map(({ key, label }) => (
          <Row
            key={key}
            item={plan[key]}
            label={label}
            expanded={openKey === key}
            onToggle={() =>
              setOpenKey((current) => (current === key ? null : key))
            }
          />
        ))}
      </ul>

      <p className="faint" style={{ marginTop: 14 }}>
        Tap any item for why it is here and what to do. General lifestyle
        guidance, not medical advice.
      </p>
    </Window>
  );
}
