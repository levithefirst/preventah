'use client';

import type { DailyPlan, PlanItem } from '@/lib/plans';

const SLOTS: { key: keyof Pick<DailyPlan, 'diet' | 'exercise' | 'habit'>; label: string; icon: string }[] = [
  { key: 'diet', label: 'Diet', icon: '\u{1F957}' },
  { key: 'exercise', label: 'Exercise', icon: '\u{1F45F}' },
  { key: 'habit', label: 'Habit', icon: '\u{1F9E9}' },
];

function Row({ item, label, icon }: { item: PlanItem; label: string; icon: string }) {
  return (
    <div className="plan-item">
      <div className="plan-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="plan-body">
        <div className="plan-kind">{label}</div>
        <div className="plan-text">{item.text}</div>
        {item.sourceKey ? (
          <div className="plan-source">Targets: {item.sourceLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Today's plan. Rendered straight from state with no loading state of its
 * own, because plan resolution is synchronous and cannot fail.
 */
export default function PlanCard({ plan }: { plan: DailyPlan }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Today&rsquo;s plan</h2>
        <span className="badge">Day {plan.dayIndex + 1}</span>
      </div>

      {plan.isBaseline ? (
        <div className="notice info">
          Showing general prevention guidance. Pick your family history
          categories to tailor this.
        </div>
      ) : null}

      {SLOTS.map(({ key, label, icon }) => (
        <Row key={key} item={plan[key]} label={label} icon={icon} />
      ))}
    </section>
  );
}
