'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_SUMMARIES,
  CONDITION_COUNT,
  getCondition,
  searchConditions,
} from '@/lib/condition-index';
import type { ConditionCategory, ConditionEntry } from '@/lib/condition-types';
import { MAX_SELECTIONS, type ConditionId } from '@/lib/conditions';

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
    <div className={`choice${checked ? ' selected' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        aria-label={entry.name}
      />
      <span>
        <span className="choice-label">{entry.name}</span>
        <span className="choice-desc">{entry.description}</span>

        <button
          type="button"
          className="btn-linklike"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Less' : 'What this means'}
        </button>

        {expanded ? (
          <span className="choice-detail">
            <span className="choice-relevance">
              {RELEVANCE_COPY[entry.familyHistoryRelevance]}
            </span>
            <span>{entry.riskContext}</span>
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="choice-source"
            >
              Read more at {entry.sourceName}
            </a>
          </span>
        ) : null}
      </span>
    </div>
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
  const searchRef = useRef<HTMLInputElement>(null);

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
      <div className="card-head">
        <h2>Your family history</h2>
        {!compact ? <span className="badge">Step 2 of 2</span> : null}
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        Search {CONDITION_COUNT} conditions and tick anything that runs in your
        immediate family. Your daily plan is built from these. You can change
        them whenever you like.
      </p>

      <div className="search-wrap">
        <input
          ref={searchRef}
          type="search"
          className="search-input"
          placeholder="Search conditions, e.g. diabetes, blood pressure"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query.length > 0 ? (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
          >
            &times;
          </button>
        ) : null}
      </div>

      <div className="chips" role="group" aria-label="Filter by category">
        <button
          type="button"
          className={`chip${category === null ? ' chip-on' : ''}`}
          onClick={() => setCategory(null)}
        >
          All {CONDITION_COUNT}
        </button>
        {CATEGORY_SUMMARIES.map((summary) => (
          <button
            key={summary.category}
            type="button"
            className={`chip${category === summary.category ? ' chip-on' : ''}`}
            onClick={() =>
              setCategory((current) =>
                current === summary.category ? null : summary.category,
              )
            }
          >
            {summary.label} {summary.count}
          </button>
        ))}
      </div>

      {selected.size > 0 ? (
        <div className="selected-bar">
          <div className="row-between">
            <strong>
              {selected.size} of {MAX_SELECTIONS} selected
            </strong>
            <button
              type="button"
              className="btn-linklike"
              onClick={() => setSelected(new Set())}
            >
              Clear all
            </button>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {[...selected].map((id) => (
              <button
                key={id}
                type="button"
                className="chip chip-on chip-removable"
                onClick={() => toggle(id)}
                aria-label={`Remove ${getCondition(id)?.name ?? id}`}
              >
                {getCondition(id)?.name ?? id}
                <span aria-hidden="true">&times;</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {atLimit ? (
        <div className="notice info">
          That is the maximum of {MAX_SELECTIONS}. Remove one to add another.
          Past this the daily plan stops being a plan and becomes a list of
          everything.
        </div>
      ) : null}

      {results.length === 0 ? (
        <div className="empty-state">
          <p>
            Nothing matches <strong>{query.trim()}</strong>
            {category ? ' in this category' : ''}.
          </p>
          <p className="faint">
            Try a everyday word rather than a medical one, such as
            &ldquo;blood pressure&rdquo; instead of &ldquo;hypertension&rdquo;.
            {category ? ' You can also clear the category filter.' : ''}
          </p>
          {category ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setCategory(null)}
            >
              Search all categories
            </button>
          ) : null}
        </div>
      ) : (
        <div className="condition-list">
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
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 12 }}
        disabled={busy || selected.size === 0 || (compact && !dirty)}
        onClick={() => onSave([...selected])}
      >
        {busy ? <span className="spinner" /> : null}
        {selected.size === 0
          ? 'Select at least one'
          : busy
            ? 'Saving'
            : compact
              ? 'Save changes'
              : 'Build my plan'}
      </button>

      {compact ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 8 }}
          onClick={() => {
            setSelected(new Set(initial));
            onCancel?.();
          }}
        >
          Cancel
        </button>
      ) : null}
    </>
  );
}
