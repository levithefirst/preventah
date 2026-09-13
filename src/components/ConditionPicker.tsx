'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import {
  CATEGORY_SUMMARIES,
  CONDITION_COUNT,
  getCondition,
  searchConditions,
} from '@/lib/condition-index';
import type { ConditionCategory, ConditionEntry } from '@/lib/condition-types';
import { MAX_SELECTIONS, type ConditionId } from '@/lib/conditions';
import { SearchInput } from './ui/Field';
import Chip from './ui/Chip';
import Button from './ui/Button';
import { EmptyState, Notice } from './ui/States';

/**
 * The condition picker.
 *
 * Everything here is chosen from the catalog. There is deliberately no
 * "other" field and no free-text input: it would widen what the app stores
 * into clinical detail it has no business holding, and the database rejects
 * anything that is not a catalog id anyway.
 *
 * Search runs entirely in memory over a precomputed index, so there is no
 * request per keystroke and no spinner. useDeferredValue keeps typing
 * responsive on a slow device by letting the input update before the list
 * re-renders.
 */

const RELEVANCE_COPY: Record<ConditionEntry['familyHistoryRelevance'], string> = {
  strong: 'Family history is strongly relevant',
  moderate: 'Family history is moderately relevant',
  some: 'Family history has some relevance',
};

function ConditionRow({
  entry,
  checked,
  disabled,
  onToggle,
}: {
  entry: ConditionEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className={`pv-cond${checked ? ' is-on' : ''}`}>
      <div className="pv-cond-row">
        {/*
          A real checkbox in a real label. The old markup was a clickable
          block; this gives keyboard users the control they expect and gives
          a screen reader the condition name as the checkbox's name.
        */}
        <label className="pv-cond-main">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
          />
          <span className="pv-cond-text">
            <span className="pv-cond-name">{entry.name}</span>
            <span className="pv-cond-desc">{entry.description}</span>
          </span>
        </label>

        <button
          type="button"
          className="pv-icon-btn"
          aria-expanded={expanded}
          aria-label={`What a family history of ${entry.name} means`}
          onClick={() => setExpanded((value) => !value)}
        >
          <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            style={{
              transform: expanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 200ms var(--ease)',
            }}
          >
            <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded ? (
        <div className="pv-cond-detail">
          <p className="pv-cond-relevance">
            {RELEVANCE_COPY[entry.familyHistoryRelevance]}
          </p>
          <p>{entry.riskContext}</p>
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pv-source"
          >
            Read more at {entry.sourceName}
          </a>
        </div>
      ) : null}
    </li>
  );
}

export default function ConditionPicker({
  initial,
  busy,
  compact,
  onSave,
  onCancel,
}: {
  initial: readonly ConditionId[];
  busy: boolean;
  /** True when editing an existing selection rather than choosing the first. */
  compact?: boolean;
  onSave: (ids: ConditionId[]) => void;
  onCancel?: () => void;
}) {
  const [selected, setSelected] = useState<Set<ConditionId>>(
    () => new Set(initial),
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConditionCategory | null>(null);

  // Typing updates the input immediately; the 117-row list re-renders a
  // beat later. On a fast device the difference is invisible.
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => searchConditions(deferredQuery, { category }),
    [deferredQuery, category],
  );

  const atLimit = selected.size >= MAX_SELECTIONS;

  function toggle(id: ConditionId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTIONS) next.add(id);
      return next;
    });
  }

  const dirty =
    selected.size !== initial.length ||
    [...selected].some((id) => !initial.includes(id));

  return (
    <>
      <h2>What runs in your family?</h2>
      <p className="muted" style={{ margin: '8px 0 16px' }}>
        Select conditions you know about. These are family-history conditions,
        not a symptom checker, and picking one is not a diagnosis.
      </p>

      <SearchInput
        label={`Search ${CONDITION_COUNT} conditions`}
        placeholder="Try diabetes, or blood pressure"
        value={query}
        onValueChange={setQuery}
      />

      <div className="pv-rail" role="group" aria-label="Filter by category">
        <Chip selected={category === null} onClick={() => setCategory(null)}>
          All {CONDITION_COUNT}
        </Chip>
        {CATEGORY_SUMMARIES.map((summary) => (
          <Chip
            key={summary.category}
            selected={category === summary.category}
            onClick={() =>
              setCategory((current) =>
                current === summary.category ? null : summary.category,
              )
            }
          >
            {summary.label} {summary.count}
          </Chip>
        ))}
      </div>

      {selected.size > 0 ? (
        <div className="pv-tray">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="label">
              {selected.size} of {MAX_SELECTIONS} selected
            </span>
            <button
              type="button"
              className="pv-link-btn"
              onClick={() => setSelected(new Set())}
            >
              Clear all
            </button>
          </div>
          <div className="pv-chips">
            {[...selected].map((id) => (
              <Chip
                key={id}
                selected
                removable
                aria-pressed={undefined}
                aria-label={`Remove ${getCondition(id)?.name ?? id}`}
                onClick={() => toggle(id)}
              >
                {getCondition(id)?.name ?? id}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {atLimit ? (
        <Notice tone="info">
          That is the maximum of {MAX_SELECTIONS}. Remove one to add another.
          Past this the daily plan stops being a plan and becomes a list of
          everything.
        </Notice>
      ) : null}

      {/*
        Announced politely so a screen-reader user hears the list shrink as
        they type, instead of tabbing into a result count they cannot predict.
      */}
      <p className="pv-sr-only" role="status" aria-live="polite">
        {results.length} condition{results.length === 1 ? '' : 's'} found
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="No match"
          action={
            category ? (
              <Button variant="secondary" onClick={() => setCategory(null)}>
                Search all categories
              </Button>
            ) : null
          }
        >
          Nothing matches &ldquo;{query.trim()}&rdquo;
          {category ? ' in this category' : ''}. Try the everyday word rather
          than the medical one, such as &ldquo;blood pressure&rdquo; instead of
          &ldquo;hypertension&rdquo;.
        </EmptyState>
      ) : (
        <ul className="pv-cond-list">
          {results.map((entry) => {
            const checked = selected.has(entry.id);
            return (
              <ConditionRow
                key={entry.id}
                entry={entry}
                checked={checked}
                disabled={!checked && atLimit}
                onToggle={() => toggle(entry.id)}
              />
            );
          })}
        </ul>
      )}

      {/*
        Sticky footer. The result list is long and the save action has to stay
        reachable without scrolling back to the bottom of 117 rows.
      */}
      <div className="pv-picker-footer">
        <Button
          variant="primary"
          offset
          disabled={selected.size === 0 || (compact && !dirty)}
          busy={busy}
          busyLabel="Saving"
          onClick={() => onSave([...selected])}
        >
          {selected.size === 0
            ? 'Select at least one'
            : compact
              ? `Save changes · ${selected.size}`
              : `Build my plan · ${selected.size} selected`}
        </Button>

        {compact ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSelected(new Set(initial));
              onCancel?.();
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </>
  );
}
