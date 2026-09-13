'use client';

import { useEffect, useState } from 'react';
import type { DailyPlan, PlanItem } from '@/lib/plans';

const SLOTS: {
  key: keyof Pick<DailyPlan, 'diet' | 'exercise' | 'habit'>;
  label: string;
  icon: string;
}[] = [
  { key: 'diet', label: 'Diet', icon: '\u{1F957}' },
  { key: 'exercise', label: 'Exercise', icon: '\u{1F45F}' },
  { key: 'habit', label: 'Habit', icon: '\u{1F9E9}' },
];

/**
 * The expanded view of one plan item.
 *
 * Rendered inline underneath the row rather than in a modal: a modal inside
 * the Nimiq Pay WebView competes with the host's own sheets and its own
 * back gesture, and there is nothing here that needs to trap focus.
 */
function PlanDetail({ item }: { item: PlanItem }) {
  return (
    <div className="plan-detail">
      <p className="plan-detail-lead">{item.description}</p>

      <h3>Why this matters</h3>
      <p>{item.why}</p>

      <h3>What to do</h3>
      <ul className="plan-steps">
        {item.howTo.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <h3>What it may support</h3>
      <p>{item.benefit}</p>
      {item.relatedConditions.length > 0 ? (
        <p className="faint">
          Shown to you because you selected{' '}
          {item.relatedConditions.join(', ')}.
        </p>
      ) : (
        <p className="faint">
          General prevention guidance, shown to everyone.
        </p>
      )}

      <h3>Today&rsquo;s target</h3>
      <p>{item.target}</p>

      {item.safetyNote ? (
        <div className="notice warn-soft">
          <strong>Worth knowing. </strong>
          {item.safetyNote}
        </div>
      ) : null}

      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="plan-source-link"
      >
        Source: {item.sourceName}
      </a>
    </div>
  );
}

function Row({
  item,
  label,
  icon,
  expanded,
  onToggle,
}: {
  item: PlanItem;
  label: string;
  icon: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`plan-item${expanded ? ' expanded' : ''}`}>
      <button
        type="button"
        className="plan-trigger"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="plan-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="plan-body">
          <span className="plan-kind">{label}</span>
          <span className="plan-text">{item.title}</span>
          {item.relatedConditions.length > 0 ? (
            <span className="plan-source">
              For: {item.relatedConditions.join(', ')}
            </span>
          ) : (
            <span className="plan-source">General prevention</span>
          )}
        </span>
        <span className="plan-chevron" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded ? <PlanDetail item={item} /> : null}
    </div>
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
    <section className="card">
      <div className="card-head">
        <h2>Today&rsquo;s plan</h2>
        <span className="badge">Day {plan.dayIndex + 1}</span>
      </div>

      {plan.isBaseline ? (
        <div className="notice info">
          Showing general prevention guidance. Pick what runs in your family to
          tailor this.
        </div>
      ) : null}

      {SLOTS.map(({ key, label, icon }) => (
        <Row
          key={key}
          item={plan[key]}
          label={label}
          icon={icon}
          expanded={openKey === key}
          onToggle={() => setOpenKey((current) => (current === key ? null : key))}
        />
      ))}

      <p className="footer-note">
        Tap any item for why it matters and what to do. This is general
        lifestyle guidance, not medical advice.
      </p>
    </section>
  );
}
